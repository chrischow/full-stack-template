# Plan: Login Flow Wireframes (new design)

## Context

The prod app has a working login flow (`/login`, `/login/otp`, `/login/redirect`) backed by the real auth API, but its design is a plain centered card (three buttons: Google, Request OTP, Passkey) and the email input lives on the same OTP page. We want a **modern, light-themed redesign** of the login flow, built as DEV-only wireframes so no prod routes or behavior change.

Goal: three new wireframe pages (login, email input, OTP input) that mock the full login journey with **no data fetching** — interactions are simulated with a timeout and a redirect to `/wireframes` on "successful" login.

## Approach

- **Wireframes-only.** All new files live under `apps/frontend/src/wireframes/`. Prod pages (`src/pages/login/**`) and prod routes are untouched. Per `docs/frontend/creating-wireframes.md`, route registration goes inside the existing `import.meta.env.DEV` block in `src/app/App.tsx`, wrapped in the same layout the prod page uses — the prod login pages use **no layout wrapper**, so the wireframe login pages are bare too.
- **Routes added (DEV-only, mirror prod structure under `/wireframes`):**
  - `/wireframes/login` → login page (Google OAuth, Email OTP, Passkey CTAs)
  - `/wireframes/login/email` → email input page (new segment; in prod the email input is inline on the OTP page, but the requirement asks for a standalone page)
  - `/wireframes/login/otp` → OTP input page
  - No changes to existing routes (`/`, `/account`, `/login`, `/login/otp`, `/login/redirect`, `/wireframes`, `/wireframes/account`).
- **Design language (modern, light):**
  - Split-screen layout for all three pages via a shared wireframe-only `AuthShell` component: left brand panel (soft light gradient background, product name/logo, tagline) + right panel with the form card.
  - Light theme only — rely on the default `:root` tokens in `src/index.css` (`--background`, `--card`, `--primary`, etc.); no dark variants. Force light background explicitly on the shell so it reads light regardless of the `.dark` class.
  - Rounded-2xl cards, soft shadows, generous whitespace, subtle border (`--border`), Inter Variable font (already the app font).
  - Icons via `react-icons` (consistent with existing login pages): `BiLogoGoogle`, `HiOutlineMail`, `IoMdFingerPrint` (already used in prod).
