# Copilot instructions: new project starter

## How to use this file

Copy this file into a new project's `.github/copilot-instructions.md`. That is
the auto-discovered instruction location; an arbitrary Markdown filename is not.
Then open that project in VS Code and send Copilot Agent this message:

> Start this project using the repository instructions.

Instructions do not start a conversation by themselves. Do not bootstrap or
rename an existing application merely because this file is present. Apply the
startup workflow only when the user requests a new project. For later work,
continue following the stack and development conventions below.

## Startup conversation

1. Ask for the project name and database preference: **"What is the project
   name, and which database do you prefer: MySQL/MariaDB or MongoDB?"** Use a
   question tool when available. Do not ask again for either answer the user
   already supplied. If the user is unsure or declines to choose, use the
   existing MySQL/MariaDB with Prisma default.
2. Keep their display name and derive a lowercase, hyphenated npm package/folder
   name. Use that display name in metadata, the header, and the README.
3. Do not initially ask about colors, fonts, icons, framework, authentication,
   hosting, pages, or features. Use the defaults in this document for those.
   The database preference is the only technical choice to ask at startup.
4. Inspect the destination before writing. Use the current folder if it is the
   intended new project, even if this instruction file already exists there.
   Never overwrite an existing application or silently create a nested project.
   Ask for clarification only if the destination or a conflicting file blocks
   safe setup.
5. Build and verify a working, domain-neutral starter. Afterward, summarize what
   is ready and invite the user to describe the first feature.
6. Ask feature-specific questions during development, only when they affect the
   requested work. Request service configuration when integrating that service,
   not during the initial setup.

## Technical defaults

These choices are based on the source project's declared dependencies. Versions
are a compatibility baseline, not a claim that they are the latest releases.
Keep the same stack; do not silently replace libraries with alternatives.

| Area | Default | Source version/range |
| --- | --- | --- |
| Framework | Next.js, App Router | `16.3.2` |
| UI runtime | React and React DOM | `19.2.8` for both |
| Language | TypeScript, strict mode | `^5` |
| Styling | Tailwind CSS with PostCSS plugin | `tailwindcss@^4`, `@tailwindcss/postcss@^4` |
| Icons | Lucide React | `^1.34.0` |
| Client state | Zustand | `^5.0.15` |
| Toasts | Sonner | `^2.0.8` |
| Animation | Framer Motion | `^13.1.1` |
| React Compiler | Enabled in Next.js configuration | `babel-plugin-react-compiler@1.0.0` |
| Linting | ESLint flat config, Next Core Web Vitals and TypeScript rules | `eslint@^9`, `eslint-config-next@16.3.2` |
| Font loading | `next/font/google` and Fontsource | `@fontsource/gentium-plus@^5.3.0` |
| Package manager | npm with committed lockfile | `package-lock.json` |

Use a supported Node.js LTS release satisfying the installed packages' engines.
Do not treat the source's `@types/node@^20` as a runtime-version requirement.
Keep `@types/react` and `@types/react-dom` on major 19.

Before writing framework code, read the relevant installed guides in
`node_modules/next/dist/docs/`. This Next.js version has changed APIs; do not
assume older tutorials are correct. If the guides are unavailable, consult the
official documentation matching the installed version. Preserve framework-
generated agent guidance rather than removing it.

Use the version-matched official scaffolder where available, with TypeScript,
App Router, a `src` directory, Tailwind, ESLint, React Compiler, npm, and `@/*`
imports. Inspect its supported flags first. Preserve this instruction file
during scaffolding. Do not assume `@latest` reproduces this baseline. If a
baseline version cannot be installed or has a known security advisory, report
the issue and obtain approval for a compatible supported version instead of
quietly switching stacks or ignoring the advisory.

### Backend defaults, added when needed

The source is a full-stack Next.js application. Preserve these backend choices
when the new application's features require them, but do not make the initial
homepage depend on external services or placeholder credentials.

| Capability | Default | Source version/range |
| --- | --- | --- |
| Database (if chosen) | MySQL/MariaDB with Prisma ORM | `prisma@^7.9.1`, `@prisma/client@^7.9.1` |
| Database (if chosen) | MongoDB with the official MongoDB Node.js driver | Choose a supported version when database integration is requested |
| Database driver adapter (MySQL/MariaDB) | Prisma MariaDB adapter | `@prisma/adapter-mariadb@^7.9.1` |
| Authentication | Auth.js / NextAuth v5 beta | `next-auth@^5.0.0-beta.32` |
| Auth persistence (MySQL/MariaDB) | Prisma adapter | `@auth/prisma-adapter@^2.11.3` |
| Password hashing | bcryptjs | `^3.0.3` |
| TypeScript scripts | tsx | `^4.19.4` |

