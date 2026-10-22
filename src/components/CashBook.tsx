"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, BookOpen, Download, Menu, Plus, Printer, Search, Upload, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { amountFromText, balance, csv, impact, money, STORAGE_KEY, today, totals, validateLedger, type Book, type Entry, type Ledger } from "@/lib/ledger";
import { loadAccount, logout, saveLedger, useLedger } from "@/store/ledger";
import { Modal, Field } from "@/components/ui/FormControls";
import { AccountScreen } from "@/components/AccountScreen";
import { Reminders } from "@/components/Reminders";
import { ReminderNotifications } from "@/components/ReminderNotifications";

type Editor = { kind: "book"; book?: Book } | { kind: "entry"; type: Entry["type"]; entry?: Entry } | { kind: "delete"; entity: Book | Entry; entityType: "book" | "entry" } | { kind: "restore"; ledger: Ledger } | null;
const kinds = { everyday: "Everyday expenses", investment: "Investment", savings: "Savings" };
const categories = ["Salary", "Groceries", "Bills", "Rent", "Transport", "Health", "Entertainment", "Mutual funds", "Investment", "Savings", "Opening balance", "Other"];

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BookForm({ book, submit, close }: { book?: Book; submit: (book: Book) => Promise<void>; close: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const kind = String(form.get("kind"));
      if (kind !== "everyday" && kind !== "investment" && kind !== "savings") throw new Error("Choose a book purpose.");
      await submit({ id: book?.id ?? crypto.randomUUID(), name: String(form.get("name")).trim(), kind, budget: amountFromText(String(form.get("budget") || "0"), true) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Book could not be saved."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit} className="editor-form">
      <Field label="Book name"><input name="name" required maxLength={60} defaultValue={book?.name} placeholder="e.g. Monthly Expenses" autoFocus /></Field>
      <Field label="Purpose"><select name="kind" defaultValue={book?.kind ?? "everyday"}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Monthly cash-out budget (INR, optional)"><input name="budget" inputMode="decimal" defaultValue={book ? String(book.budget / 100) : ""} placeholder="0.00" /></Field>
      <p className="text-sm leading-6 text-muted">Books start at zero. Add an opening balance as a Cash In entry. Budgets track cash out, not transfers.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions"><button disabled={busy} type="button" className="button" onClick={close}>Cancel</button><button disabled={busy} className="button primary" type="submit">{busy ? "Saving..." : "Save book"}</button></div>
    </form>
  );
}

function EntryForm({ books, selected, type, entry, submit, close }: { books: Book[]; selected: string; type: Entry["type"]; entry?: Entry; submit: (entry: Entry) => Promise<void>; close: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(entry?.bookId ?? (selected !== "all" ? selected : books[0]?.id ?? ""));
  const destinations = books.filter(book => book.id !== source);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await submit({
        id: entry?.id ?? crypto.randomUUID(),
        bookId: source,
        type,
        destinationId: type === "transfer" ? String(form.get("destination")) : "",
        amount: amountFromText(String(form.get("amount"))),
        date: String(form.get("date")),
        category: type === "transfer" ? "Transfer" : String(form.get("category")).trim(),
        note: String(form.get("note")).trim(),
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Entry could not be saved."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit} className="editor-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (INR)"><input name="amount" inputMode="decimal" required placeholder="0.00" defaultValue={entry ? String(entry.amount / 100) : ""} autoFocus /></Field>
        <Field label="Date"><input name="date" type="date" required min="1900-01-01" max="2100-12-31" defaultValue={entry?.date ?? today()} /></Field>
      </div>
      <Field label={type === "transfer" ? "From book" : "Book"}><select name="book" value={source} onChange={event => setSource(event.target.value)} required>{books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></Field>
      {type === "transfer" ? <>
        <Field label="To book"><select name="destination" key={source} defaultValue={entry?.destinationId && entry.destinationId !== source ? entry.destinationId : destinations[0]?.id} required>{destinations.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></Field>
        <p className="text-sm leading-6 text-muted">One linked transfer updates both balances. It does not count as income or cash out. Negative book balances are allowed.</p>
      </> : <Field label="Category"><input name="category" list="categories" required maxLength={60} defaultValue={entry?.category} placeholder="Choose or type a category" /><datalist id="categories">{categories.map(category => <option key={category}>{category}</option>)}</datalist></Field>}
      <Field label="Notes (optional)"><textarea name="note" maxLength={500} rows={3} defaultValue={entry?.note} placeholder="What was this for?" /></Field>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions"><button disabled={busy} type="button" className="button" onClick={close}>Cancel</button><button disabled={busy} className="button primary" type="submit">{busy ? "Saving..." : `Save ${type === "transfer" ? "transfer" : "entry"}`}</button></div>
    </form>
  );
}

export function CashBook() {
  const state = useLedger();
  if (!state.ready) return <main className="p-10" aria-busy="true">Opening your account...</main>;
  if (!state.user) return <AccountScreen serviceError={state.error} />;
  return <CashBookWorkspace key={state.user.id} state={state} />;
}

function CashBookWorkspace({ state }: { state: ReturnType<typeof useLedger> }) {
  const { ledger, error: storageError, ready, user, saving } = state;
  const [selected, setSelected] = useState("all");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("all");
  const [editor, setEditor] = useState<Editor>(null);
  const [editorBase, setEditorBase] = useState<Ledger | null>(null);
  const [actionError, setActionError] = useState("");
  const [page, setPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dialog = navigation.current;
    if (!dialog) return;
    const mobile = matchMedia("(max-width: 760px)");
    const previousOverflow = document.body.style.overflow;
    function sync() {
      if (!dialog) return;
      dialog.close();
      if (mobile.matches) {
        if (menuOpen) dialog.showModal();
        document.body.style.overflow = menuOpen ? "hidden" : previousOverflow;
      } else {
        dialog.show();
        document.body.style.overflow = previousOverflow;
      }
    }
    sync();
    mobile.addEventListener("change", sync);
    return () => {
      mobile.removeEventListener("change", sync);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);
  const currentBook = ledger.books.find(book => book.id === selected);
  const active = currentBook?.id ?? "all";
  const month = today().slice(0, 7);
  const filtered = ledger.entries.filter(entry => {
    const book = ledger.books.find(book => book.id === entry.bookId);
    const destination = ledger.books.find(book => book.id === entry.destinationId);
    return (active === "all" || entry.bookId === active || entry.destinationId === active)
      && (type === "all" || entry.type === type)
      && (!from || entry.date >= from) && (!to || entry.date <= to)
      && (category === "all" || entry.category === category)
      && `${entry.note} ${entry.category} ${book?.name} ${destination?.name}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const summary = totals(ledger, filtered);
  const cashBalance = active === "all" ? ledger.books.reduce((n, book) => n + balance(ledger, book.id), 0) : balance(ledger, active);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const allCategories = [...new Set(ledger.entries.map(entry => entry.category))].sort();
  const rangeError = from && to && from > to;

  async function commit(next: Ledger) {
    if (editorBase !== ledger) throw new Error("Records changed while this dialog was open. Close it and review the latest records before trying again.");
    await saveLedger(next);
    setEditor(null);
    setActionError("");
    toast.success("Saved to your MongoDB account.");
  }
  function open(editor: Editor) { if (saving) return; setMenuOpen(false); setActionError(""); setEditorBase(ledger); setEditor(editor); }
  function addEntry(entryType: Entry["type"]) {
    if (!ledger.books.length) { toast.info("Create your first book before adding an entry."); open({ kind: "book" }); return; }
    if (entryType === "transfer" && ledger.books.length < 2) { toast.info("Create a second book to transfer money."); return; }
    open({ kind: "entry", type: entryType });
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    setMenuOpen(false);
    try {
      if (file.size > 30_000_000) throw new Error("Backup must be smaller than 30 MB.");
      const data = validateLedger(JSON.parse(await file.text()));
      open({ kind: "restore", ledger: data });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Backup could not be read.";
      setActionError(message);
      toast.error(message);
    }
  }
  async function confirmAction() {
    try {
      if (editorBase !== ledger) throw new Error("Records changed while this dialog was open. Close it and review the latest records before trying again.");
      if (editor?.kind === "restore") {
        await saveLedger(editor.ledger);
        setSelected("all"); setSearch(""); setCategory("all"); setType("all"); setFrom(""); setTo(""); setPage(1);
        setEditor(null); setActionError(""); toast.success("Backup restored to your account.");
      } else if (editor?.kind === "delete") {
        if (editor.entityType === "book") {
          if (ledger.entries.some(entry => entry.bookId === editor.entity.id || entry.destinationId === editor.entity.id)) throw new Error("Delete or move all related entries before deleting this book.");
          if (ledger.reminders?.some(reminder => reminder.bookId === editor.entity.id || reminder.destinationId === editor.entity.id)) throw new Error("Delete or move this book's recurring reminders first.");
          await commit({ ...ledger, books: ledger.books.filter(book => book.id !== editor.entity.id) });
          if (selected === editor.entity.id) setSelected("all");
        } else await commit({ ...ledger, entries: ledger.entries.filter(entry => entry.id !== editor.entity.id) });
      }
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Operation failed."); }
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="app-header">
        <button className="icon-button mobile-menu-toggle" aria-label="Open navigation" aria-controls="cashbook-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={21} aria-hidden="true" /></button>
        <div className="flex items-center gap-3"><span className="brand-icon"><Wallet size={23} aria-hidden="true" /></span><div><h1 className="text-lg font-semibold tracking-tight">GG Cash Book</h1><p className="text-xs text-muted">Every rupee, with a purpose.</p></div></div>
        <div className="desktop-account flex flex-wrap items-center justify-end gap-3"><span className="max-w-40 truncate text-xs text-muted" title={user?.email}>{user?.name}</span><button className="button" disabled={saving} onClick={async () => { try { await logout(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Sign out failed."); } }}>Sign out</button><ThemeToggle /></div>
      </header>
      <div className="storage-banner desktop-storage"><span className="status-dot" /><span className="min-w-0 flex-1 break-words"><strong>Private MongoDB account</strong> · {user?.email} · {saving ? "Saving..." : "Records saved on the server."} Device alerts are in the side menu.</span><button className="text-button shrink-0" disabled={saving} onClick={() => { void loadAccount(); }}>Reload records</button></div>
      <p className="mobile-save-status" role="status">{saving ? "Saving..." : storageError ? "Records unavailable — see error below." : "Saved to your private account"}</p>
      {!ready ? <main id="main" className="p-10" aria-busy="true">Opening your cash books...</main> : <>
        {storageError && <div className="form-error m-5" role="alert">{storageError}<button className="button mt-3" onClick={() => { void loadAccount(); }}>Retry loading records</button></div>}
        {actionError && !editor && <p className="form-error m-5" role="alert">{actionError}</p>}
        <div className="workspace">
          <dialog ref={navigation} id="cashbook-navigation" className="navigation-panel" aria-label="Navigation" onCancel={event => { event.preventDefault(); setMenuOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); } }} onClick={event => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
          <aside className="books-sidebar" aria-label="Cash books">
            <div className="mobile-navigation-heading"><h2 className="font-semibold">Menu</h2><button className="icon-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20} aria-hidden="true" /></button></div>
            <div className="mobile-account">
              <p className="font-semibold">{user?.name}</p><p className="mt-1 text-xs text-muted">{user?.email}</p>
              <div className="mt-3 flex flex-wrap gap-3"><ThemeToggle /><button className="button" disabled={saving} onClick={async () => { try { await logout(); } catch (cause) { setMenuOpen(false); setActionError(cause instanceof Error ? cause.message : "Sign out failed."); } }}>Sign out</button></div>
              <button className="text-button mt-2" disabled={saving} onClick={() => { setMenuOpen(false); void loadAccount(); }}>Reload records</button>
            </div>
            <div className="mb-5 flex items-center justify-between gap-3"><h2 className="eyebrow">YOUR BOOKS</h2><button disabled={!!storageError} className="icon-button" onClick={() => open({ kind: "book" })} aria-label="Create book"><Plus size={19} /></button></div>
            <button className={`book-link ${active === "all" ? "selected" : ""}`} aria-pressed={active === "all"} onClick={() => { setSelected("all"); setPage(1); setMenuOpen(false); }}><BookOpen size={19} aria-hidden="true" /><span>All books</span><span className="ml-auto text-xs">{ledger.books.length}</span></button>
            <div className="book-list">{ledger.books.map(book => <button key={book.id} className={`book-link ${active === book.id ? "selected" : ""}`} aria-pressed={active === book.id} onClick={() => { setSelected(book.id); setPage(1); setMenuOpen(false); }}><span className={`book-dot ${book.kind}`} /><span className="min-w-0 flex-1"><span className="block truncate">{book.name}</span><span className="mt-1 block text-xs font-normal text-muted">{money(balance(ledger, book.id))}</span></span></button>)}</div>
            {!ledger.books.length && <p className="my-5 text-sm leading-6 text-muted">Keep monthly expenses, investments, and savings in separate books.</p>}
            <button className="button mt-4 w-full" disabled={!!storageError} onClick={() => open({ kind: "book" })}><Plus size={16} aria-hidden="true" /> New book</button>
            <div className="mt-9 border-t border-border pt-5">
              <h2 className="eyebrow mb-3">DATA & REPORTS</h2>
              <button className="utility-button" disabled={!!storageError} onClick={() => download(`gg-cash-book-backup-${today()}.json`, JSON.stringify(ledger, null, 2), "application/json")}><Download size={16} aria-hidden="true" /> Download backup</button>
              <button className="utility-button" onClick={() => upload.current?.click()}><Upload size={16} aria-hidden="true" /> Restore backup</button>
              <button className="utility-button" disabled={saving || !!storageError} onClick={() => {
                setMenuOpen(false);
                try {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  if (!raw) throw new Error("No old browser records exist on this origin. Restore a downloaded JSON backup instead.");
                  open({ kind: "restore", ledger: validateLedger(JSON.parse(raw)) });
                } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Browser records could not be read."); }
              }}>Import old browser data</button>
              <input ref={upload} className="hidden" type="file" accept=".json,application/json" aria-label="Backup file" onChange={event => { void restore(event.target.files?.[0]); event.target.value = ""; }} />
              <p className="mt-4 text-xs leading-5 text-muted">INR · Private account ledger.<br />Investment balances track cash, not market value or returns.</p>
            </div>
            <div className="mt-6">{user && <ReminderNotifications userId={user.id} ledger={ledger} disabled={saving || !!storageError} />}</div>
          </aside>
          </dialog>

          <main id="main" tabIndex={-1} className="ledger-main">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 max-w-full"><p className="eyebrow mb-2">YOUR MONEY, AT A GLANCE</p><h2 className="font-display text-4xl sm:text-5xl">{currentBook?.name ?? "All your cash books"}</h2><p className="mt-2 text-sm text-muted">{currentBook ? kinds[currentBook.kind] : "A clear view of what comes in and where it goes."}</p></div>
              {currentBook && <div className="flex gap-2 no-print"><button className="button" disabled={!!storageError} onClick={() => open({ kind: "book", book: currentBook })}>Edit book</button><button className="button danger-text" disabled={!!storageError} onClick={() => open({ kind: "delete", entity: currentBook, entityType: "book" })}>Delete book</button></div>}
            </div>
            <section aria-label="Financial summary" className="summary-grid">
              <article className="summary-card balance-card"><p>Cash balance</p><strong>{money(cashBalance)}</strong><small>All dates · not portfolio value</small></article>
              <article className="summary-card"><p><ArrowDownLeft size={17} aria-hidden="true" /> Cash in</p><strong className="income-text">{money(summary.incoming)}</strong><small>Filtered entries · no transfers</small></article>
              <article className="summary-card"><p><ArrowUpRight size={17} aria-hidden="true" /> Cash out</p><strong className="expense-text">{money(summary.outgoing)}</strong><small>Filtered entries · no transfers</small></article>
            </section>
            <div className="mb-7 grid gap-3 sm:grid-cols-2">
              <div className="mini-stat"><span>Everyday / savings cash out</span><strong>{money(summary.spending)}</strong></div>
              <div className="mini-stat"><span>Added to investment books *</span><strong>{money(summary.invested)}</strong></div>
            </div>
            {ledger.books.some(book => book.budget > 0 && (active === "all" || active === book.id)) && <section className="panel mb-7" aria-label="Monthly budgets"><h3 className="mb-4 font-semibold">Monthly budgets <span className="text-sm font-normal text-muted">· {month} · independent of filters</span></h3><div className="grid gap-5 sm:grid-cols-2">{ledger.books.filter(book => book.budget > 0 && (active === "all" || active === book.id)).map(book => {
              const spent = ledger.entries.filter(entry => entry.bookId === book.id && entry.type === "out" && entry.date.startsWith(month)).reduce((n, entry) => n + entry.amount, 0);
              return <div key={book.id} className="min-w-0"><div className="mb-2 flex justify-between gap-2 text-sm"><span className="min-w-0 truncate">{book.name}</span><span className={`shrink-0 ${spent > book.budget ? "expense-text" : "text-muted"}`}>{Math.round(spent / book.budget * 100)}%</span></div><progress className="budget-progress" max={book.budget} value={Math.min(spent, book.budget)} aria-label={`${book.name} budget used`} /><p className="mt-1 break-words text-xs text-muted">{money(spent)} of {money(book.budget)}{spent > book.budget ? " · Over budget" : ""}</p></div>;
            })}</div></section>}
            <Reminders ledger={ledger} selected={active} disabled={saving || !!storageError} />
            <section className="panel" aria-labelledby="transactions-title">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h3 id="transactions-title" className="text-lg font-semibold">Transactions <span className="ml-1 text-sm font-normal text-muted">({filtered.length})</span></h3>
                <div className="flex flex-wrap gap-2 no-print">
                  <button disabled={!!storageError} className="button cash-in" onClick={() => addEntry("in")}><Plus size={16} aria-hidden="true" /> Cash In</button>
                  <button disabled={!!storageError} className="button cash-out" onClick={() => addEntry("out")}><Plus size={16} aria-hidden="true" /> Cash Out</button>
                  <button disabled={!!storageError} className="button" onClick={() => addEntry("transfer")}><ArrowRightLeft size={16} aria-hidden="true" /> Transfer</button>
                </div>
              </div>
              <div className="filters no-print">
                <label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Search transactions" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search notes, category, book..." /></label>
                <Field label="Type"><select value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="all">All types</option><option value="in">Cash In</option><option value="out">Cash Out</option><option value="transfer">Transfers</option></select></Field>
                <Field label="Category"><select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="all">All categories</option>{allCategories.map(value => <option key={value}>{value}</option>)}</select></Field>
                <Field label="From date"><input type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></Field>
                <Field label="To date"><input type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></Field>
              </div>
              {rangeError && <p className="form-error mb-4" role="alert">From date must be before or equal to To date.</p>}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted no-print"><div className="flex gap-4"><button className="text-button" onClick={() => { setSearch(""); setType("all"); setCategory("all"); setFrom(""); setTo(""); setPage(1); }}>Clear filters</button><button className="text-button" onClick={() => { setFrom(`${month}-01`); setTo(today()); setPage(1); }}>This month to date</button></div><div className="flex gap-4"><button className="text-button" disabled={!!storageError || !!rangeError} onClick={() => download(`gg-cash-book-report-${today()}.csv`, csv(ledger, filtered), "text/csv;charset=utf-8")}><Download size={14} aria-hidden="true" /> Export CSV</button><button className="text-button" onClick={() => window.print()}><Printer size={14} aria-hidden="true" /> Print / PDF</button></div></div>
              {!filtered.length ? <div className="empty-state"><BookOpen size={36} aria-hidden="true" /><h4 className="mt-4 text-lg font-semibold">{ledger.books.length ? "No transactions here yet" : "Your first book starts here"}</h4><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">{ledger.entries.length ? "Try another book or clear your filters." : "Create a book, then record your opening balance, income, or first expense. No sample money, just your records."}</p>{!ledger.books.length && <button disabled={!!storageError} className="button primary mx-auto mt-5" onClick={() => open({ kind: "book" })}><Plus size={16} /> Create your first book</button>}</div> : <div className="transaction-list">
                {visible.map(entry => {
                  const source = ledger.books.find(book => book.id === entry.bookId);
                  const destination = ledger.books.find(book => book.id === entry.destinationId);
                  const delta = active === "all" ? entry.type === "in" ? entry.amount : entry.type === "out" ? -entry.amount : 0 : impact(entry, active);
                  return <article key={entry.id} className="transaction-row">
                    <span className={`transaction-icon ${entry.type === "in" ? "income-text" : entry.type === "out" ? "expense-text" : "text-accent"}`}>{entry.type === "transfer" ? <ArrowRightLeft size={19} aria-hidden="true" /> : entry.type === "in" ? <ArrowDownLeft size={19} aria-hidden="true" /> : <ArrowUpRight size={19} aria-hidden="true" />}</span>
                    <div className="min-w-0 flex-1"><h4 className="truncate font-medium">{entry.category}</h4><p className="mt-1 text-xs text-muted">{entry.date} · {source?.name}{destination ? ` → ${destination.name}` : ""}</p>{entry.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{entry.note}</p>}</div>
                    <div className="shrink-0 text-right"><strong className={delta > 0 ? "income-text" : delta < 0 ? "expense-text" : "text-accent"}>{entry.type === "transfer" && active === "all" ? money(entry.amount) : `${delta > 0 ? "+" : ""}${money(delta)}`}</strong><p className="mt-1 text-xs text-muted">{entry.type === "transfer" ? "Transfer" : entry.type === "in" ? "Cash In" : "Cash Out"}</p><div className="mt-2 flex justify-end gap-3 no-print"><button disabled={!!storageError} className="text-button" aria-label={`Edit ${entry.category} ${entry.date}`} onClick={() => open({ kind: "entry", type: entry.type, entry })}>Edit</button><button disabled={!!storageError} className="text-button danger-text" aria-label={`Delete ${entry.category} ${entry.date}`} onClick={() => open({ kind: "delete", entity: entry, entityType: "entry" })}>Delete</button></div></div>
                  </article>;
                })}
                <div className="pagination"><span>Page {currentPage} of {pageCount} · {filtered.length} entries</span><div className="flex gap-2 no-print"><button className="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
              </div>}
            </section>
            <p className="mt-5 text-xs leading-6 text-muted">* Gross cash in and transfers into investment books, including transfers between investment books. Not profit, net contributions, or market value. Negative balances are allowed. CSV includes all filtered entries; print includes the current page.</p>
          </main>
        </div>
      </>}
      {editor && <Modal title={editor.kind === "book" ? editor.book ? "Edit book" : "Create a book" : editor.kind === "entry" ? `${editor.entry ? "Edit" : "Add"} ${editor.type === "transfer" ? "transfer" : editor.type === "in" ? "cash in" : "cash out"}` : editor.kind === "restore" ? "Restore backup?" : `Delete ${editor.entityType}?`} close={() => { if (!saving) setEditor(null); }}>
        {editor.kind === "book" && <BookForm book={editor.book} close={() => setEditor(null)} submit={book => commit({ ...ledger, books: editor.book ? ledger.books.map(old => old.id === book.id ? book : old) : [...ledger.books, book] })} />}
        {editor.kind === "entry" && <EntryForm books={ledger.books} selected={active} type={editor.type} entry={editor.entry} close={() => setEditor(null)} submit={entry => commit({ ...ledger, entries: editor.entry ? ledger.entries.map(old => old.id === entry.id ? entry : old) : [...ledger.entries, entry] })} />}
        {(editor.kind === "delete" || editor.kind === "restore") && <div className="editor-form">
          <p className="text-sm leading-7 text-muted">{editor.kind === "restore" ? `This replaces all current records with ${editor.ledger.books.length} books and ${editor.ledger.entries.length} entries. Download a backup of your current data first. This cannot be undone.` : editor.entityType === "book" ? "Only an empty book can be deleted. Remove or move its transactions first. This cannot be undone." : "This permanently removes the entry and recalculates balances. Deleting a transfer reverses both sides. This cannot be undone."}</p>
          {actionError && <p className="form-error" role="alert">{actionError}</p>}
          <div className="form-actions"><button disabled={saving} className="button" onClick={() => setEditor(null)}>Cancel</button><button disabled={saving} className="button primary" onClick={confirmAction}>{saving ? "Saving..." : editor.kind === "restore" ? "Replace and restore" : "Confirm delete"}</button></div>
        </div>}
      </Modal>}
    </div>
  );
}
