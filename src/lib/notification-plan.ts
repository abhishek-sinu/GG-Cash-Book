import type { Ledger } from "./ledger";

export function dueOccurrences(ledger: Ledger, date: string, alreadySent: string[]) {
  const sent = new Set(alreadySent);
  return (ledger.reminders ?? [])
    .filter(reminder => !reminder.paused && reminder.nextDate <= date)
    .map(reminder => `${reminder.id}:${reminder.nextDate}`)
    .filter(key => !sent.has(key))
    .sort();
}

export function notificationBody(count: number) {
  return `${count} recurring reminder${count === 1 ? " is" : "s are"} due. Open GG Cash Book to review.`;
}
