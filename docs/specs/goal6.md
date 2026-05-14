# BurnRate v6 — Codex `/goal` Prompt

You are extending the **BurnRate** subscription tracker — a free, single-user, local-first web app already deployed on Vercel at `https://burnrate-bay.vercel.app`. As of v5 the app supports a deep behavior-change toolkit: usage tracking with ROI scoring, scheduled price changes, charge calendar heatmap, retention/discount log, animated end-of-year report, a goal engine, and a cancellation coach. Sync prefix is `BR4.` (with `BR1.`, `BR2.`, `BR3.` still readable).

This sixth milestone shifts BurnRate from *a single device's app* to *a federation of trusted devices*. It adds **seven features** themed around multi-device, multi-context, and notification — all without giving up local-first sovereignty. You must implement every feature, write tests for every feature, and meet every success criterion before stopping.

---

## Hard Constraints (do not violate)

- **Free hosting only.** Vercel Hobby tier or equivalent. No paid services. No paid APIs. No external secrets. STUN/TURN must be free public servers (e.g., `stun:stun.l.google.com:19302`) or an opt-in user-supplied server URL. **No TURN by default** — manual paste-signaling and direct LAN connections cover the must-work cases.
- **Storage is the user's browser.** `localStorage`, `IndexedDB`, and `sessionStorage` are allowed. No database, no auth, no account creation, no telemetry that collects personal data. P2P sync (Feature 2) MUST NOT introduce any server-side state.
- **No new runtime dependencies that aren't free and permissively licensed.** Prefer MIT / Apache-2.0 / ISC. No QR library — write a minimal QR encoder inline (≤ 300 lines). WebRTC uses the browser's built-in `RTCPeerConnection`.
- **No real Web Push.** Server-driven push requires VAPID-signed requests from a server — out of scope. Use `ServiceWorkerRegistration.showNotification()` scheduled while the SW is alive plus `periodicSync` registration where available; fall back to next-open in-app banners.
- **Package security.** Use `socket npm install` for every new package. Never bare `npm install`. Use `npm ci` only from a lockfile.
- **No tracking, no fingerprinting, no third-party analytics scripts** beyond Vercel's built-in Web Analytics.
- **TypeScript strict.** No `any`. No `// @ts-ignore` unless paired with a one-line justification comment.
- **Accessibility regression-free.** Every new interactive element needs proper ARIA, keyboard support, focus-visible states, and works at 200% zoom.
- **Mobile-first.** Every new screen/component must look right at 375px width. QR pairing must remain usable when the same phone is generating the QR (some screen-to-screen path required).
- **Backwards compatible storage.** Any change to `BurnRateData` or related shapes must include a one-shot migration from the v5 layout. Reading a v5 `localStorage` blob must hydrate cleanly without data loss.
- **Sync links remain backward compatible.** `BR1.` through `BR4.` payloads must still decode. Bump to `BR5.` for v6-only fields (profiles, owners, vault id, decoy state, notification opt-ins). The P2P sync transport uses the same `BR5.` payload format as URL sync.
- **Run `npm run build`, `npm run typecheck`, and `npm test` after every feature.** Build must exit 0. Tests must pass. Zero TypeScript errors.

---

# Feature 1 — Household Profiles & Cost Splits

**Goal:** A household isn't one wallet. Multiple profiles can co-exist in a single install; each subscription can be split across them with percentages; the dashboard slices burn-rate per profile and totals.

## Implementation

### Data model

- New persisted slice at `burnrate.profiles.v1`:
  ```ts
  export interface Profile {
    id: string;                              // stable
    name: string;
    avatarColor: string;                     // hex
    avatarInitials?: string;                 // optional override; default = first letter of name
    createdAt: string;
    isDefault?: boolean;                     // exactly one profile carries this — usually "Me"
  }

  export interface ProfilesState {
    items: Profile[];
    activeProfileId: string | null;          // null = "All profiles" view
  }
  ```
- Add an optional field to `Subscription` and `Trial`:
  ```ts
  owners?: Array<{ profileId: string; share: number }>;  // shares are 0..1, sum to 1 (±0.001 tolerance)
  ```
  Absent `owners` means the record is owned 100% by the default profile.

### Helpers

