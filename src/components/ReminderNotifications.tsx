"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { type Ledger, today } from "@/lib/ledger";
import { dueOccurrences, notificationBody } from "@/lib/notification-plan";
import { registerWorker } from "@/lib/pwa";

export function ReminderNotifications({ userId, ledger, disabled }: { userId: string; ledger: Ledger; disabled: boolean }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const delivering = useRef(false);
  const preferenceKey = `gg-cash-book-alerts:${userId}`;

  useEffect(() => {
    if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    const refresh = () => setPermission(Notification.permission);
    void registerWorker().then(() => {
      if (cancelled) return;
      refresh();
      setEnabled(localStorage.getItem(preferenceKey) === "on");
    }).catch(cause => {
      console.error("Notification setup failed.", cause);
      if (!cancelled) setError("Notifications could not initialize. Check browser support and storage settings, then reload.");
    });
    const message = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_REMINDERS") document.getElementById("reminders")?.scrollIntoView({ block: "start" });
    };
    window.addEventListener("focus", refresh);
    navigator.serviceWorker.addEventListener("message", message);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      navigator.serviceWorker.removeEventListener("message", message);
      // Remove this account's lock-screen notices when it leaves the workspace.
      void navigator.serviceWorker.getRegistration("/").then(async registration => {
        for (const notice of await registration?.getNotifications() ?? []) {
          if (notice.tag.startsWith(`gg-due:${userId}:`)) notice.close();
        }
      }).catch(cause => console.error("Old reminder notices could not be closed.", cause));
    };
  }, [preferenceKey, userId]);

  useEffect(() => {
    if (!enabled || permission !== "granted" || disabled) return;
    let cancelled = false;
    async function deliver() {
      if (delivering.current || cancelled || !navigator.onLine) return;
      delivering.current = true;
      async function check() {
        const date = today();
        const key = `gg-cash-book-alert-delivery:${userId}`;
        const raw = localStorage.getItem(key);
        let sent: string[] = [];
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw);
          if (typeof parsed !== "object" || !parsed || !("date" in parsed) || !("sent" in parsed) || !Array.isArray(parsed.sent) || !parsed.sent.every(item => typeof item === "string") || parsed.sent.length > 1000) throw new Error("Saved notification history is invalid. Disable alerts and clear this site's notification preferences before enabling again.");
          if (parsed.date === date) sent = parsed.sent;
        }
        const due = dueOccurrences(ledger, date, sent);
        if (!due.length || cancelled || Notification.permission !== "granted") return;
        const registration = await registerWorker();
        if (cancelled) return;
        // No names, amounts, account IDs, or financial notes appear on the lock screen.
        await registration.showNotification("GG Cash Book reminder", {
          body: notificationBody(due.length),
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: `gg-due:${userId}:${date}`,
          data: { url: "/#reminders" },
        });
        if (cancelled) {
          for (const notice of await registration.getNotifications({ tag: `gg-due:${userId}:${date}` })) notice.close();
          return;
        }
        localStorage.setItem(key, JSON.stringify({ date, sent: [...new Set([...sent, ...due])].slice(-1000) }));
      }
      try {
        if ("locks" in navigator) await navigator.locks.request(`gg-alerts:${userId}`, check);
        else await check();
      } catch (cause) {
        console.error("Due-reminder notification could not be delivered.", cause);
        if (!cancelled) setError(cause instanceof Error ? cause.message : "A due-reminder notification could not be delivered.");
      } finally { delivering.current = false; }
    }
    void deliver();
    const interval = setInterval(() => { void deliver(); }, 60_000);
    const refresh = () => { void deliver(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [disabled, enabled, ledger, permission, userId]);

  async function toggle() {
    setBusy(true); setError("");
    try {
      if (enabled) {
        localStorage.setItem(preferenceKey, "off");
        setEnabled(false);
        const registration = await navigator.serviceWorker.getRegistration("/");
        for (const notice of await registration?.getNotifications() ?? []) {
          if (notice.tag.startsWith(`gg-due:${userId}:`)) notice.close();
        }
        return;
      }
      // Request permission only as a direct response to this button, never on load.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setError(result === "denied" ? "Notifications are blocked. Allow them in your browser/site settings to enable alerts." : "Notification permission was not granted. You can try again when ready.");
        return;
      }
      await registerWorker();
      localStorage.setItem(preferenceKey, "on");
      setEnabled(true);
    } catch (cause) {
      console.error("Reminder notification settings failed.", cause);
      setError(cause instanceof Error ? cause.message : "Notifications could not be enabled.");
    } finally { setBusy(false); }
  }
  return (
    <div className="notification-settings no-print">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium"><Bell size={17} aria-hidden="true" /> Device reminder alerts</p>
        <button className="button" disabled={busy || disabled || permission === "unsupported"} onClick={() => { void toggle(); }}>{busy ? "Please wait..." : enabled ? "Disable alerts" : "Enable alerts"}</button>
      </div>
      <p className="mt-2 text-xs leading-6 text-muted">{permission === "unsupported" ? "Notifications are unavailable in this browser. On iPhone/iPad, install to the Home Screen first (iOS 16.4+)." : enabled && permission === "granted" ? "Enabled on this device. Due occurrences alert once per day while signed in and the app is open. Browser/OS settings may silence alerts." : "Opt in for private, generic due-reminder notifications on this device."} Alerts are not scheduled when the app is closed; background push requires a deployed push service and scheduler.</p>
      {permission === "denied" && <p className="mt-2 text-xs text-muted">Browser permission is blocked. Change this site&apos;s notification permission in browser settings.</p>}
      {error && <p role="alert" className="form-error mt-3">{error}</p>}
    </div>
  );
}