- Use only the selected database; do not provision both by default. For
  MongoDB, use the official `mongodb` driver and its supported connection
  patterns rather than applying the Prisma/MySQL instructions below. If
  authentication needs persistence with MongoDB, use an adapter documented to
  support the selected database and Auth.js version.
- Use Prisma's MySQL datasource and generated client in `src/generated/prisma`.
  Keep Prisma CLI, client, and driver adapter versions aligned.
- Use `prisma.config.ts` for the connection URL and migration configuration,
  following the installed Prisma version's guidance. Declare any directly
  imported configuration dependency, such as `dotenv`, explicitly.
- Create a server-only Prisma utility using the MariaDB adapter. Reuse the client
  during development hot reloads rather than creating connections per request.
- Define only the models required by the new feature. Do not copy the source
  application's domain schema or seed data.
- Use Next.js route handlers for HTTP APIs. Server Components may access Prisma
  directly on the server; browser code must never import the database client.
- The source uses Google OAuth, credentials login, JWT sessions, and a Prisma
  adapter. Implement only the providers requested for the new application.
  Do not force Google setup before the starter can run.
- Use the current Next.js `proxy.ts` convention when a route guard is needed,
  but enforce authentication and authorization in protected handlers/server
  operations too. A proxy or hidden UI is not sufficient access control.
- Validate input on the server and return explicit errors. The source does not
  establish a schema-validation or form library; do not claim Zod, Formik, or
  React Hook Form is already part of the stack.
- Supply `.env.example` with variable names and safe placeholders only when
  services are added. Keep real values in ignored environment files. Never
  request secrets in chat, include default passwords, or expose server secrets
  using `NEXT_PUBLIC_`. Mark unconfigured integrations clearly, not as working.
- Do not connect to or modify the source project's database. Do not run
  migrations, seeds, resets, or destructive database commands against an
  existing/shared database without explicit approval.

### Established libraries for optional features

Use these when the corresponding feature is requested; do not install or build
every optional integration during initial setup.

| Feature | Existing choice | Source version/range |
| --- | --- | --- |
| Drag and drop | DnD Kit | `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2` |
| Spreadsheet import/export | SheetJS | `xlsx@^0.18.5` |
| Web push | web-push | `web-push@^3.6.7`, `@types/web-push@^3.6.4` |
| PWA | Web app manifest and custom service worker | No PWA framework dependency |

Check maintenance, compatibility, and security advisories before adding an
optional dependency. Report any need to change the established choice.

## UI and design defaults

Use custom React components and Tailwind/CSS. The source does not use shadcn/ui,
Radix, MUI, Chakra, Bootstrap, or a purchased template. Do not add a component
framework, another icon pack, CSS-in-JS, or a theme package by default.

### Typography

- Inter: interface text, loaded with `next/font/google`.
- Crimson Text: headings and reading/serif text, loaded with `next/font/google`.
- Noto Serif Devanagari: load when Devanagari content is introduced.
- Gentium Plus: use the Fontsource package when IAST/transliteration content is
  introduced.
- Use CSS font variables with system fallbacks. Do not introduce unrelated fonts.

### Colors and themes

Retain the source's cream, blue, gold, and muted-pink visual language without
copying its religious imagery or branding. The source calls its blue accent
`saffron`; use semantic token names in the new project to avoid that ambiguity.

Define these CSS variables and map semantic colors through Tailwind v4
`@theme inline`. Start CSS with `@import "tailwindcss"`; do not introduce a
Tailwind v3 configuration pattern.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `#FFF8F0` | `#0f1220` |
| `--surface` | `#ffffff` | `#171b2f` |
| `--foreground` | `#1a1a3e` | `#f5efe4` |
| `--muted` | `#6b7280` | `#b4bdd1` |
| `--border` | `rgba(26, 26, 62, 0.12)` | `rgba(226, 194, 122, 0.22)` |
| `--accent` | `#4A5D8F` | `#667fbe` |
| `--accent-fg` | `#ffffff` | `#f8fbff` |
| `--gold` | `#FFD700` | `#e2c27a` |
| `--lotus-pink` | `#E8A4C8` | `#d5b0c2` |

- Apply dark overrides using `[data-theme="dark"]` on the document root.
- Include a working theme toggle and persist the preference. Access browser
  storage only on the client; prevent hydration mismatches and avoid a visible
  incorrect-theme flash where practical.
