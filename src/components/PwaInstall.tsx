"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { Modal } from "@/components/ui/FormControls";
import { registerWorker } from "@/lib/pwa";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const DISMISSED = "gg-cash-book-install-dismissed";
function subscribePlatform(listener: () => void) {
  const media = matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  window.addEventListener("appinstalled", listener);
  return () => { media.removeEventListener("change", listener); window.removeEventListener("appinstalled", listener); };
}
function platformSnapshot() {
  const standalone = matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return `${standalone ? "installed" : "browser"}:${ios ? "ios" : "other"}`;
}

export function PwaInstall() {
  const deferred = useRef<InstallEvent | null>(null);
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const platform = useSyncExternalStore(subscribePlatform, platformSnapshot, () => "browser:other");
  const ios = platform.endsWith(":ios");
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      if (!("prompt" in event) || !("userChoice" in event)) return;
      deferred.current = event as InstallEvent;
      setAvailable(true);
      try {
        const dismissed = Number(localStorage.getItem(DISMISSED) ?? 0);
        if (Date.now() - dismissed > 7 * 24 * 60 * 60 * 1000) setOpen(true);
      } catch (cause) {
        console.warn("Install prompt preference could not be read.", cause);
        setOpen(true);
      }
    };
    const completed = () => { deferred.current = null; setInstalled(true); setAvailable(false); setOpen(false); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", completed);
    void registerWorker().catch(cause => {
      console.error("PWA registration failed.", cause);
      setError(cause instanceof Error ? cause.message : "App installation support could not start.");
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", completed);
    };
  }, []);

  function close() {
    if (busy) return;
    setOpen(false);
    try { localStorage.setItem(DISMISSED, String(Date.now())); }
    catch (cause) { console.warn("Install prompt dismissal could not be saved.", cause); }
  }
  async function install() {
    const event = deferred.current;
    if (!event) return;
    setBusy(true); setError("");
    try {
      await event.prompt();
      const result = await event.userChoice;
      deferred.current = null;
      setAvailable(false);
      setBusy(false);
      // Only appinstalled/display-mode confirm installation, not a prompt click.
      if (result.outcome === "accepted") setOpen(false);
      else {
        setOpen(false);
        try { localStorage.setItem(DISMISSED, String(Date.now())); }
        catch (cause) { console.warn("Install prompt dismissal could not be saved.", cause); }
      }
    } catch (cause) {
      console.error("Install prompt failed.", cause);
      setError("The install prompt could not open. Try your browser's Install app or Add to Home Screen menu.");
    } finally { setBusy(false); }
  }

  if (installed || platform.startsWith("installed:")) return null;
  return (
    <>
      <div className="pwa-bar no-print">
        <span className="text-xs text-muted">Keep GG Cash Book on your home screen.</span>
        <button className="button" onClick={() => setOpen(true)}><Download size={16} aria-hidden="true" /> Install app</button>
      </div>
      {open && <Modal title="Install GG Cash Book" close={close}>
        <div className="editor-form">
          <p className="text-sm leading-7 text-muted">Open your cash books like an app from your home screen. An internet connection is still required to sign in and save records.</p>
          {available ? <button className="button primary" disabled={busy} onClick={() => { void install(); }}>{busy ? "Opening installer..." : "Install now"}</button>
            : <p className="text-sm leading-7">{ios ? "On iPhone or iPad: open this site in Safari, tap Share, then Add to Home Screen, and tap Add. iOS does not provide an automatic install popup." : "Open your browser menu and choose Install GG Cash Book, Install app, or Add to Home Screen. If unavailable, use Chrome or Edge on HTTPS. Your browser decides when native installation is available."}</p>}
          <p className="text-xs leading-6 text-muted">For a real phone, use a deployed HTTPS address. localhost and 127.0.0.1 refer to the phone itself, not this computer.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="button" disabled={busy} onClick={close}>Not now</button></div>
        </div>
      </Modal>}
    </>
  );
}
