let registration: Promise<ServiceWorkerRegistration> | undefined;

export function registerWorker() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return Promise.reject(new Error("Installation and notifications require HTTPS (or localhost) and a supported browser."));
  registration ??= navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(async worker => {
      if (worker.active) return worker;
      return await new Promise<ServiceWorkerRegistration>((resolve, reject) => {
        const candidate = worker.installing ?? worker.waiting;
        if (!candidate) { reject(new Error("The app service worker did not start.")); return; }
        const timeout = setTimeout(() => reject(new Error("The app service worker did not become ready. Reload and try again.")), 20_000);
        candidate.addEventListener("statechange", () => {
          if (candidate.state === "activated") { clearTimeout(timeout); resolve(worker); }
          if (candidate.state === "redundant") { clearTimeout(timeout); reject(new Error("The app service worker could not be installed.")); }
        });
      });
    }).catch(error => { registration = undefined; throw error; });
  return registration;
}