- **Mock flow (no data fetching, per requirement):**
  1. Login page → "Continue with Google" → button loading state → `setTimeout` → `navigate('/wireframes')`.
  2. Login page → "Continue with Email" → `navigate('email')` (relative → `/wireframes/login/email`).
  3. Login page → "Passkey" → button loading state → `setTimeout` → `navigate('/wireframes')`.
  4. Email page → validate email client-side (reuse `EmailLoginInputsSchema.safeParse` from `@repo/api-contract/schemas`; schema validation is allowed, it's not data fetching) → "Continue" → `navigate('../otp')` (or forward email via a tiny module-local store/wireframe-state so the OTP page can show "A code was sent to …").
  5. OTP page → `InputOTP` 6 slots, digits only (reuse `@/components/ui/input-otp`) → "Verify" enabled only when 6 digits → loading state → `setTimeout` → `navigate('/wireframes')`. Include a client-side only "Resend" with cooldown and a "Back" link.

## Files to modify / create

| File | Action |
|---|---|
| `apps/frontend/src/app/App.tsx` | **Edit** — register the three wireframe login routes inside the `{import.meta.env.DEV && …}` block, with imports of the new pages |
| `apps/frontend/src/wireframes/pages/login/index.tsx` | **Create** — wireframe login page (new design) |
| `apps/frontend/src/wireframes/pages/login/email/index.tsx` | **Create** — email input page |
| `apps/frontend/src/wireframes/pages/login/otp/index.tsx` | **Create** — OTP input page |
| `apps/frontend/src/wireframes/components/AuthShell/index.tsx` | **Create** — wireframe-only `AuthShell` split-screen layout (brand panel + form card slot) |
| `apps/frontend/src/wireframes/components/…` (optional) | **Create** — small wireframe-only pieces if needed (e.g. brand mark, `MockAuthButton` with the loading-simulate-navigate behavior) — never add to `src/components` |

Folder structure follows `docs/frontend/creating-wireframes.md` exactly — page folders mirror route segments **under** the `/wireframes` prefix; the `/wireframes` segment itself is not part of the tree:

```
apps/frontend/src/wireframes/
├── components/
│   └── AuthShell/            # wireframe-only reusable component (PascalCase folder == component name)
│       └── index.tsx
└── pages/
    └── login/                # mirrors /wireframes/login
        ├── index.tsx         # LoginPage
        ├── email/            # mirrors /wireframes/login/email
        │   └── index.tsx     # EmailPage
        └── otp/              # mirrors /wireframes/login/otp (nested under login/, like prod pages/login/otp)
            └── index.tsx     # OtpPage
```

Naming per the docs:
- Page components get the `Page` suffix (`LoginPage`, `EmailPage`, `OtpPage`);
- Page folders are the lowercase route segments (`login`, `email`, `otp`) — the pages convention overrides the generic "folder == component name" rule;
- Every `index.tsx` exports only the component via a default export (Vite Fast Refresh);
- Wireframe-only reusable components live under `wireframes/components` (never `src/components`), PascalCase folder == component name (`AuthShell`);
- No name conflict with prod `LoginPage`/`OtpPage` — imports resolve via distinct paths (`@/wireframes/pages/…`), and App.tsx can alias imports if desired.

## Reuse (verified existing)

- `Button` — `@/components/ui/button` (variants: default/outline/ghost/secondary/link; sizes sm/lg)
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — `@/components/ui/card`
- `Input` — `@/components/ui/input`
- `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` — `@/components/ui/input-otp` (with `REGEXP_ONLY_DIGITS` from `input-otp`)
- `toast` — `@/components/ui/toast` for inline validation errors (optional)
- `cn()` — `@/lib/utils`
- `EmailLoginInputsSchema` — `@repo/api-contract/schemas` (client-side email validation only)
- Icons: `react-icons/bi` (`BiLogoGoogle`), `react-icons/hi` (`HiOutlineMail`), `react-icons/io` (`IoMdFingerPrint`), `lucide-react` (`Loader` etc.)
- Design tokens: `:root` vars in `apps/frontend/src/index.css` (light theme is default)
- Structural template: prod pages `src/pages/login/index.tsx`, `src/pages/login/otp/index.tsx` (card layout, icons, navigation patterns)

## Steps

- [x] Step 1: Create `AuthShell` wireframe component (`src/wireframes/components/AuthShell/index.tsx`, default export only) — split-screen light layout: left brand panel (gradient bg, product name "Full Stack Template", tagline), right form card area; props for content slot; explicit light background.
- [x] Step 2: Create login page `src/wireframes/pages/login/index.tsx` — back-to-back CTAs: Google (outline button, `BiLogoGoogle`), Email OTP (primary, `HiOutlineMail`), Passkey (secondary, `IoMdFingerPrint`); mock click handlers: loading spinner on the clicked button, `setTimeout(…, ~900ms)` then `navigate('/wireframes')` for Google/Passkey, `navigate('email')` for email; small footer links (e.g. "Terms / Privacy") for polish.
- [x] Step 3: Create email page `src/wireframes/pages/login/email/index.tsx` — single `Input` (email), validate with `EmailLoginInputsSchema.safeParse` — show inline error/toast on invalid; "Continue" → `setTimeout` → store mock email + `navigate('../otp')`; "Back to sign in" link.
- [x] Step 4: Create OTP page `src/wireframes/pages/login/otp/index.tsx` — `InputOTP` 6 slots digits-only with autoFocus; verification message "A code was sent to {mockEmail}"; "Verify" enabled at 6 digits → loading → `setTimeout` → `navigate('/wireframes')`; mock "Resend code" cooldown (~30s countdown, client-side only); "Back" link to email page.
- [x] Step 5: Register routes in `apps/frontend/src/app/App.tsx` — **relative** paths inside the existing `<Route path="/wireframes">` DEV block, per the doc (no leading slash): `<Route path="login" element={<LoginPage />} />`, `<Route path="login/email" element={<EmailPage />} />`, `<Route path="login/otp" element={<OtpPage />} />` (bare — no `WithSidebarLayout`, matching prod login pages).
- [x] Step 6: Quality checks per AGENTS.md — `lint:fix`, `format:fix`, `check-types` (via `run_npm_script`).


## Verification

- `pnpm dev` → open `/wireframes/login`: all three CTAs render; Google & Passkey redirect to `/wireframes` after ~1s; Email navigates to `/wireframes/login/email`.
- Enter invalid email → inline error; valid email → `/wireframes/login/otp` showing the email echoed back.
- Type 6 digits → Verify redirects to `/wireframes` after loading. Resend button disabled during cooldown.
- No network calls fired during the flow (mock only) — spot-check devtools network tab.
- `lint:fix`, `format:fix`, `check-types` all pass.
- Confirm prod routes `/login`, `/login/otp` are untouched.