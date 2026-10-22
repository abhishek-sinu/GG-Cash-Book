export type Book = {
  id: string;
  name: string;
  kind: "everyday" | "investment" | "savings";
  budget: number;
};

export type Entry = {
  id: string;
  bookId: string;
  destinationId: string;
  type: "in" | "out" | "transfer";
  amount: number;
  date: string;
  category: string;
  note: string;
};

export type Reminder = {
  id: string;
  title: string;
  bookId: string;
  destinationId: string;
  type: "out" | "transfer";
  amount: number;
  category: string;
  note: string;
  nextDate: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  anchorDay: number;
  paused: boolean;
};

export type Ledger = { version: 1; books: Book[]; entries: Entry[]; reminders?: Reminder[] };
export const emptyLedger: Ledger = { version: 1, books: [], entries: [] };
export const STORAGE_KEY = "gg-cash-book-ledger-v1";
const MAX_AMOUNT = 100_000_000_000;
const MAX_ENTRIES = 50_000;

export function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100);
}

export function amountFromText(text: string, allowZero = false) {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text.trim())) throw new Error("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = text.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (amount > MAX_AMOUNT || amount < (allowZero ? 0 : 1)) throw new Error("Amount must be positive and no more than INR 1,00,00,00,000.");
  return amount;
}

export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "2100-12-31") return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

export function validateLedger(input: unknown): Ledger {
  if (!record(input) || input.version !== 1 || !Array.isArray(input.books) || !Array.isArray(input.entries)) throw new Error("This is not a supported GG Cash Book backup.");
  if (input.books.length > 200 || input.entries.length > MAX_ENTRIES) throw new Error("Limit: 200 books and 50,000 entries.");
  const ids = new Set<string>();
  const names = new Set<string>();
  const books: Book[] = input.books.map((book: unknown) => {
    if (!record(book) || !text(book.id, 100) || !book.id || ids.has(book.id) || !text(book.name, 60) || !book.name.trim() || names.has(book.name.trim().toLowerCase()) || !["everyday", "investment", "savings"].includes(String(book.kind)) || typeof book.budget !== "number" || !Number.isSafeInteger(book.budget) || book.budget < 0 || book.budget > MAX_AMOUNT) throw new Error("Invalid book: use a unique name and a valid monthly budget.");
    ids.add(book.id);
    names.add(book.name.trim().toLowerCase());
    return { id: book.id, name: book.name.trim(), kind: book.kind as Book["kind"], budget: book.budget };
  });
  const entryIds = new Set<string>();
  const entries: Entry[] = input.entries.map((entry: unknown) => {
    if (!record(entry) || !text(entry.id, 100) || !entry.id || entryIds.has(entry.id) || !text(entry.bookId, 100) || !ids.has(entry.bookId) || !text(entry.destinationId, 100) || !["in", "out", "transfer"].includes(String(entry.type)) || typeof entry.amount !== "number" || !Number.isSafeInteger(entry.amount) || entry.amount < 1 || entry.amount > MAX_AMOUNT || !text(entry.date, 10) || !validDate(entry.date) || !text(entry.category, 60) || !entry.category.trim() || !text(entry.note, 500)) throw new Error("Invalid entry: check its book, date, amount, category, and notes.");
    if (entry.type === "transfer" ? !ids.has(entry.destinationId) || entry.destinationId === entry.bookId : entry.destinationId !== "") throw new Error("A transfer needs two different existing books.");
    entryIds.add(entry.id);
    return { id: entry.id, bookId: entry.bookId, destinationId: entry.destinationId, type: entry.type as Entry["type"], amount: entry.amount, date: entry.date, category: entry.category.trim(), note: entry.note };
  });
  const result: Ledger = { version: 1, books, entries };
  if (input.reminders !== undefined) {
    if (!Array.isArray(input.reminders) || input.reminders.length > 200) throw new Error("Limit: 200 recurring reminders.");
    const reminderIds = new Set<string>();
    result.reminders = input.reminders.map((value: unknown) => {
      if (!record(value) || !text(value.id, 60) || !value.id || reminderIds.has(value.id) || !text(value.title, 80) || !value.title.trim() || !text(value.bookId, 100) || !ids.has(value.bookId) || !text(value.destinationId, 100) || (value.type !== "out" && value.type !== "transfer") || typeof value.amount !== "number" || !Number.isSafeInteger(value.amount) || value.amount < 1 || value.amount > MAX_AMOUNT || !text(value.category, 60) || !value.category.trim() || !text(value.note, 500) || !text(value.nextDate, 10) || !validDate(value.nextDate) || !["weekly", "monthly", "quarterly", "yearly"].includes(String(value.frequency)) || typeof value.anchorDay !== "number" || !Number.isInteger(value.anchorDay) || value.anchorDay < 1 || value.anchorDay > 31 || typeof value.paused !== "boolean") throw new Error("Invalid recurring reminder. Check its title, amount, schedule, and book.");
      if (value.type === "transfer" ? !ids.has(value.destinationId) || value.destinationId === value.bookId : value.destinationId !== "") throw new Error("SIP transfers require two different books.");
      reminderIds.add(value.id);
      return { id: value.id, title: value.title.trim(), bookId: value.bookId, destinationId: value.destinationId, type: value.type, amount: value.amount, category: value.category.trim(), note: value.note, nextDate: value.nextDate, frequency: value.frequency as Reminder["frequency"], anchorDay: value.anchorDay, paused: value.paused };
    });
  }
  return result;
}

export function impact(entry: Entry, bookId: string) {
  if (entry.type === "transfer") return entry.destinationId === bookId ? entry.amount : entry.bookId === bookId ? -entry.amount : 0;
  return entry.bookId === bookId ? (entry.type === "in" ? entry.amount : -entry.amount) : 0;
}

export function balance(ledger: Ledger, bookId: string) {
  return ledger.entries.reduce((total, entry) => total + impact(entry, bookId), 0);
}

export function totals(ledger: Ledger, entries: Entry[]) {
  const incoming = entries.filter(e => e.type === "in").reduce((n, e) => n + e.amount, 0);
  const outgoing = entries.filter(e => e.type === "out").reduce((n, e) => n + e.amount, 0);
  const invested = entries.filter(e => {
    const target = ledger.books.find(b => b.id === (e.type === "transfer" ? e.destinationId : e.bookId));
    return target?.kind === "investment" && e.type !== "out";
  }).reduce((n, e) => n + e.amount, 0);
  const spending = entries.filter(e => e.type === "out" && ledger.books.find(b => b.id === e.bookId)?.kind !== "investment").reduce((n, e) => n + e.amount, 0);
  return { incoming, outgoing, invested, spending };
}

export function csv(ledger: Ledger, entries: Entry[]) {
  const cell = (value: string) => `"${(/^\s*[=+\-@]|^[\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  const rows = entries.map(e => [e.date, ledger.books.find(b => b.id === e.bookId)?.name ?? "", e.type, (e.amount / 100).toFixed(2), ledger.books.find(b => b.id === e.destinationId)?.name ?? "", e.category, e.note]);
  return [["Date", "Book", "Type", "Amount (INR)", "Transfer destination", "Category", "Notes"], ...rows].map(row => row.map(cell).join(",")).join("\r\n");
}