- New module `src/lib/profiles.ts`:
  ```ts
  export function normalizeOwners(owners: Owners | undefined, defaultProfileId: string): Owners;
  export function shareFor(sub: Subscription, profileId: string, defaultProfileId: string): number;
  export function splitMonthlyBurn(subs: Subscription[], profiles: Profile[], fx: FxContext): Record<string, number>;
  export function reassignOnProfileDelete(subs: Subscription[], deletedProfileId: string, fallbackProfileId: string): Subscription[];
  ```
- `normalizeOwners` clamps share values to `[0, 1]` and renormalizes so they sum to exactly 1.

### Migration

- On first v6 boot, seed a single default profile named "Me" (id `default`, `isDefault: true`). Existing subs have no `owners` field — interpreted as 100% to the default profile.

### UI

- Header: a profile switcher chip — a small pill with the active profile's initials + name (or "All" when `activeProfileId === null`). Clicking opens a popover with the profile list + "Manage profiles" link + "All profiles" toggle.
- Subscription add/edit form: an **Owners** section. Default state shows just the default profile at 100%. "Add profile to split" reveals the next profile with a draggable percentage slider; live total is shown and must equal 100%. Slider supports keyboard left/right arrows in 5% steps.
- Subscriptions view rows: when split, render a small stacked-bar avatar showing each owner's share next to the name.
- New dashboard module `PerProfileBurn.tsx` (id: `per-profile`, added to `DASHBOARD_MODULES`). When more than one profile exists, shows a horizontal bar chart per profile with each profile's monthly base-currency burn.
- The active-profile filter restricts every dashboard module to subscriptions where the active profile's share > 0; numbers are scaled by the share (e.g., a 50% split shows half).
- **Profiles settings panel** lists every profile with: rename, edit avatar color, delete (with a "reassign owned shares to <Other profile>" prompt). The default profile cannot be deleted but can be renamed.

## Success Criteria
- [ ] `normalizeOwners` is unit-tested in `src/lib/profiles.test.ts`: empty input → 100% to default; two-owner 60/30 → 60/40 after renormalization; clamp negatives to 0; clamp >1 to 1.
- [ ] `splitMonthlyBurn` is unit-tested: single profile, two profiles 50/50, three profiles 33/33/34 (sums to total within 1 cent), currency conversion respected.
- [ ] `reassignOnProfileDelete` moves shares of the deleted profile to a fallback profile, preserving sub-level totals.
- [ ] Active-profile filter scales monthly/yearly/category numbers correctly and doesn't drop a sub the user partially owns.
- [ ] Profiles round-trip through CSV (`recordType=profile`) and `BR5.` sync.
- [ ] Component test `OwnersEditor.test.tsx`: add profile to split, slider keyboard arrows, totals stay at 100%, cannot save when total ≠ 100%.
- [ ] Component test `ProfileSwitcher.test.tsx`: switcher shows count, "All" toggle exists, active profile persists across reload.
- [ ] Migration: a v5 sub with no `owners` hydrates correctly and reports 100% share to the default profile.

---

# Feature 2 — Peer-to-Peer Sync (WebRTC + QR Pairing)

**Goal:** Two devices in the same room (or across the world) can sync without uploading to anything. The user copies a payload from one device, pastes it into the other (or scans a QR), and confirms the transfer.

## Implementation

### Transport

- New module `src/lib/peer-sync.ts`:
  ```ts
  export type PeerRole = 'host' | 'guest';

  export interface PeerSession {
    role: PeerRole;
    pc: RTCPeerConnection;
    channel: RTCDataChannel | null;
    state: 'idle' | 'awaiting-answer' | 'awaiting-offer' | 'connected' | 'closed' | 'failed';
  }

  export async function createHostSession(opts?: { stunUrl?: string }): Promise<{ session: PeerSession; offer: string }>;
  export async function acceptHostOffer(offer: string, opts?: { stunUrl?: string }): Promise<{ session: PeerSession; answer: string }>;
  export async function completeHostHandshake(session: PeerSession, answer: string): Promise<void>;
  export async function sendPayload(session: PeerSession, payload: string): Promise<void>;
  export function onPayload(session: PeerSession, cb: (payload: string) => void): () => void;
  ```
- `offer` and `answer` are base64url-encoded JSON `{ sdp, candidates }` — gathered after a 2-second ICE-gathering wait (no trickle ICE in v6 — keeps the user flow simple).
- Default STUN server: `stun:stun.l.google.com:19302`. Users can override via a Settings field.

