# BurnRate — code review, security review, and adversarial pass — 12th of May 2026

> ## Disposition (addressed 2026-05-12, post-review)
>
> Verification after fixes: `npm test` → 266/266 passing; `npm run typecheck` → clean.
>
> | # | Severity | Finding | Disposition | Where |
> |---|---|---|---|---|
> | H1 | High | "Passphrase lock" does not encrypt stored data | **Resolved (honesty path).** UI copy in `SecuritySettings.tsx` now explicitly states this is a screen lock, not at-rest encryption, and that data still lives as plain JSON in localStorage visible to extensions/DevTools. Unused `wrapEncrypted` / `unwrapEncrypted` imports and the `void` lint-suppression hack removed from `BurnRateApp.tsx`. The crypto helpers stay in `src/lib/crypto.ts` (still tested) for future at-rest encryption work; implementing real at-rest encryption is a larger refactor tracked separately. | `src/components/SecuritySettings.tsx`, `src/components/BurnRateApp.tsx` |
> | H2 | High | Flash of unlocked UI before `LockScreen` | **Resolved.** Pre-hydration now renders a neutral `app-shell` skeleton (`aria-busy="true"`); after hydration we branch directly to `LockScreen` when `isLocked` (no `&& hasHydrated` gate). Subscription data can no longer paint to the DOM on the first client frame when the vault is enabled. | `src/components/BurnRateApp.tsx` |
> | M1 | Medium | Sync checksum messaging implies tamper-resistance | **Resolved (wording + threat-model comment).** Error message changed from `"checksum mismatch (possible tampering)"` to `"checksum mismatch"`. Added a comment above `simpleChecksum` explaining it is FNV-1a, catches accidental corruption only, and that sync URLs are capability tokens not authenticated messages. | `src/lib/sync.ts` |
> | M2 | Medium | No CSP / security headers | **Resolved.** `next.config.mjs` now serves `Content-Security-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/mic/geolocation/FLoC disabled), and `Strict-Transport-Security` on all routes. CSP allows `'unsafe-inline'` for scripts and styles (Next.js hydration + Tailwind preflight) and `data:`/`blob:` for `img-src` (html2canvas PNG export). | `next.config.mjs` |
> | L1 | Low/info | Share + sync URLs are capability secrets | **Already documented.** README "Privacy" and the in-app warnings on link generation already cover this. No code change. |
> | L2 | Low/info | Sync link in `#hash` visible to same-page JS | **Accepted.** Inherent to the design; no in-product third-party JS today. No code change. |
> | L3 | Low/info | Service worker SWR for HTML can serve stale shell | **Accepted.** Versioned cache (`CACHE_VERSION`) already triggers eviction on deploy; trade-off is intentional for offline-first behavior. No code change. |
> | L4 | Low/info | `html2canvas` is a large dep — keep updated | **Accepted, ongoing.** Dependency hygiene is handled at the package level; no in-scope action. |
> | Q1 | Quality (non-blocking) | `BurnRateApp.tsx` too large | **Dismissed for this pass.** Already called out in `docs/architecture.md` under v3.1 follow-ups (`useBurnRateState` extraction is queued). Out of scope for this review-response. |
> | Q2 | Quality (non-blocking) | `useLocalStorage` silently fails on quota errors | **Dismissed.** The silent-failure behavior is intentional — quota errors on a client-only app are unrecoverable mid-write; a louder UX (toast on every set) would create noise. Worth revisiting if telemetry shows real impact. |
> | Q3 | Quality (non-blocking) | `mergeSync` dedupes by lowercased name only | **Dismissed.** Name is the only stable user-visible identifier across two browsers that don't share IDs. Two services with the same display name on both ends colliding is the user's intended outcome for `merge`; the `replace` flow is the escape hatch when in doubt. |

---



**Date:** 2026-05-12  
**Scope:** Full-project read (Next.js 16, React 19, client-only app).  
**Verification at time of review:** `npm test` — 266 tests passed; `npm run typecheck` — passed.

---

## Executive summary

BurnRate is a **client-only** subscription tracker: `localStorage`, optional IndexedDB snapshots, LZ-compressed sync/share payloads in URLs, and WebCrypto helpers for a passphrase “vault.” There is **no server-side auth, database, or API** in the reviewed tree; the security surface is mostly **browser storage, share links, and service worker caching**.

Code quality is generally **strong**: clear modules (`sync`, `burnrate`, `crypto`, `migrate`), solid test coverage, and no `dangerouslySetInnerHTML`, `eval`, or `innerHTML` patterns found in the codebase.

The main issues are **trust model and vault UX** (user-facing “encryption” vs what is actually implemented, plus a **brief UI exposure** when the lock is enabled) and **defense-in-depth gaps** (no Content-Security-Policy; sync checksum is not cryptographic).

---

## What is working well

- **Crypto primitives** in `src/lib/crypto.ts` (`PBKDF2` + `AES-GCM`, random IV, verifier pattern) are appropriate for browser-side key derivation when used for real payload encryption.
- **Sync pipeline** in `src/lib/sync.ts` validates shape, uses a checksum to catch truncation/casual corruption, and surfaces `SyncDecodeError` with clear messages.
- **Share page** (`src/app/s/[payload]/page.tsx`) strips subscription notes before metrics, sets `robots: { index: false, follow: false }`, and avoids rendering attacker-controlled HTML.
- **Service worker** (`public/sw.js`) limits caching to same-origin GET, skips OG image paths, and avoids caching opaque cross-origin responses.
- **Tests and types:** large Vitest suite and strict TypeScript — good regression safety.

