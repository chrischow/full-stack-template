# Plan: Promote Login Flow Wireframes to Prod

## Context

New-design login wireframes (see `plans/2026-09-29-login-flow-wireframes.md`) live at `/wireframes/login`, `/wireframes/login/email`, `/wireframes/login/otp` — DEV-only, all mock (timeout + navigate), built around a shared `AuthShell` split-screen layout (brand panel + form card).

Prod already has a *working, real-API* login flow with a plainer design: `/login` (Google OAuth redirect, "Request an OTP" → `otp`, real `PasskeyLoginButton`), `/login/otp` (inline email input + OTP on one page, real `orpc.auth.otp.generate/verify`), `/login/redirect` (OAuth callback). Goal: promote the approved wireframe design to prod, replacing the current prod pages and wiring them to the real auth API. **Email and OTP inputs stay on a single `/login/otp` page** (as in current prod) — the standalone `/wireframes/login/email` page is **not** promoted as its own route; its email-input phase gets folded into the OTP page. Follow `docs/frontend/promoting-wireframes.md`.

## Approach

1. **Move files into prod** (per `docs/frontend/creating-components.md`):
   - `wireframes/components/AuthShell` → `src/components/AuthShell` (used by both promoted pages → components dir)
   - `wireframes/pages/login/index.tsx` → `src/pages/login/index.tsx` (replaces prod LoginPage)
   - `wireframes/pages/login/otp/index.tsx` → `src/pages/login/otp/index.tsx` (replaces prod OtpPage)
   - The wireframe `pages/login/email` page is **not promoted as a separate page** — its email-input phase (heading copy, input, Continue button) is folded into OtpPage phase 1, so email + OTP inputs live on one page.
   - Fix relative imports in moved files (`@/wireframes/components/AuthShell` → `@/components/AuthShell`).
2. **Wire real data** — replace mock timeouts/navigation with real API calls; keep the design and client-side validation (`EmailLoginInputsSchema.safeParse`).
3. **Routes** — `/login` and `/login/otp` on prod pages (no `/login/email`); amend the `/wireframes` DEV block routes to point at the promoted pages (per promoting-wireframes doc) once the wireframe files are deleted.
4. **Cleanup (user action)** — ask the user to delete the promoted pages + AuthShell from the wireframes tree (keep `.gitkeep`s); agents cannot delete files.
5. **Test + commit**.

## Page-by-Page Data Wiring

### LoginPage (`src/pages/login/index.tsx`)
- Google → `window.location.href = \`${BACKEND_PREFIX}/auth/oauth\`` (real behavior from current prod page; `BACKEND_PREFIX` from `@/app/constants`).
- Email → `navigate('otp')` → `/login/otp` (same as current prod; email itself is entered on the OTP page).
- Passkey → reuse the existing real `PasskeyLoginButton` (keep at `src/pages/login/PasskeyLoginButton`), restyled to the wireframe look (variant `secondary`, `size="lg"`, full width).
- Keep Terms/Privacy footer and all AzUI styling from the wireframe.

### EmailPage — NOT promoted

The wireframe `pages/login/email` page does **not** become a prod page or route. Instead its phase (email input + "We'll email you a one-time code" copy + Continue) is folded into **OtpPage phase 1** below, so there is a single page handling both email and OTP inputs (`/login/otp`), matching the current prod structure.

### OtpPage (`src/pages/login/otp/index.tsx`) — single page for email + OTP
Keep the **current prod two-phase logic** (`isOtpRequested` state; inline email input + "Request OTP" when `false`, OTP + Verify + resend when `true`) and the wireframe design, restyled into the AuthShell layout:
- **Phase 1 (email input)** — wireframe email page's visual ("Enter your email" / "We'll email you a one-time code to sign in." copy, `Input`, "Continue" button) with current prod behavior: `EmailLoginInputsSchema.safeParse` validation → inline error on invalid, real `orpc.auth.otp.generate` on submit; on success set `canRequestAfter` + `isOtpRequested = true`. "Back to sign in" → `navigate('..')`.
- **Phase 2 (OTP input)** — wireframe OTP page's visual ("Check your inbox", email echo, `InputOTP` 6 slots digits-only, "Verify" enabled at 6 digits, per-second resend countdown), with current prod behavior: real `orpc.auth.otp.verify` (`{ email, otp }`) → on success `login(user)` (from `useAuthContext`) + `navigate('/')`; on error clear OTP + toast `error.data.body.message`. "Back" returns to phase 1 via `setIsOtpRequested(false)` (same email retained).
- **Resend** → real `orpc.auth.otp.generate`; gated by server truth `canRequestAfter` (`OtpResponseSchema` coerce date), with the wireframe's countdown derived from it.
- No `location.state` handling needed — email is always owned in local state, so a direct visit to `/login/otp` works identically (starts at phase 1).

## Files to modify

