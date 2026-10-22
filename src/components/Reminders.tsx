"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bell, Plus } from "lucide-react";
import { toast } from "sonner";
import { amountFromText, money, today, type Ledger, type Reminder } from "@/lib/ledger";
import { applyOccurrence } from "@/lib/recurring";
import { saveLedger } from "@/store/ledger";
import { Field, Modal } from "@/components/ui/FormControls";

type Editor = { action: "edit"; reminder?: Reminder } | { action: "record" | "skip" | "delete"; reminder: Reminder } | null;

function ReminderForm({ ledger, selected, reminder, submit, close }: { ledger: Ledger; selected: string; reminder?: Reminder; submit: (value: Reminder) => Promise<void>; close: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<Reminder["type"]>(reminder?.type ?? "out");
  const [source, setSource] = useState(reminder?.bookId ?? (selected !== "all" ? selected : ledger.books[0]?.id ?? ""));
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const frequency = String(form.get("frequency"));
      if (frequency !== "weekly" && frequency !== "monthly" && frequency !== "quarterly" && frequency !== "yearly") throw new Error("Choose a valid repeat frequency.");
      const date = String(form.get("date"));
      await submit({
        id: reminder?.id ?? crypto.randomUUID(), title: String(form.get("title")).trim(),
        type, bookId: source, destinationId: type === "transfer" ? String(form.get("destination")) : "",
        amount: amountFromText(String(form.get("amount"))), category: String(form.get("category")).trim(),
        note: String(form.get("note")).trim(), nextDate: date, frequency,
        anchorDay: reminder && reminder.nextDate === date ? reminder.anchorDay : Number(date.slice(-2)),
        paused: reminder?.paused ?? false,
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Reminder could not be saved."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit} className="editor-form" aria-busy={busy}>
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <Field label="Reminder name"><input name="title" required maxLength={80} defaultValue={reminder?.title} placeholder="Rent or monthly SIP" autoFocus /></Field>
        <Field label="Reminder type"><select value={type} onChange={event => setType(event.target.value === "transfer" ? "transfer" : "out")}><option value="out">Recurring expense (Cash Out)</option><option value="transfer">SIP / savings transfer between books</option></select></Field>
        <Field label={type === "transfer" ? "From book" : "Expense book"}><select value={source} required onChange={event => setSource(event.target.value)}>{ledger.books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></Field>
        {type === "transfer" && <Field label="To investment / savings book"><select key={source} name="destination" required defaultValue={reminder?.destinationId !== source ? reminder?.destinationId : undefined}>{ledger.books.filter(book => book.id !== source).map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></Field>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Recurring amount (INR)"><input name="amount" inputMode="decimal" required defaultValue={reminder ? String(reminder.amount / 100) : ""} placeholder="0.00" /></Field><Field label="Next due date"><input name="date" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={reminder?.nextDate ?? today()} /></Field></div>
        <Field label="Repeat"><select name="frequency" defaultValue={reminder?.frequency ?? "monthly"}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></Field>
        <Field label="Recurring category"><input name="category" required maxLength={60} defaultValue={reminder?.category ?? (type === "transfer" ? "SIP" : "")} placeholder="e.g. Rent, SIP, Insurance" /></Field>
        <Field label="Reminder notes (optional)"><textarea name="note" rows={2} maxLength={500} defaultValue={reminder?.note} /></Field>
        <p className="text-xs leading-6 text-muted">No automatic payments or entries. Record or skip one due occurrence at a time. Month-end dates clamp to the last day, then return to the original day in later months.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="form-actions"><button type="button" className="button" onClick={close}>Cancel</button><button className="button primary" type="submit">{busy ? "Saving..." : "Save reminder"}</button></div>
      </fieldset>
    </form>
  );
}

export function Reminders({ ledger, selected, disabled }: { ledger: Ledger; selected: string; disabled: boolean }) {
  const [date, setDate] = useState(today);
  const [editor, setEditor] = useState<Editor>(null);
  const [base, setBase] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setDate(today()), 60_000);
    return () => clearInterval(id);
  }, []);
  const reminders = [...(ledger.reminders ?? [])].filter(item => selected === "all" || item.bookId === selected || item.destinationId === selected).sort((a, b) => Number(a.paused) - Number(b.paused) || a.nextDate.localeCompare(b.nextDate));
  const due = reminders.filter(item => !item.paused && item.nextDate <= date).length;
  function open(value: Editor) { setBase(ledger); setError(""); setEditor(value); }
  async function commit(next: Ledger) {
    if (base !== ledger) throw new Error("Records changed while this dialog was open. Close it and review the latest records.");
    await saveLedger(next);
    setEditor(null);
    toast.success("Recurring reminder updated.");
  }
  async function confirm() {
    if (!editor || editor.action === "edit") return;
    setBusy(true); setError("");
    try {
      await commit(editor.action === "delete" ? { ...ledger, reminders: ledger.reminders?.filter(item => item.id !== editor.reminder.id) } : applyOccurrence(ledger, editor.reminder.id, editor.action, today()));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Occurrence could not be updated."); }
    finally { setBusy(false); }
  }
  async function pause(reminder: Reminder) {
    setBusy(true); setError("");
    try {
      await saveLedger({ ...ledger, reminders: ledger.reminders?.map(item => item.id === reminder.id ? { ...item, paused: !item.paused } : item) });
      toast.success(reminder.paused ? "Reminder resumed." : "Reminder paused.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Reminder could not be updated."); }
    finally { setBusy(false); }
  }
  return (
    <section id="reminders" className="panel mb-7" aria-labelledby="reminders-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 id="reminders-heading" className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-semibold"><Bell size={19} aria-hidden="true" /> Recurring & SIP reminders {due > 0 && <span className="expense-text text-xs">{due} due</span>}</h3><button className="button no-print" disabled={disabled || busy || !ledger.books.length} onClick={() => open({ action: "edit" })}><Plus size={16} aria-hidden="true" /> Add reminder</button></div>
      <p className="mb-4 text-xs leading-6 text-muted">Enable device alerts in the side menu for due reminders while the app is open. No background push, email, automatic debit, or automatic entry. Due dates use your device&apos;s local calendar.</p>
      {!ledger.books.length ? <p className="text-sm text-muted">Create a book to schedule expenses or SIPs.</p> : !reminders.length ? <p className="text-sm text-muted">No reminders for this book yet. Add rent, subscriptions, or a recurring SIP transfer.</p> : <div className="grid gap-3">{reminders.map(item => <article key={item.id} className="reminder-row">
        <div className="min-w-0 flex-1"><h4 className="break-words font-medium">{item.title} <span className={`ml-2 text-xs ${!item.paused && item.nextDate <= date ? "expense-text" : "text-muted"}`}>{item.paused ? "Paused" : item.nextDate < date ? "Overdue" : item.nextDate === date ? "Due today" : "Upcoming"}</span></h4><p className="mt-1 break-words text-xs leading-6 text-muted">{money(item.amount)} · {item.nextDate} · {item.frequency} · {ledger.books.find(book => book.id === item.bookId)?.name}{item.type === "transfer" ? ` → ${ledger.books.find(book => book.id === item.destinationId)?.name}` : " · Cash Out"}</p></div>
        <div className="flex flex-wrap items-center gap-3 no-print"><button className="button primary" disabled={disabled || busy || item.paused || item.nextDate > date} onClick={() => open({ action: "record", reminder: item })}>Record payment</button><button className="text-button" disabled={disabled || busy || item.paused || item.nextDate > date} onClick={() => open({ action: "skip", reminder: item })}>Skip once</button><button className="text-button" disabled={disabled || busy} onClick={() => open({ action: "edit", reminder: item })}>Edit reminder</button><button className="text-button" disabled={disabled || busy} onClick={() => { void pause(item); }}>{item.paused ? "Resume" : "Pause"}</button><button className="text-button danger-text" disabled={disabled || busy} onClick={() => open({ action: "delete", reminder: item })}>Delete reminder</button></div>
      </article>)}</div>}
      {error && !editor && <p className="form-error mt-4" role="alert">{error}</p>}
      {editor && <Modal title={editor.action === "edit" ? editor.reminder ? "Edit recurring reminder" : "New recurring reminder" : editor.action === "record" ? "Record this occurrence?" : editor.action === "skip" ? "Skip this occurrence?" : "Delete recurring reminder?"} close={() => { if (!busy && !disabled) setEditor(null); }}>
        {editor.action === "edit" ? <ReminderForm ledger={ledger} selected={selected} reminder={editor.reminder} close={() => setEditor(null)} submit={value => commit({ ...ledger, reminders: editor.reminder ? ledger.reminders?.map(item => item.id === value.id ? value : item) : [...(ledger.reminders ?? []), value] })} /> : <div className="editor-form"><p className="text-sm leading-7">{editor.reminder.title} · {money(editor.reminder.amount)} · Due {editor.reminder.nextDate}</p><p className="text-sm leading-7 text-muted">{editor.action === "record" ? "Creates one dated cash-out or linked transfer and advances the schedule once. Confirm only after making the payment. Deleting the resulting transaction later does not rewind the schedule." : editor.action === "skip" ? "Advances the schedule once without adding a financial entry. This cannot be undone automatically." : "Removes future reminders. Previously recorded transactions are kept."}</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button className="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button className="button primary" disabled={disabled || busy} onClick={() => { void confirm(); }}>{busy ? "Saving..." : editor.action === "record" ? "Confirm payment" : editor.action === "skip" ? "Confirm skip" : "Confirm delete reminder"}</button></div></div>}
      </Modal>}
    </section>
  );
}