- Use semantic tokens rather than repeating raw colors inside components.
- Use rounded cards, restrained borders/shadows, clear hierarchy, readable
  spacing, and responsive mobile-first layouts. Gold and pink are accents,
  not default body-text colors.
- Import named icons from `lucide-react`. Decorative icons are hidden from
  assistive technology; icon-only controls need accessible names.
- Use Sonner for transient feedback, with accessible inline messages for form
  errors. Use Framer Motion sparingly and respect reduced-motion preferences.
- Use native semantic controls, keyboard support, visible focus states, labels,
  readable contrast, and touch-friendly targets.
- Do not invent product-specific navigation, admin screens, or mobile tab bars
  until the user's feature requirements justify them.

## Source organization and coding conventions

```text
.github/
  copilot-instructions.md
public/
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    Providers.tsx
    ui/
  lib/
  store/
```

Create folders only when they contain useful code. Add `prisma/`, `src/auth.ts`,
`src/proxy.ts`, API handlers, and generated Prisma output only when integrating
the features that need them.

- Keep routes in `src/app`; use `layout.tsx`, `page.tsx`, `loading.tsx`,
  `error.tsx`, and `route.ts` as appropriate.
- Use `@/*` for imports from `src/*`. Keep TypeScript strict.
- Default to Server Components. Add `"use client"` only at interactive
  boundaries that need hooks, browser APIs, or client-only libraries.
- Put shared components in `src/components`; group by feature as the app grows.
- Put utilities in `src/lib` and Zustand stores in `src/store`.
- Prefer local React state for small interactions. Use Zustand for genuinely
  shared client state and its persistence middleware only when persistence is
  needed. Do not put secrets or authoritative authorization state in storage.
- Keep components reusable without premature abstractions. Follow existing
  patterns, avoid unnecessary dependencies, and make targeted changes.
- Handle loading, empty, error, and success states when adding data-driven UI.
  Do not hide failures with empty catches or success-shaped placeholder data.

## Initial deliverable

After receiving the project name and database preference, produce:

1. A runnable Next.js application with the core technical defaults above.
2. A responsive, accessible homepage displaying the project name, a neutral
   welcome message, and a working light/dark toggle. No fake metrics, invented
   business features, dead navigation, or nonfunctional sign-in buttons.
3. Shared provider wiring for Sonner and any actually used client providers.
   Do not add an Auth.js provider until authentication is integrated.
4. Semantic theme tokens and the default interface/display fonts.
5. npm scripts for development, build, production start, and ESLint.
6. A committed-format lockfile and a README covering setup, commands, stack,
   and which backend integrations are deliberately deferred. Do not make a git
   commit unless the user asks.
7. This instruction file retained as the new project's ongoing guidance.

Do not copy source-project logos, images, text, environment files, credentials,
database records, domain models, audio/video players, YouTube integrations,
spiritual-content routes, PWA caches, push subscriptions, or admin features.
Create fresh neutral assets only if the starter actually needs them.

## Commands and verification

Use npm scripts:

```text
npm run dev       -> next dev
npm run build     -> next build
npm run start     -> next start
npm run lint      -> eslint
```

When Prisma is integrated, add the relevant source-compatible scripts:

```text
npm run db:generate     -> prisma generate
npm run db:migrate      -> prisma migrate dev
npm run db:migrate:prod -> prisma migrate deploy
npm run db:push         -> prisma db push
npm run db:seed         -> tsx prisma/seed.ts
npm run db:studio       -> prisma studio
```

Add `db:seed` only with an implemented seed script. Add `postinstall: prisma
generate` only after the schema and configuration exist and generation has been
verified; do not break core setup with premature Prisma lifecycle scripts.
Prefer migrations for schema history; `db:push` is not a production migration
strategy. Never run production migrations automatically as part of a UI build.

Before reporting completion:

- Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Fix issues caused
  by the starter rather than disabling checks.
- Start the dev server and verify an HTTP response from the homepage. When
  browser tools are available, check desktop/mobile layouts, theme switching,
  keyboard accessibility, console errors, and hydration behavior.
- Stop temporary verification servers when finished unless the user needs one
  left running.
- The source has some test files but no configured test script/runner. Do not
  claim a test suite exists. Add an appropriate runner and tests when features
  require them; do not introduce a test framework merely to imitate the source.
- If verification is blocked by missing credentials, network access, or package
  availability, report the exact limitation and what remains unverified.

Keep future work aligned with these defaults. Ask for product decisions only
when the next requested feature actually needs them.
