import assert from "node:assert/strict";
import { test } from "node:test";
import { amountFromText, balance, csv, impact, totals, validateLedger } from "../src/lib/ledger.ts";

const books = [
  { id: "home", name: "Monthly Expenses", kind: "everyday", budget: 50000 },
  { id: "fund", name: "Mutual Funds", kind: "investment", budget: 0 },
];
const income = { id: "1", bookId: "home", destinationId: "", type: "in", amount: 100000, date: "2026-10-01", category: "Salary", note: "" };
const expense = { ...income, id: "2", type: "out", amount: 12550, category: "Groceries" };
const transfer = { ...income, id: "3", type: "transfer", amount: 20000, destinationId: "fund", category: "Transfer" };
const ledger = { version: 1, books, entries: [income, expense, transfer] };

test("decimal amounts use exact integer paise", () => {
  assert.equal(amountFromText("0.29"), 29);
  assert.equal(amountFromText("1234.5"), 123450);
  assert.equal(amountFromText("0", true), 0);
  for (const invalid of ["0", "-1", "1.001", "NaN", "1e3", "1,000", "1000000001", ""]) {
    assert.throws(() => amountFromText(invalid));
  }
});

test("transfers update both sides and preserve combined balance", () => {
  assert.equal(balance(ledger, "home"), 67450);
  assert.equal(balance(ledger, "fund"), 20000);
  assert.equal(balance(ledger, "home") + balance(ledger, "fund"), 87450);
  assert.equal(impact(transfer, "home") + impact(transfer, "fund"), 0);
  assert.equal(impact(transfer, "unrelated"), 0);
});

test("transfers are excluded from income and cash out, investments distinguished", () => {
  assert.deepEqual(totals(ledger, ledger.entries), { incoming: 100000, outgoing: 12550, spending: 12550, invested: 20000 });
  const redemption = { ...expense, id: "4", bookId: "fund", amount: 5000 };
  assert.equal(totals(ledger, [redemption]).spending, 0);
  assert.equal(totals(ledger, [redemption]).outgoing, 5000);
});

test("editing and removing a transfer recalculates both balances", () => {
  const edited = { ...ledger, entries: [income, expense, { ...transfer, amount: 30000 }] };
  assert.equal(balance(edited, "home"), 57450);
  assert.equal(balance(edited, "fund"), 30000);
  const deleted = { ...ledger, entries: [income, expense] };
  assert.equal(balance(deleted, "home"), 87450);
  assert.equal(balance(deleted, "fund"), 0);
});

test("backups round-trip and retain integer precision", () => {
  assert.deepEqual(validateLedger(JSON.parse(JSON.stringify(ledger))), ledger);
});

test("reject invalid backups, duplicate IDs/names and broken book references", () => {
  for (const invalid of [
    null, {}, { ...ledger, version: 2 },
    { ...ledger, books: [books[0], { ...books[1], name: " monthly expenses " }] },
    { ...ledger, books: [books[0], books[0]] },
    { ...ledger, entries: [income, income] },
    { ...ledger, entries: [{ ...income, bookId: "missing" }] },
    { ...ledger, entries: [{ ...transfer, destinationId: "home" }] },
    { ...ledger, entries: [{ ...transfer, destinationId: "missing" }] },
    { ...ledger, entries: [{ ...income, destinationId: "fund" }] },
    { ...ledger, entries: [{ ...income, amount: 1.2 }] },
    { ...ledger, entries: [{ ...income, amount: -100 }] },
    { ...ledger, entries: [{ ...income, amount: Number.MAX_SAFE_INTEGER }] },
    { ...ledger, entries: [{ ...income, date: "2026-02-30" }] },
    { ...ledger, entries: [{ ...income, category: "" }] },
    { ...ledger, entries: [{ ...income, note: "x".repeat(501) }] },
    { ...ledger, books: [{ ...books[0], budget: -1 }] },
  ]) assert.throws(() => validateLedger(invalid));
});

test("valid leap-day accepted and negative balances are supported", () => {
  assert.equal(validateLedger({ ...ledger, entries: [{ ...income, date: "2024-02-29" }] }).entries.length, 1);
  assert.equal(balance({ ...ledger, entries: [expense] }, "home"), -12550);
});

test("CSV escapes quotes, multiline notes, and spreadsheet formulas", () => {
  const output = csv(ledger, [{ ...income, note: ' =SUM(1,2)\n"quoted"' }]);
  assert.ok(output.includes('"\' =SUM(1,2)\n""quoted"""'));
  assert.ok(output.includes('"1000.00"'));
  assert.equal(csv(ledger, []).split("\r\n").length, 1);
});