---

## Security review

### High

1. **“Passphrase lock” does not encrypt stored subscription data**  
   `wrapEncrypted` / `unwrapEncrypted` are not used for persistence (they are referenced only to satisfy unused-import linting in `BurnRateApp.tsx`). Subscription data, trials, ledger, etc. remain **plain JSON in `localStorage`** via `useLocalStorage`. Anyone with physical access, a malicious extension, or DevTools can read data regardless of the lock. IndexedDB snapshots are not tied to vault encryption.  
   This conflicts with UI copy in `SecuritySettings.tsx` (“Encrypt your local data with a passphrase”).

2. **Flash of unlocked UI before `LockScreen` (when vault is enabled)**  
   `hasHydrated` is set to `true` in a `useEffect`, so on the first client paint it is still `false` and the branch `if (isLocked && hasHydrated)` does not show the lock screen yet. For at least one frame, the full app can render with subscriptions already loaded from `localStorage`, undermining the lock for shoulder-surfing, screenshots, or automation.

### Medium

1. **Share / sync payload integrity is not cryptographic**  
   The checksum in `sync.ts` is a small non-cryptographic hash. It detects accidental corruption and casual edits; it does **not** prevent a motivated party from altering the JSON and recomputing the checksum. Messaging that implies strong “tampering” protection should match that threat model.

2. **No Content-Security-Policy (or other security headers) in Next config**  
   `next.config.mjs` is empty of security headers. Blast radius is smaller than a typical SaaS API for this app, but CSP remains useful defense-in-depth against future XSS or dependency issues.

### Low / informational (threat model)

- **Share and sync URLs are capability secrets** — whoever has the URL can decode the payload. User-facing warnings exist; treat URLs like sensitive tokens (logs, referrers, analytics).
- **Sync link in `#hash`** — hash is not sent to the server in the same way as path, but is visible to bookmark sync, shoulder surfers, and same-page JavaScript.
- **Service worker stale-while-revalidate for HTML** — can show a stale shell offline; usually not a confidentiality issue here but relevant for “old build” behavior.
- **`html2canvas`** — large dependency; keep updated; PNG export is local-only.

---

## Code quality review

### Strengths

- Cohesive domain types in `burnrate.ts`, migration helpers in `migrate.ts`, and defensive parsing in `sync.ts` / `hydrate*`.
- Components are large (`BurnRateApp.tsx`) but grouped by feature; tests cover sync, ICS, budget, command palette, and more.
- Sensible UX: confirm on reset, sync modal for merge vs replace, clipboard fallbacks for links.

### Maintainability / correctness (non-blocking)

- **`BurnRateApp.tsx` size** — hard to review in one pass; extracting hooks (vault, sync, notifications) would reduce merge friction.
- **`useLocalStorage`** — silent failures on quota/storage errors improve resilience but can confuse users if writes silently stop.
- **`mergeSync`** — dedupes subscriptions by lower-cased name only; two distinct services with the same display name could surprise users.

---

## Adversarial review (stress-testing the assessment)

| Claim | Devil’s advocate | Resolution |
|--------|------------------|------------|
| “Vault doesn’t encrypt” is critical | Product might only promise a **screen lock** | UI says **“encrypt your local data”**; implementation does not match. Treat as critical for **honesty and privacy expectations**. |
| “First-frame leak is high” | One frame; needs local access | Shoulder surfing and capture tools make it real; React Strict Mode can double-invoke effects in dev. Severity remains **high** for a marketed security feature. |
| “Checksum isn’t crypto” | Never claimed to be | Fair — clarify **documentation / threat model**, not a bug against honest accidental corruption. |
| “Missing CSP is medium” | No inline scripts, minimal XSS surface today | Fair to call **medium-low** for *current* code; CSP is still cheap defense-in-depth. |
| Review might have missed issues | Only part of ~79 TS/TSX files line-scanned | Focus was auth surface, storage, sync, SW, crypto. Grep found no common XSS sinks; tests green. Residual risk: third-party libs and future edits. |

---

## Bottom line

- **Working order:** Test and typecheck suites were green at review time; architecture fits a local-first PWA.
- **Quality:** Generally high for the scope — especially parsing, sync tests, and the crypto helper module design.
- **Priority fixes for security honesty:** Either **implement at-rest encryption** (e.g. using existing `wrapEncrypted` for serialized blobs) **or** change all user-facing copy to describe a **session lock only**, and fix **`hasHydrated` gating** so a locked vault never renders the main app shell until the user unlocks.

---

## References (key files)

| Area | Path |
|------|------|
| Vault / lock UI | `src/components/BurnRateApp.tsx`, `src/components/SecuritySettings.tsx`, `src/components/LockScreen.tsx` |
| Crypto helpers | `src/lib/crypto.ts` |
| Sync / share encoding | `src/lib/sync.ts`, `src/lib/dataActions.ts` |
| Share route | `src/app/s/[payload]/page.tsx`, `src/app/s/[payload]/opengraph-image.tsx` |
| Service worker | `public/sw.js` |
| Next config | `next.config.mjs` |
| Storage hook | `src/hooks/useLocalStorage.ts` |
