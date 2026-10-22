import { validDate, validateLedger, type Ledger, type Reminder } from "./ledger.ts";

export function nextOccurrence(reminder: Reminder) {
  const [year, month, day] = reminder.nextDate.split("-").map(Number);
  let date: Date;
  if (reminder.frequency === "weekly") date = new Date(Date.UTC(year, month - 1, day + 7));
  else {
    const months = reminder.frequency === "monthly" ? 1 : reminder.frequency === "quarterly" ? 3 : 12;
    const first = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(reminder.anchorDay, lastDay)));
  }
  const result = date.toISOString().slice(0, 10);
  if (!validDate(result)) throw new Error("The next occurrence is outside the supported date range.");
  return result;
}

export function applyOccurrence(ledger: Ledger, reminderId: string, action: "record" | "skip", currentDate: string): Ledger {
  const reminder = ledger.reminders?.find(item => item.id === reminderId);
  if (!reminder || reminder.paused) throw new Error("This reminder is unavailable or paused.");
  if (!validDate(currentDate) || reminder.nextDate > currentDate) throw new Error("This occurrence is not due yet.");
  const entryId = `recurring:${reminder.id}:${reminder.nextDate}`;
  if (action === "record" && ledger.entries.some(entry => entry.id === entryId)) throw new Error("This occurrence has already been recorded.");
  const nextDate = nextOccurrence(reminder);
  return validateLedger({
    ...ledger,
    entries: action === "skip" ? ledger.entries : [...ledger.entries, {
      id: entryId,
      bookId: reminder.bookId,
      destinationId: reminder.destinationId,
      type: reminder.type,
      amount: reminder.amount,
      date: reminder.nextDate,
      category: reminder.category,
      note: [reminder.title, reminder.note].filter(Boolean).join(" · ").slice(0, 500),
    }],
    reminders: ledger.reminders?.map(item => item.id === reminderId ? { ...item, nextDate } : item),
  });
}