### Manual signaling flow

- New component `PeerSyncFlow.tsx` with two paths:
  - **Send (host)** — generates an offer string. Renders it as both a copyable text block AND a QR code (Feature 2 ships a tiny QR encoder). Prompts: "Open BurnRate on the other device, choose 'Receive,' and paste this offer (or scan)." Then renders a paste box for the returning answer.
  - **Receive (guest)** — paste box for the offer; on parse, renders the generated answer string + QR. Tells the user to paste it back on the sending device.
- After the handshake completes (data channel open), the host sends a `BR5.` payload (encoded via the same v4 sync encoder). The guest receives, validates, and routes through the existing v2 sync modal (Merge / Replace / Cancel).

### QR encoder

- New module `src/lib/qrcode.ts` — a from-scratch **micro QR / QR Code Model 2** encoder supporting binary mode at sizes up to version ~20 (offer strings fit in ~2 KB; pick the smallest version that holds the payload). License: BurnRate's own MIT. Render to an inline SVG (no canvas). ≤ 300 lines.
  - If the encoder cannot fit the payload at version 20, the UI falls back to "Use the paste flow — the offer is too large for a QR code on this device." This is a documented graceful degradation.

### UX safety

- Generated SDPs may include device-local network candidates → privacy banner above the offer: "This payload includes your local network address (needed for peering). Share only with someone you trust."
- After connection: a one-line status row shows the negotiated ICE candidate type (`host` / `srflx` / `relay`) so users on weird networks know what happened.
- Optional **public broker fallback**: a Settings toggle "Use PeerJS public broker" routes signaling through `peerjs.com`'s free broker (no account, no key). Disabled by default; the manual flow is the documented primary path.

