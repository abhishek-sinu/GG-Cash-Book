import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { dueOccurrences, notificationBody } from "../src/lib/notification-plan.ts";

test("due alerts exclude future and paused reminders, and deduplicate scheduled occurrences", () => {
  const ledger = {
    reminders: [
      { id: "rent", nextDate: "2026-10-01", paused: false },
      { id: "sip", nextDate: "2026-10-21", paused: false },
      { id: "future", nextDate: "2026-10-22", paused: false },
      { id: "paused", nextDate: "2026-10-01", paused: true },
    ],
  };
  assert.deepEqual(dueOccurrences(ledger, "2026-10-21", []), ["rent:2026-10-01", "sip:2026-10-21"]);
  assert.deepEqual(dueOccurrences(ledger, "2026-10-21", ["rent:2026-10-01"]), ["sip:2026-10-21"]);
  assert.deepEqual(dueOccurrences({ reminders: [] }, "2026-10-21", []), []);
  assert.equal(notificationBody(1), "1 recurring reminder is due. Open GG Cash Book to review.");
  assert.equal(notificationBody(2), "2 recurring reminders are due. Open GG Cash Book to review.");
});

function workerHarness() {
  const handlers = {};
  const cached = [];
  const deleted = [];
  const focused = [];
  let failNetwork = false;
  const sandbox = {
    URL,
    self: {
      location: { origin: "https://cashbook.example" },
      skipWaiting: async () => {},
      clients: {
        claim: async () => {},
        matchAll: async () => [{ url: "https://cashbook.example/", postMessage: data => focused.push(data.type), focus: async () => focused.push("focus") }],
        openWindow: async url => focused.push(url),
      },
      addEventListener: (type, handler) => { handlers[type] = handler; },
    },
    caches: {
      open: async () => ({ addAll: async urls => cached.push(...urls) }),
      keys: async () => ["unrelated-cache", "gg-cash-book-public-old", "gg-cash-book-public-v1"],
      delete: async key => deleted.push(key),
      match: async key => key === "/offline.html" ? "offline-document" : "public-icon",
    },
    fetch: async () => { if (failNetwork) throw new Error("offline"); return "network-response"; },
  };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), sandbox);
  return { handlers, cached, deleted, focused, fail: () => { failNetwork = true; } };
}

test("service worker caches only public offline assets and never touches private APIs", async () => {
  const { handlers, cached, deleted } = workerHarness();
  let pending;
  handlers.install({ waitUntil: task => { pending = task; } });
  await pending;
  assert.equal(cached.length, 5);
  assert.ok(cached.every(path => path === "/offline.html" || path.startsWith("/icons/")));
  handlers.activate({ waitUntil: task => { pending = task; } });
  await pending;
  assert.deepEqual(deleted, ["gg-cash-book-public-old"]);
  for (const request of [
    { url: "https://cashbook.example/api/ledger", method: "GET", mode: "navigate" },
    { url: "https://cashbook.example/api/account", method: "POST" },
    { url: "https://other.example/", method: "GET", mode: "navigate" },
    { url: "https://cashbook.example/?_rsc=private", method: "GET", mode: "cors" },
  ]) {
    let intercepted = false;
    handlers.fetch({ request, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});

test("navigation falls back offline and notification taps focus reminders", async () => {
  const harness = workerHarness();
  const request = { url: "https://cashbook.example/", method: "GET", mode: "navigate" };
  let response;
  harness.handlers.fetch({ request, respondWith: task => { response = task; } });
  assert.equal(await response, "network-response");
  harness.fail();
  harness.handlers.fetch({ request, respondWith: task => { response = task; } });
  assert.equal(await response, "offline-document");
  let pending;
  let closed = false;
  harness.handlers.notificationclick({ notification: { close: () => { closed = true; } }, waitUntil: task => { pending = task; } });
  await pending;
  assert.equal(closed, true);
  assert.deepEqual(harness.focused, ["OPEN_REMINDERS", "focus"]);
});

test("PWA PNG assets have correct dimensions", () => {
  for (const [file, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["maskable-512.png", 512], ["apple-touch-icon.png", 180]]) {
    const data = readFileSync(new URL(`../public/icons/${file}`, import.meta.url));
    assert.equal(data.toString("ascii", 1, 4), "PNG");
    assert.equal(data.readUInt32BE(16), size);
    assert.equal(data.readUInt32BE(20), size);
  }
});
