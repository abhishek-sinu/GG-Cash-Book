"use client";

import { useEffect, useSyncExternalStore } from "react";
import { emptyLedger, validateLedger, type Ledger } from "@/lib/ledger";

export type Account = { id: string; name: string; email: string };
type Snapshot = { ledger: Ledger; revision: number; user: Account | null; error: string; ready: boolean; saving: boolean };
const initial: Snapshot = { ledger: emptyLedger, revision: 0, user: null, error: "", ready: false, saving: false };
let snapshot = initial;
let loading: Promise<void> | undefined;
let epoch = 0;
let refreshAfterSave = false;
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
function update(patch: Partial<Snapshot>) { snapshot = { ...snapshot, ...patch }; notify(); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await response.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("The service returned an invalid response.");
  const result: Record<string, unknown> = body;
  if (!response.ok) {
    if (response.status === 401 && url === "/api/ledger") update({ ...initial, ready: true });
    throw new Error(typeof result.error === "string" ? result.error : "Request failed. Please try again.");
  }
  return result;
}

function revision(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("The service returned an invalid revision.");
  return value;
}

function account(value: unknown): Account | null {
  if (value === null) return null;
  if (typeof value !== "object" || !value || !("id" in value) || typeof value.id !== "string" || !("email" in value) || typeof value.email !== "string" || !("name" in value) || typeof value.name !== "string") throw new Error("The account service returned an invalid response.");
  return { id: value.id, name: value.name, email: value.email };
}

export function loadAccount() {
  if (loading) return loading;
  if (snapshot.saving) { refreshAfterSave = true; return Promise.resolve(); }
  const started = epoch;
  loading = (async () => {
    try {
      const result = await requestJson("/api/account");
      if (started !== epoch) return;
      const user = account(result.user);
      if (!user) { update({ ...initial, ready: true }); return; }
      // Never display one account's ledger while another account is being loaded.
      if (snapshot.user?.id !== user.id) update({ ...initial, user });
      const saved = await requestJson("/api/ledger");
      if (started !== epoch) return;
      if (saved.accountId !== user.id) throw new Error("The signed-in account changed. Reload account records.");
      const nextRevision = revision(saved.revision);
      if (snapshot.user?.id === user.id && nextRevision < snapshot.revision) return;
      const ledger = snapshot.user?.id === user.id && nextRevision === snapshot.revision && snapshot.ready ? snapshot.ledger : validateLedger(saved.ledger);
      update({ user, ledger, revision: nextRevision, ready: true, error: "" });
    } catch (error) {
      if (started !== epoch) return;
      console.error("Account records could not be loaded.");
      update({ ready: true, error: error instanceof Error ? error.message : "Records could not be loaded." });
    }
  })().finally(() => { loading = undefined; });
  return loading;
}

export async function authenticate(action: "register" | "login", data: { name: string; email: string; password: string }) {
  epoch++;
  const result = await requestJson("/api/account", { method: "POST", body: JSON.stringify({ action, ...data }) });
  await loading;
  update({ ...initial, user: account(result.user) });
  await loadAccount();
  announce();
}

export async function logout() {
  if (snapshot.saving) throw new Error("Wait for the current save to finish.");
  await requestJson("/api/account", { method: "POST", body: JSON.stringify({ action: "logout" }) });
  epoch++;
  update({ ...initial, ready: true });
  announce();
}

function announce() {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("gg-cash-book-account");
    channel.postMessage("refresh");
    channel.close();
  }
}

export async function saveLedger(ledger: Ledger) {
  if (!snapshot.user) throw new Error("Sign in before saving records.");
  if (snapshot.saving) throw new Error("A save is already in progress.");
  if (snapshot.error) throw new Error("Reload account records before making changes.");
  const validated = validateLedger(ledger);
  const revision = snapshot.revision;
  const accountId = snapshot.user.id;
  epoch++;
  update({ saving: true });
  try {
    const saved = await requestJson("/api/ledger", { method: "PUT", body: JSON.stringify({ revision, accountId, ledger: validated }) });
    if (saved.accountId !== accountId || typeof saved.revision !== "number") throw new Error("The account service returned an invalid save response. Reload records.");
    update({ ledger: validateLedger(saved.ledger), revision: saved.revision, saving: false, error: "" });
    announce();
  } catch (error) {
    update({ saving: false });
    throw error;
  } finally {
    if (refreshAfterSave) { refreshAfterSave = false; void loadAccount(); }
  }
}

export function useLedger() {
  const result = useSyncExternalStore(subscribe, () => snapshot, () => initial);
  useEffect(() => {
    void loadAccount();
    const refresh = () => { void loadAccount(); };
    window.addEventListener("focus", refresh);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gg-cash-book-account") : undefined;
    if (channel) channel.onmessage = refresh;
    return () => { window.removeEventListener("focus", refresh); channel?.close(); };
  }, []);
  return result;
}
