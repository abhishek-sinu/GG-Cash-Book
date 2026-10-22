import assert from "node:assert/strict";
import { test } from "node:test";
import { nextOccurrence, applyOccurrence } from "../src/lib/recurring.ts";
import { balance, validateLedger } from "../src/lib/ledger.ts";

const reminder = { id: "rent", title: "Monthly rent", bookId: "home", destinationId: "", type: "out", amount: 50000, category: "Rent", note: "", nextDate: "2026-01-31", frequency: "monthly", anchorDay: 31, paused: false };
const ledger = { version: 1, books: [{ id: "home", name: "Home", kind: "everyday", budget: 0 }, { id: "fund", name: "Fund", kind: "investment", budget: 0 }], entries: [], reminders: [reminder] };

test("month-end schedules clamp without drifting from their original day", () => {
  assert.equal(nextOccurrence(reminder), "2026-02-28");
  assert.equal(nextOccurrence({ ...reminder, nextDate: "2026-02-28" }), "2026-03-31");
  assert.equal(nextOccurrence({ ...reminder, nextDate: "2024-01-31" }), "2024-02-29");
});

test("weekly, quarterly and yearly recurrence handles rollover and leap years", () => {
  assert.equal(nextOccurrence({ ...reminder, nextDate: "2026-12-28", frequency: "weekly" }), "2027-01-04");
  assert.equal(nextOccurrence({ ...reminder, frequency: "quarterly" }), "2026-04-30");
  assert.equal(nextOccurrence({ ...reminder, frequency: "yearly", nextDate: "2024-02-29", anchorDay: 29 }), "2025-02-28");
  assert.equal(nextOccurrence({ ...reminder, frequency: "yearly", nextDate: "2027-02-28", anchorDay: 29 }), "2028-02-29");
});

test("record creates exactly one scheduled entry and advances exactly once", () => {
  const next = applyOccurrence(ledger, "rent", "record", "2026-02-01");
  assert.equal(next.entries.length, 1);
  assert.equal(next.entries[0].date, "2026-01-31");
  assert.equal(balance(next, "home"), -50000);
  assert.equal(next.reminders[0].nextDate, "2026-02-28");
  assert.equal(ledger.entries.length, 0);
  assert.throws(() => applyOccurrence({ ...ledger, entries: next.entries }, "rent", "record", "2026-02-01"), /already/);
  assert.throws(() => applyOccurrence(next, "rent", "record", "2026-02-01"), /not due/);
});

test("SIP records a single transfer without changing combined balances", () => {
  const next = applyOccurrence({ ...ledger, reminders: [{ ...reminder, type: "transfer", destinationId: "fund" }] }, "rent", "record", "2026-01-31");
  assert.equal(balance(next, "home"), -50000);
  assert.equal(balance(next, "fund"), 50000);
  assert.equal(next.entries[0].type, "transfer");
});

test("skip advances without adding entries; paused or future reminders cannot record", () => {
  const next = applyOccurrence(ledger, "rent", "skip", "2026-01-31");
  assert.equal(next.entries.length, 0);
  assert.equal(next.reminders[0].nextDate, "2026-02-28");
  assert.throws(() => applyOccurrence({ ...ledger, reminders: [{ ...reminder, paused: true }] }, "rent", "record", "2026-02-01"), /paused/);
  assert.throws(() => applyOccurrence(ledger, "rent", "record", "2026-01-01"), /not due/);
  assert.throws(() => nextOccurrence({ ...reminder, nextDate: "2100-12-31" }), /range/);
});

test("reminders survive backup round-trip and legacy backups remain supported", () => {
  assert.deepEqual(validateLedger(JSON.parse(JSON.stringify(ledger))), ledger);
  const legacy = { version: ledger.version, books: ledger.books, entries: ledger.entries };
  assert.deepEqual(validateLedger(legacy), legacy);
  assert.throws(() => validateLedger({ ...ledger, reminders: [reminder, reminder] }));
  for (const patch of [{ amount: 0 }, { nextDate: "2026-02-30" }, { bookId: "missing" }, { frequency: "daily" }, { anchorDay: 0 }, { paused: "no" }, { destinationId: "fund" }, { type: "transfer", destinationId: "home" }]) {
    assert.throws(() => validateLedger({ ...ledger, reminders: [{ ...reminder, ...patch }] }));
  }
  assert.throws(() => validateLedger({ ...ledger, books: [ledger.books[1]] }), /reminder/);
});