| File | Action |
|---|---|
| `apps/frontend/src/components/AuthShell/index.tsx` | **Create** (moved from wireframes) |
| `apps/frontend/src/pages/login/index.tsx` | **Rewrite** (moved from wireframes + real data) |
| `apps/frontend/src/pages/login/otp/index.tsx` | **Rewrite** (moved from wireframes + real data; email phase folded in from wireframe email page) |
| `apps/frontend/src/pages/login/PasskeyLoginButton/index.tsx` | **Edit** (restyle to wireframe look) |
| `apps/frontend/src/app/App.tsx` | **Edit** — `/login` + `/login/otp` routes; `/wireframes` login routes → promoted pages; drop wireframe imports + `login/email` route |
| `apps/frontend/src/hooks/useOtp.ts` | **Create** — `useOtp` hook (generate + verify mutations, per consuming-an-api-endpoint.md) |
| `apps/frontend/src/hooks/index.ts` | **Edit** — barrel-export `useOtp` |
| `apps/frontend/src/wireframes/components/AuthShell/**` | **Delete — by user** (ask at execution; agents have no delete permission) |
| `apps/frontend/src/wireframes/pages/login/**` | **Delete — by user** (ask at execution; agents have no delete permission) |

## Reuse (verified existing)

- `AuthShell` — moved to `@/components/AuthShell` (split-screen brand panel + form slot)
- `Button`, `Card`, `CardHeader`, `CardContent`, `Input` — `@/components/ui/*`
- `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `REGEXP_ONLY_DIGITS` — `@/components/ui/input-otp` + `input-otp`
- `toast` — `@/components/ui/toast` (prod OtpPage error pattern with `ORPCError.data.body.message`)
- `EmailLoginInputsSchema`, `OtpResponseSchema`, `OtpVerifyInputsSchema` — `@repo/api-contract/schemas`
- `useAuthContext` + `login` — `@/context/auth`
- `PasskeyLoginButton` — `@/pages/login/PasskeyLoginButton` (real passkey flow)
- `BACKEND_PREFIX` — `@/app/constants`
- `useOtp` — new hook in `src/hooks/useOtp.ts` (generate/verify via `orpc.auth.otp.*`), barrel-exported from `src/hooks/index.ts`
- Contracts: `orpc.auth.otp.generate`, `orpc.auth.otp.verify`, `orpc.auth.passkeys.login.*` — `packages/api-contract/src/contracts/auth.contract.ts`

## Steps

- [x] Step 1: Move `AuthShell` to `src/components/AuthShell`, fix import path.
- [x] Step 2: Move + rewrite `LoginPage` and `OtpPage` (wireframe email phase folded into OtpPage phase 1) into `src/pages/login/**` with real API wiring (see above); restyle `PasskeyLoginButton` to match the design.
- [x] Step 3: Add `src/hooks/useOtp.ts` with the `useOtp` hook (generate/verify mutations); barrel-export from `src/hooks/index.ts`.
- [x] Step 4: Update `App.tsx` — prod routes `/login` + `/login/otp`; rewrite `/wireframes` DEV block routes to the promoted pages (drop `login/email`); remove wireframe imports.
- [ ] Step 5: Ask the user to delete the promoted wireframe files: `src/wireframes/pages/login/**` (login/email/otp pages) and `src/wireframes/components/AuthShell/**`; keep the `.gitkeep`s in `wireframes/pages` and `wireframes/components`.
- [ ] Step 6: Quality checks via `run_npm_script`: `lint:fix`, `format`, `check-types`.
- [ ] Step 7: Manual E2E test (below); fix issues.
- [ ] Step 8: Commit (Conventional Commits, e.g. `feat: promote login flow to prod`).

## Verification

- `pnpm dev` (+ `pnpm dev:infra:start` for backend): full flow works with **real API**:
  1. `/login` renders new design; Google initiates OAuth (redirect to backend); Passkey performs a real WebAuthn login; Email → `/login/otp`.
  2. `/login/otp` phase 1: invalid email → inline error, no request fired; valid email → OTP requested (check network tab for `POST /api/v1/auth/otp/generate`), advances to phase 2 with email echoed.
  3. `/login/otp` phase 2: wrong/6-digit code verify → real `POST /api/v1/auth/otp/verify`, success calls `login(user)` and redirects to `/`; verified via `USER` localStorage + protected pages access. Resend enforced by server `canRequestAfter`, countdown shows; "Back" returns to phase 1 with email retained.
  4. Direct visit to `/login/otp` works identically (starts at phase 1 — email input is always on the page).
  5. `/wireframes/login` and `/wireframes/login/otp` still render the same design in DEV (routing to promoted pages), and `login/redirect` (OAuth callback) still works.
- `lint:fix`, `format`, `check-types` pass.

## Decisions (resolved)

1. **Hooks** — follow `consuming-an-api-endpoint.md`: create a `useOtp` hook in `src/hooks/useOtp.ts`, barrel-exported from `src/hooks/index.ts`. Shared error → toast mapping lives in the hook; page-specific `onSuccess` (login + navigate) is passed per call via `mutateAsync(vars, { onSuccess })`.
2. **Single page for email + OTP** — no separate `/login/email` page/route: the OtpPage keeps the current prod two-phase structure (inline email input → OTP input) restyled into the AuthShell design; the wireframe email page's phase is folded into OtpPage phase 1. Email stays in local state — no `location.state` passing (direct visits just start at phase 1).
3. **Post-login destination** — `/`.