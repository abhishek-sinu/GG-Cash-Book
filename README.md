# GG Cash Book

A personal cash-book project for tracking money in and out across everyday
expenses, mutual funds, and other investments.

## Getting started

Use Node.js 22 LTS (22.23.2 or a compatible supported release) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

### Dependency security

The original baseline `next@16.3.2` had critical npm advisories,
including [a Windows-hosted server issue](https://github.com/advisories/GHSA-p293-qw3h-jr36).
The local preview uses patched `next@16.4.2` with matching
`eslint-config-next@16.4.2`. The framework advisory is no longer reported.
The audit still reports five high-severity findings in transitive lint dependencies
(`braces`, `micromatch`, `fast-glob`) without a compatible automatic fix.
Do not use `npm audit fix --force` to downgrade the framework tooling.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run ledger unit tests using Node's built-in test runner |
| `npm run db:check` | Verify the configured MongoDB connection with a read-only ping |
| `npx tsc --noEmit` | Check TypeScript |

## Current scope

The app is an **account-based personal cash ledger in INR**, backed by MongoDB:

- Register with email/password, sign in, and sign out of a private account.
- Create and rename separate everyday, investment, and savings books.
- Add, edit, and delete dated cash-in/out entries with custom categories and notes.
- Transfer money between books in a single linked record; editing/deleting it
  updates both balances. Transfers do not inflate income or cash-out totals.
- View all-time cash balances and filtered cash-in/out totals. Everyday/savings
  cash out is distinguished from cash added to investment books.
- Set monthly cash-out budgets with progress and over-budget indicators.
- Search and filter by book, category, type, and date, with paginated history.
- Export all filtered entries as CSV, or print/save the current page as PDF
  using the browser's print dialog.
- Download and restore validated JSON backups with replacement confirmation.
- Use a responsive interface, keyboard-accessible dialogs, and saved light/dark
  appearance.
- Schedule weekly, monthly, quarterly, or yearly expenses and SIP transfers,
  with due/overdue reminders, pause/resume, skip, and confirmed payment recording.
- Install as a PWA with home-screen icons, a safe offline landing page, and
  opt-in device alerts for due reminders while the app is open.

No fake money or prefilled transactions are created.

## How to use

1. Choose **Create account**, enter your name, email, and a unique password,
   then sign in. Open **New book** and create "Monthly Expenses". Set an optional monthly
   cash-out budget.
2. Select that book and use **Cash In** to record your opening balance or income.
3. Use **Cash Out** for rent, groceries, and other spending. Categories are
   editable text, not a fixed list.
4. Create "Mutual Funds" with the Investment purpose. Use **Transfer** from an
   existing book to allocate money without creating new income or spending.
5. Select a book or **All books** to view balances. Use the transaction filters
   for a period report. **Clear filters** restores the full history.
6. **Download backup** regularly. **Restore backup** replaces the entire account
   ledger, not a merge. Export current data before confirming.
7. Under **Recurring & SIP reminders**, choose **Add reminder**. Set the amount,
   next due date, repeat frequency, and book. For a SIP, select transfer and
   choose separate source and investment books.
8. Once you have actually paid, choose **Record payment** and confirm.
   **Skip once** advances without recording money; **Pause** retains the due
   date until you resume. Editing/deleting a reminder does not alter past entries.

All amounts are stored in integer paise, with a maximum INR 1,00,00,00,000 per
entry. Negative balances are allowed; the app is a ledger, not a bank-payment
system. Books with entries or recurring reminders cannot be deleted until the
references are removed or reassigned, including both ends of transfers.

### Storage and limitations

Account records are saved in MongoDB, scoped by the authenticated user's ID.
Signing in to the same configured app from another browser loads the same
account. **Reload records**, tab focus, and same-origin tab notifications refresh
the view; this is not continuous real-time synchronization.
Failed saves show errors and do not pretend to succeed. Revision-based atomic
updates reject stale writes rather than overwriting another device's changes.
The client also binds each save to the expected account to prevent accidental
cross-account writes after a session changes in another tab.

Old browser-only data under `gg-cash-book-ledger-v1` is preserved. After signing
in, choose **Import old browser data** on the original origin (for example,
`127.0.0.1`, not `localhost`). It opens a replacement confirmation. Import is
explicit, never automatic, and does not erase the original local copy.
JSON backups from the previous version remain supported. Backups now include
recurring schedules. JSON/CSV downloads are unencrypted: store them privately.

Limits: 200 books, 200 recurring reminders, 50,000 entries, 30 MB per imported
file, and 10 MB per serialized account save (bounded below MongoDB's 16 MB limit).
Large backups may fail the account-size limit without changing saved records.

### Account security and deployment

Passwords are bcrypt-hashed (cost 12), never stored as plain text. Passwords must
be at least 12 characters and at most 72 UTF-8 bytes to avoid bcrypt truncation.
Email addresses are normalized and uniquely indexed. Login attempts are limited
per normalized email (10 per 15-minute fixed window), registrations per email
(5 per window), plus an overall account-endpoint limit (200 per window).
Use an edge/network rate limiter as well before public deployment.

Sessions are random 256-bit opaque tokens; only SHA-256 token hashes are stored
in MongoDB. Cookies are HttpOnly, SameSite=Strict, fixed-duration 7 days, and
Secure with a `__Host-` prefix in production. Session expiry is checked on every
protected request, not only by the database TTL cleanup. Logout revokes the
current session. API writes validate origin, JSON content, size, authentication,
ownership, and ledger schema. Private responses have `Cache-Control: no-store`.

This deliberately uses revocable database sessions rather than the starter's
optional Auth.js JWT baseline: it requires no new signing secret or edits to
organization-restricted environment files. No OAuth providers are configured.
Email verification, password recovery, MFA, and account deletion are not built.
Do not assume that registering an email proves ownership of it.

Run production behind **HTTPS**, with a correctly preserved Host/protocol,
restricted MongoDB credentials, database backups, and TLS to Atlas. Do not
expose `next dev` or a MongoDB server publicly. Do not loosen origin checks to
work around a misconfigured reverse proxy.

### Reminder behavior

Reminders use the device's local calendar and refresh every minute while open.
Choose **Enable alerts** to request browser notification permission on this
device. Permission is never requested automatically. Due and overdue, unpaused
occurrences produce a generic notification without financial names or amounts,
at most once per occurrence per local day. Preferences and delivery history are
stored separately per account on this browser. Disabling alerts or signing out
closes that account's active notices.

Alerts require being signed in with the app open and online; browser throttling,
permission, and OS settings can delay or silence them. They are **not scheduled
when the app is closed**. Closed-app delivery needs a deployed push service and
server scheduler; neither is configured. No email, automatic debit, or automatic
money movement is performed.

Recording creates one entry dated on the scheduled date and advances one
occurrence atomically with it. SIP records are linked transfers, excluded from
income/expense totals. A deterministic entry ID and revision check prevent
double-recording the same occurrence. Overdue schedules catch up one occurrence
at a time, not by silently generating missed payments.
Monthly/quarterly/yearly dates clamp to the month's last day while preserving
the original day (January 31 -> February 28 -> March 31). Pausing does not skip
missed dates. Editing the next date resets its anchor day. Deleting a recorded
entry does not rewind the reminder; deleting a reminder keeps past transactions.

### Mobile installation and offline behavior

Use **Install app** at the bottom of the screen. Chrome/Edge can offer an
automatic install dialog when their install criteria are met; the native prompt
opens only after **Install now**. Dismissing the offer suppresses automatic
offers for seven days, but the manual button remains available.
On iPhone/iPad, open in Safari and use **Share -> Add to Home Screen -> Add**;
iOS does not expose an automatic native install prompt. iOS device notifications
require a Home Screen installation on iOS 16.4+ and permission.

Use a deployed **HTTPS** address on a real phone. `localhost` and `127.0.0.1`
point to the phone itself, not this computer; ordinary LAN HTTP does not provide
the secure context needed for service workers and notifications.

The custom service worker caches only the public offline page and app icons.
It does not cache account pages, API responses, financial records, or app code.
Offline navigation shows a reconnect message, not an offline ledger: signing in,
viewing accounts, and saving require internet. No edits are queued.
Existing open screens may remain visible until navigation; signing out still
requires a successful server response. Installability does not imply offline
financial access.

On mobile, use the header's **Open navigation** menu for books, account/theme
controls, reloading, backups/import, and device reminder alerts. Selecting a book
closes the drawer. Escape, the close button, or tapping the backdrop dismisses it.
The drawer traps keyboard focus and scrolls independently, leaving the main
screen for balances, reminders, and transactions. Desktop keeps its visible
sidebar; device alert settings are also in that sidebar.
Layouts include touch-sized controls, safe-area spacing, and scrollable dialogs
for short screens.

## Stack

Next.js 16.4.2 App Router, React 19.2.8, strict TypeScript, Tailwind CSS 4,
Lucide React, Sonner, and React Compiler. Zustand and Framer Motion are installed
as starter conventions; shared financial state and animation are deferred until
needed. Inter and Crimson Text are loaded using `next/font/google` (network
access to Google Fonts is required during builds). Gentium Plus is deferred
until transliteration content is needed.

**MongoDB connection configuration is available** through the official MongoDB
driver. A server-only database helper reuses a single client across hot reloads,
using driver-default pool settings for this long-running local Next.js server.
No arbitrary pool or timeout tuning is applied. Monitor connection usage when
deploying or adding concurrent workloads before changing pool settings.

The ignored `.env.local` contains `MONGODB_URI` and
`MONGODB_DB_NAME=gg_cash_book`. Separate `MONGODB_USERNAME` /
`MONGODB_PASSWORD` values are supported when the URI contains `<db_username>` /
`<db_password>` (or `<username>` / `<password>`) placeholders; replacement values
are URL-encoded. Never prefix these variables with `NEXT_PUBLIC_` or commit
real credentials. Restart the app after changing environment configuration.
Use `npm run db:check` to verify access without creating or modifying records.
A ping does not establish collection read/write permissions or create a database;
the database will appear in MongoDB tools only after an authorized first write.

On first account use, the app creates its own `cashbook_users`,
`cashbook_sessions`, `cashbook_auth_limits`, and `cashbook_ledgers` collections
in the configured application database. Unique email and TTL expiry indexes
support authentication. Each bounded ledger is one owner-keyed document so
transfers and recurrence advancement save atomically, including on standalone
MongoDB. No existing unrelated databases/collections are used or migrated.

Investment books track cash allocated, not fund units, NAV, live prices, market
value, or returns. The gross investment-additions summary includes transfers
between investment books and is explicitly not net invested capital. Background
entry automation, receipt attachments, bank connections, multi-currency,
shared/team books, and live portfolio valuation are not implemented.

Reference: [Simple Cash Book Management on Google Play](https://play.google.com/store/apps/details?id=com.cashbook.moneymanager&hl=en-US)
offers multiple books, cash-in/out balances, date filtering, PDF reports, and
backup/restore. This is product inspiration, not a claim of feature parity.

## Project guidance

The original [STATER.md](STATER.md) is retained, with a copy in
[.github/copilot-instructions.md](.github/copilot-instructions.md) for discovery.
The database selection above takes precedence over its MySQL default.
Framework-generated [AGENTS.md](AGENTS.md) guidance is also retained.

`npm test` uses Node 22's TypeScript stripping and built-in test runner; no extra
test dependency is required. Tests cover decimal precision, transfer invariants,
editing/deletion effects, backups, malformed records, CSV escaping, credential
validation, password hashing, recurrence edge cases, notification selection and
deduplication, public-only service-worker caching, offline fallback, and icon sizes.
The live API integration test is opt-in:

```powershell
$env:CASHBOOK_TEST_URL = 'http://127.0.0.1:3000'
node --experimental-strip-types --test tests\account-api.test.mjs
```

It creates uniquely named `qa-api-...@example.invalid` test accounts, checks
authentication, cookie properties, account isolation, CSRF, conflict detection,
and throttling. It clears only its own ledgers and revokes its sessions afterward.
Empty QA account records remain for inspection; no existing user records are
modified. Also run lint, TypeScript, production build, and browser workflow checks.