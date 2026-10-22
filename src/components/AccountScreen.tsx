"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, Wallet } from "lucide-react";
import { authenticate, loadAccount } from "@/store/ledger";
import { credentials } from "@/lib/account-validation";
import { Field } from "@/components/ui/FormControls";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AccountScreen({ serviceError }: { serviceError: string }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const data = credentials({ name: form.get("name"), email: form.get("email"), password: form.get("password") }, register);
      if (register && form.get("password") !== form.get("confirm")) throw new Error("Passwords do not match.");
      await authenticate(register ? "register" : "login", data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Account request failed."); }
    finally { setBusy(false); }
  }
  return (
    <div className="mx-auto min-h-svh max-w-5xl px-5">
      <header className="app-header"><div className="flex items-center gap-3"><Wallet aria-hidden="true" /><h1 className="font-semibold">GG Cash Book</h1></div><ThemeToggle /></header>
      <main className="mx-auto max-w-md py-12">
        <div className="mb-7"><LockKeyhole className="mb-4 text-accent" aria-hidden="true" /><h2 className="font-display text-4xl">{register ? "Create your account" : "Welcome back"}</h2><p className="mt-3 text-sm leading-6 text-muted">Your private cash books and recurring reminders, saved to your MongoDB account.</p></div>
        <form onSubmit={submit} className="panel grid gap-5" aria-busy={busy}>
          <fieldset disabled={busy} className="grid min-w-0 gap-5">
            {register && <Field label="Your name"><input name="name" autoComplete="name" required maxLength={60} /></Field>}
            <Field label="Email address"><input name="email" type="email" autoComplete="email" required maxLength={254} /></Field>
            <Field label="Password"><input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={12} maxLength={72} /></Field>
            {register && <><Field label="Confirm password"><input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={72} /></Field><p className="text-xs leading-6 text-muted">Use a unique password of at least 12 characters (maximum 72 UTF-8 bytes). Email verification and password recovery are not available yet—keep your password safe.</p></>}
            {(error || serviceError) && <p role="alert" className="form-error">{error || serviceError}</p>}
            <button className="button primary" type="submit">{busy ? "Please wait..." : register ? "Create account" : "Sign in"}</button>
          </fieldset>
          <button type="button" disabled={busy} className="text-button justify-center" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Already registered? Sign in" : "New here? Create account"}</button>
          {serviceError && <button type="button" className="text-button justify-center" onClick={() => { void loadAccount(); }}>Retry connection</button>}
        </form>
        <p className="mt-5 text-xs leading-6 text-muted">Sessions expire after 7 days. Existing browser-only records are not shared with accounts automatically. After signing in, use Import old browser data or Restore backup to migrate them.</p>
      </main>
    </div>
  );
}