## Success Criteria
- [ ] `peer-sync.ts` is unit-tested in `src/lib/peer-sync.test.ts` using `RTCPeerConnection` doubles for: offer creation, ICE gathering completion event, payload framing, payload reception, handshake failure surface.
- [ ] `qrcode.ts` is unit-tested in `src/lib/qrcode.test.ts` with ≥ 8 cases: empty string, single character, 100-byte payload, 1 KB payload, version-20 limit, character-set boundary cases. Output SVG is structurally valid (`<svg ... viewBox>` and module count matches the version's nominal grid).
- [ ] The handshake works between two BurnRate tabs in the same Chromium browser (verified manually + Playwright dual-context spec) using the manual paste path.
- [ ] Generated offer strings are decodable JSON with `sdp` and `candidates` fields.
- [ ] After connection, sending a `BR5.` payload that the receiver validates routes through the existing sync modal — Replace / Merge / Cancel all work.
- [ ] Privacy banner is visible in the "Send" path.
- [ ] No server-side state is introduced.
- [ ] Component test `PeerSyncFlow.test.tsx`: host path renders offer + QR; guest path renders answer after pasting a fixture offer; the flow is keyboard-accessible.
- [ ] Falling back from QR when the payload exceeds the encoder's capacity shows the documented copy-paste-only state.

---

# Feature 3 — Live Calendar Feed

**Goal:** Power users live in Google / Apple / Outlook Calendar. BurnRate emits a `webcal://` URL that any of those apps can subscribe to — auto-refreshing the user's renewals and trial-end dates on the calendar's schedule.

## Implementation

### Server-side route

- New App Router route `src/app/s/[payload]/calendar.ics/route.ts` (a route handler, not a page). It:
  - Receives the same lz-string base64url payload format used by the v2 `/s/[payload]` page (which already encodes `BurnRateData` with notes stripped).
  - Decodes and renders an ICS body using the existing `serializeBurnRateIcs` (v2 Feature 1). Uses a 12-month horizon.
  - Responds with `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: public, max-age=300, s-maxage=300` (5-minute revalidation — payload is in the URL so cache identity is per-payload).
  - On invalid payload returns 200 with a one-event ICS body whose `SUMMARY` is "This BurnRate calendar link is invalid — regenerate from the app" so calendar clients don't error out.
- Route is dynamic (`export const dynamic = 'force-dynamic'`) — server reads only the URL path; no data flows from disk or external systems.

### Client side

- Extend Settings → Share with a **Subscribe to live calendar** button. It:
  - Strips notes from a clone of `BurnRateData`.
  - Builds the same `BR5.`-encoded payload used by `/s/[payload]`.
  - Composes a `webcal://<host>/s/<payload>/calendar.ics` URL and copies it to the clipboard. Provides an "Open in calendar" button that uses `window.location.href = webcalUrl` so the OS handles the protocol.
  - Surfaces a prominent banner: "This URL is your live calendar. Anyone with it can read your renewals — regenerate to revoke."
  - Records a `liveCalendar.generatedAt: ISO` field in preferences so users can see when they last created one. Re-generation overwrites the local record but does **not** invalidate older URLs (impossible without server state — call this out explicitly).

### ICS regeneration logic

- The route uses a **fresh** `serializeBurnRateIcs` call each request, so a new payload (regenerated by the user and re-subscribed in the calendar) reflects the latest data. URLs are payload-keyed, so the user must paste a new URL when they want a fresh snapshot.

## Success Criteria
- [ ] Visiting `/s/<valid-payload>/calendar.ics` returns an ICS body with the correct `Content-Type` and at least one `BEGIN:VEVENT` block.
- [ ] Visiting `/s/<garbage-payload>/calendar.ics` returns 200 with a single-event ICS whose SUMMARY says the link is invalid.
- [ ] The route is integration-tested in `src/app/s/calendar-route.test.ts` against a known fixture payload.
- [ ] The webcal URL parses correctly when copied to Google Calendar (manually verified — note in commit: "verified Google Calendar subscribe on YYYY-MM-DD") OR via a Vitest assertion of the response body's RFC 5545 structural validity.
- [ ] The banner copy explicitly says "regenerate to revoke" because the URL itself carries the data.
- [ ] No notes leak — payload encoding strips notes the same way the v2 share encoder does. Verified with a test that includes `notes: "secret"` in the source data and asserts the served ICS does not contain "secret".
- [ ] The route's cache headers are `public, max-age=300, s-maxage=300`.
- [ ] Settings UI shows the last-generated timestamp.

---

# Feature 4 — Encrypted Share Links

**Goal:** Public share links (v2) leak whatever's in the payload. v6 adds a passphrase wrapper so the user can publish a URL safely and the recipient unlocks it in their browser.

## Implementation

### Encoding

- Extend the v3 `crypto.ts` with two helpers:
  ```ts
  export async function encryptForShare(plaintext: string, passphrase: string): Promise<{ envelope: string; salt: string }>;
  export async function decryptFromShare(envelope: string, passphrase: string): Promise<string>;
  ```
- Envelope format (base64url): `ENC2.<base64url(salt|iv|ciphertext)>`. PBKDF2 (SHA-256, 250,000 iterations) → AES-GCM 256, 12-byte random IV. Same primitives the vault uses; different prefix (`ENC2.` vs the vault's `ENC1.`) to disambiguate.
- New encoded share payload: `BR5E.` (encrypted) wrapping `BR5.` after envelope decryption.

### Route

- Extend `src/app/s/[payload]/page.tsx`:
  - If the payload's prefix is `BR5E.`, render a passphrase entry view instead of the read-only summary. On valid decrypt, hydrate and render the existing summary.
  - 5 wrong attempts → 30-second cool-down (mirrors v3 lock screen behavior).
  - Decryption happens entirely client-side. The server never sees the passphrase.
- The OG image route (`/s/[payload]/opengraph-image`) returns a **generic** card for encrypted payloads ("This BurnRate summary is passphrase-protected") so social-card previews don't try to render summaries they can't decrypt.

### Generation flow

- "Generate encrypted share link" button next to the existing "Generate share link" in Settings → Share. Prompts for a per-link passphrase, confirms once, then copies the `https://.../s/<BR5E.payload>` URL. The user is responsible for delivering the passphrase out-of-band — BurnRate never transmits or stores it.

## Success Criteria
- [ ] `encryptForShare` + `decryptFromShare` round-trip tested in `src/lib/crypto.share.test.ts`: correct passphrase decrypts; wrong passphrase throws; tampering with the envelope throws; IV uniqueness across calls.
- [ ] Visiting an encrypted share URL renders the passphrase entry view, not the summary.
- [ ] 5 wrong passphrases imposes the 30-second cool-down (verified with a manual delay or fake timers).
- [ ] OG image for `BR5E.` payloads renders the generic protected card with no user data leaked (verified by inspecting the response bytes for absence of subscription names).
- [ ] Component test `EncryptedSharePage.test.tsx`: render passphrase form, wrong then right passphrase → summary appears, cool-down trigger after 5 fails.
- [ ] Generation flow does not ever send the passphrase to the server (verified by absence of fetch calls during the encryption phase).
- [ ] Backward compatibility: `/s/<BR5.>` and `/s/<BR2.>` summaries continue to render without a passphrase prompt.

---

# Feature 5 — Decoy Mode

**Goal:** Some users live with risk (abusive household, financial coercion, journalism). v6 lets them set a *second* "duress" passphrase that unlocks a fake, pre-seeded BurnRate state — indistinguishable in UI from the real one.

## Implementation

### Vault meta

- Extend the v3 `VaultMeta` (`burnrate.vault.v1`):
  ```ts
  interface VaultMeta {
    enabled: boolean;
    salt: string;
    verifier: string;                        // real-passphrase verifier
    iterations: number;
    decoy?: {
      verifier: string;                      // separate AES-GCM verifier for the decoy passphrase
      salt: string;
      enabled: boolean;
    };
  }
  ```
- Decoy state lives in a parallel localStorage namespace prefix: every storage key gains a per-slot prefix (`burnrate.real.subscriptions.v1` vs `burnrate.decoy.subscriptions.v1`). The unlock flow chooses the slot atomically and the app reads only from the chosen slot for the lifetime of the unlock session.

### Migration

- On first v6 boot with `vault.enabled === true`, transparently migrate every `burnrate.<key>` to `burnrate.real.<key>`. A non-vaulted install does the same migration on enabling the vault.

### Decoy setup flow

- New Settings flow: when the vault is enabled, "Enable decoy mode" reveals:
  - A second passphrase input (with confirm).
  - A **seed strategy** picker: *Use built-in demo data*, *Seed from my real data with names changed and amounts halved*, or *Start empty*.
- The chosen seed strategy populates the decoy slot with believable-looking subs (built-in demo: 6 popular services with plausible amounts). Decoy data is **separately encrypted** with the decoy passphrase.
- After setup, the lock screen accepts either passphrase and routes the unlock accordingly. No banner says "decoy unlocked" — that would defeat the point.

### Indistinguishability constraints

- The status bar, header, theme, currency, and dashboard layout are **shared** across slots (one set of preferences lives outside the slotted namespace) so the UI doesn't visibly change when the user toggles which slot is active.
- The audit-log slice is per-slot — a snoop cannot see the real slot's history from the decoy slot.
- Disabling decoy mode wipes the decoy slot's storage; the user is warned.

## Success Criteria
- [ ] Setting up decoy mode populates `burnrate.decoy.*` keys with encrypted blobs; `burnrate.real.*` keys are untouched.
- [ ] Unlocking with the real passphrase loads real subs; unlocking with the decoy passphrase loads decoy subs. Verified in `src/lib/vault.decoy.test.ts`.
- [ ] The UI does not signal which slot is active beyond the data shown (no chip, no header label, no "decoy mode" toast).
- [ ] Audit logs are isolated per slot — adding a sub in decoy mode does not appear in the real-mode log.
- [ ] Disabling decoy mode wipes only the decoy slot; the real slot survives.
- [ ] Forgetting the real passphrase still requires the explicit v3 "wipe and disable" path; the decoy slot does not provide a recovery shortcut to the real slot.
- [ ] Component test `DecoySetup.test.tsx`: seed strategies each produce the expected fixture data; second-passphrase confirm mismatch is rejected.
- [ ] CSV import/export operates on the active slot only — switching slots changes what the export contains.
- [ ] Lock screen does not log or expose which slot a passphrase mapped to.

---

# Feature 6 — Notification Hub

**Goal:** Renewals, trial-end alerts, price changes, goal transitions, and discount expirations should reach the user even when the app isn't open. Without a push server, we get as close as the browser allows.

## Implementation

### Capability layer

- New module `src/lib/notify.ts`:
  ```ts
  export type NotifyChannel = 'renewal' | 'trial-end' | 'price-change' | 'goal' | 'discount-expiry' | 'pending-cancel';

  export interface NotifySettings {
    enabled: boolean;
    channels: Record<NotifyChannel, boolean>;
    quietHoursStart?: string;                // "22:00"
    quietHoursEnd?: string;                  // "07:00"
    leadTimeDays: Record<'renewal' | 'trial-end' | 'discount-expiry', number>;
  }

  export async function ensurePermission(): Promise<NotificationPermission>;
  export function scheduleAll(state: AppState, settings: NotifySettings, now: Date): ScheduledNotification[];
  export function pruneFiredScheduled(stored: ScheduledNotification[], firedIds: string[]): ScheduledNotification[];
  ```
- `scheduleAll` is a pure deterministic enumeration of every notification that *should* fire within the next 30 days, returning a list of `{ id, fireAt, channel, title, body, recordRef? }`. The actual firing is the SW's job (below).

### Service worker

- Extend `public/sw.js`:
  - On `install`, register `periodicSync` (`burnrate-tick`) at minimum interval 12 hours; gracefully no-op if `permission` isn't granted or the browser doesn't support it.
  - On `periodicsync` event with tag `burnrate-tick`, open IndexedDB, read the scheduled list (the page writes the latest schedule on every load), pop any notifications whose `fireAt` ≤ now, call `registration.showNotification(title, { body, tag, data: { channel, recordRef } })`, and write the survivor list back.
  - On notification click, focus an open BurnRate tab or open `/` and post a message to the page with the `data.recordRef` so the app can deep-link to the relevant row.
- New IDB store `scheduled-notifications` in the existing `burnrate` database (bump db version to 2). Migration on open. Object store keyed by `id`.

### Page-level scheduling

- On every render of `BurnRateApp.tsx`, recompute `scheduleAll(...)` and write it to IDB. This keeps the SW's notification queue authoritative against the latest state.
- Fallback for browsers without `periodicSync`: schedule individual `setTimeout`-driven `showNotification` calls while the tab is open. On next open, replay any "missed" notifications as in-app banner toasts (deduped by id).

### UI

- New Settings section **Notifications**:
  - Master toggle (calls `ensurePermission()`).
  - Per-channel toggles.
  - Quiet hours pickers.
  - Per-channel lead-time inputs (renewals: 1–7 days; trials: 1–14 days; discount expiry: 1–30 days).
  - "Test notification" button that fires one immediately so the user can see what it looks like.
- A small status row indicates which delivery mode is active (`Real periodic sync` / `Open-app only`) based on capability detection.

## Success Criteria
- [ ] `scheduleAll` is unit-tested in `src/lib/notify.test.ts` covering: each channel, quiet-hours suppression (events inside the quiet window slide to the next eligible hour), 30-day horizon cap, lead-time correctness.
- [ ] `pruneFiredScheduled` removes the right entries without dropping unrelated ones.
- [ ] `NotifySettings` round-trips through preferences and `BR5.` sync.
- [ ] Permission request is gated behind a user gesture (clicking the master toggle) — no auto-prompt on boot.
- [ ] In a browser without `periodicSync`, the setting status row reads "Open-app only."
- [ ] The SW's notification-click handler focuses an existing BurnRate tab or opens `/` (covered by a Playwright spec with two tabs).
- [ ] "Test notification" fires within 1 second of click.
- [ ] No notifications fire during quiet hours; missed notifications surface as banner toasts on next open.
- [ ] No server push is involved — Network tab shows no outgoing requests during scheduling or firing.

---

# Feature 7 — Multi-Vault Switcher

**Goal:** One person, three contexts: personal subs, business subs, household subs. Each context has its own data, its own lock, and its own sync. v6 lets the user create vaults inside one BurnRate install and switch between them.

## Implementation

### Vault registry

- New persisted slice `burnrate.vault-registry.v1` (always plaintext, even when individual vaults are encrypted):
  ```ts
  export interface VaultRegistryEntry {
    id: string;                              // stable
    label: string;
    color: string;
    createdAt: string;
    isLocked: boolean;                       // mirrors per-vault VaultMeta.enabled
    lastUsedAt?: string;
  }

  export interface VaultRegistry {
    items: VaultRegistryEntry[];
    activeVaultId: string;
  }
  ```
- Every existing per-vault storage key is namespaced as `burnrate.vault.<vaultId>.<key>` (e.g., `burnrate.vault.personal.subscriptions.v1`). Both `<vaultId>` slots and per-vault decoy slots from Feature 5 stack — full key becomes `burnrate.vault.<vaultId>.<slot>.<key>` where `<slot>` is `real` or `decoy`.

### Migration

- On first v6 boot, all v5 keys `burnrate.<key>` migrate to `burnrate.vault.default.real.<key>` (or `.decoy.` if Feature 5's decoy is enabled). The migration runs once and is idempotent.

### Switch flow

- Header gains a vault switcher next to the profile switcher: shows the active vault's color dot + label. Click opens a popover listing every vault with status (locked / unlocked) + "Manage vaults" link + "New vault" action.
- Switching vaults clears in-memory state and re-hydrates from the chosen vault's storage. If the target vault is locked, the lock screen appears with the chosen vault's context.
- New `VaultManager.tsx` panel in Settings: list vaults, create (label + color + optional initial lock passphrase), rename, delete (requires unlocking the target vault first and a typed-confirm).
- Sync (URL + P2P): payloads are scoped to the active vault. The sync modal includes a "Import as a new vault" option in addition to Merge / Replace / Cancel — useful for receiving a partner's vault from another device.
- Audit log, snapshots, ledger, goals, cancellation attempts: each per-vault.

### Locking semantics

- Each vault has its own `VaultMeta` (and its own decoy meta from Feature 5). Switching to a locked vault triggers `LockScreen` scoped to that vault's meta.
- Auto-lock (v3) operates per-active-vault: when the page is hidden for ≥ N minutes, the active vault re-locks; other vaults remain in whatever state they were last in.

## Success Criteria
- [ ] Migration test in `src/lib/vault-registry.test.ts` verifies a v5 install's keys all live under `burnrate.vault.default.real.*` after the first v6 boot and the original keys are removed.
- [ ] Creating a second vault, switching to it, adding a sub, switching back leaves the original vault's subs untouched.
- [ ] Deleting a vault requires it to be unlocked AND a typed confirmation.
- [ ] The active vault's id round-trips through `BR5.` (sync receiver chooses target vault: existing or new).
- [ ] Sync modal's new "Import as new vault" option creates a fresh vault entry and populates only that vault's keys.
- [ ] Auto-lock re-locks the active vault only — other vaults stay as the user left them.
- [ ] Component test `VaultSwitcher.test.tsx`: lists vaults, switches, persists, locked indicator renders.
- [ ] Component test `VaultManager.test.tsx`: create, rename, delete (with confirm), color picker.
- [ ] No regression in single-vault flows — a user who never creates a second vault sees the same UX as v5.

---

# Cross-Feature Polish (also required)

- **Header.** Becomes: app name → vault switcher (Feature 7) → profile switcher (Feature 1) → notifications icon (Feature 6) → palette button → install (PWA) → theme toggle. At 375px, collapse vault + profile into a single "context" chip that opens a unified popover.
- **Settings tab section order.** *Currency* → *Security* (now includes decoy from Feature 5) → *Profiles* (Feature 1) → *Vaults* (Feature 7) → *Notifications* (Feature 6) → *Profile import/export* (v4 Feature 7) → *Goals* → *Categories* → *Dashboard layout* → *Saved views* → *Reports* (v5) → *Cancellation attempts* (v5) → *Backup* → *Bulk add* → *Sync* (now includes peer + live calendar + encrypted share) → *Share* → *Danger zone*.
- **Migration.** `migrateBurnRateData(stored): BurnRateData` in `src/lib/migrate.ts` handles the v5 → v6 schema bump (profiles + per-vault namespacing). Bump `SCHEMA_VERSION` to **6**.
- **Sync prefix bump.** Add `BR5.` and `BR5E.` (encrypted variant). Continue to read `BR1.` through `BR4.` indefinitely.
- **A11y sweep.** QR codes have an `aria-label` describing the contained content type ("WebRTC pairing offer — 1.3 KB"). Notifications mode toggles announce the granted permission level. Vault switcher and profile switcher are reachable via keyboard with screen-reader-correct semantics.
- **PWA manifest update.** Add notification permission to the manifest's `permissions` (where applicable for installable PWAs) and ensure the SW registration survives the multi-vault and decoy-mode boots.

## Cross-Feature Success Criteria
- [ ] V5 storage hydrates cleanly into v6 — fixture test asserts the resulting namespaced keys and `BurnRateData` shape.
- [ ] Header collapses cleanly at 375px.
- [ ] `npm run typecheck` and `npm test` stay green throughout.
- [ ] No console warnings on first load.

---

# Required Documentation Updates

- Update `README.md`:
  - Add v6 features to the feature list (Profiles + cost splits, P2P sync via WebRTC + QR, Live calendar feed, Encrypted share links, Decoy mode, Notification hub, Multi-vault switcher).
  - Update the privacy section: the `webcal://` URL carries data in cleartext; encrypted share links are AES-GCM-wrapped and require the passphrase out-of-band; P2P sync is end-to-end on the data channel but the *signaling* (offer/answer strings) carries SDP including network candidates → must be shared only with trusted parties.
- Update `docs/architecture.md` to a "v6" version reflecting:
  - The new namespaced storage layout (`burnrate.vault.<vaultId>.<slot>.<key>`).
  - The new pure libs (`profiles.ts`, `peer-sync.ts`, `qrcode.ts`, `notify.ts`, `vault-registry.ts`) and the share-encryption helpers.
  - The new route `/s/[payload]/calendar.ics`.
  - The IDB v2 store `scheduled-notifications`.
  - The schema-version bump.
- Create `docs/progress/v6.md` and maintain it as you go (one section per feature, with Started / Decisions / Tests added / Verified).
- Mark `docs/specs/goal5.md` historical and reference `docs/specs/goal6.md` as the active goal.

---

# Final Verification Checklist

Before declaring the milestone complete, run every step below and confirm green. **Do not stop until every box can be checked.**

1. [ ] `npm run typecheck` → 0 errors.
2. [ ] `npm test` → all unit + component tests pass (target: ≥ 480 tests after v6).
3. [ ] `npm run build` → exits 0, produces a working `.next/` output.
4. [ ] `npm run dev` and manually walk through:
   - [ ] Create a second profile "Partner" → split Netflix 50/50 → "All profiles" view shows full Netflix; switch to "Me" → Netflix burn halves.
   - [ ] Open two browser tabs side-by-side, run the Peer Sync flow tab-A → tab-B via paste path → tab-B sync modal appears → Replace flow restores data.
   - [ ] Subscribe to the live calendar URL in Google Calendar (or assert via the route's response that the ICS body parses).
   - [ ] Generate an encrypted share link → open in an incognito tab → wrong passphrase fails → right passphrase reveals the summary.
   - [ ] Set up decoy mode → reload → unlock with decoy passphrase → see the seeded demo data; switch unlock to real passphrase → real data appears; UI is indistinguishable across both unlocks.
   - [ ] Enable notifications → "Test notification" fires → schedule a trial ending in 2 days → after fast-forwarding the system clock + reloading, the trial-end notification appears (or surfaces as an in-app banner on browsers without periodic sync).
   - [ ] Create a second vault "Work" → switch to it → add a sub → switch back to default → original subs intact.
   - [ ] `BR1.` through `BR4.` payloads from prior versions still decode.
   - [ ] PWA install still works; offline still serves the cached shell; SW notification clicks open the app.
   - [ ] 375px viewport — every new screen and modal is usable; header collapse works; QR codes display at a scannable size.
   - [ ] Light mode and dark mode both look correct on every new surface.
5. [ ] Lighthouse on `localhost:3000`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95, PWA ≥ 90.
6. [ ] Home-route gzipped client JS ≤ 170KB (v5 baseline was ≤ 150KB; +20KB budget for the new surfaces — record before/after in the commit message).
7. [ ] Vercel preview deploy succeeds; the deployed URL works end-to-end — both the home route and `/s/<payload>/calendar.ics`.
8. [ ] No new third-party scripts loaded at runtime. STUN connection is to `stun:` only (no HTTPS fallback used by default).
9. [ ] No server-side state introduced — the only server work is the stateless `/s/<payload>/calendar.ics` route, which derives output purely from the path payload.
10. [ ] `socket scan` (if a token is available) reports 0 high-severity issues. Otherwise note "no token, skipped — manual review done."
11. [ ] Every feature's individual success-criteria list above is fully checked.

---

# Stopping Condition

**Stop only when every check above is green and the progress log shows every feature `Verified`.** If you hit an obstacle, document it in `docs/progress/v6.md`, attempt a workaround, and only escalate to a human if the workaround would violate a hard constraint above.
