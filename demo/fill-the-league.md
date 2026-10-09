# Fill the league — owner plus five participants join

Playwright feature walkthrough for the "Fill the league" sub-issue in
`FLI-Golf/FLI-Platform-Delivery`.

## How league creation, ownership, invitations, and joining work today

Evidence from the codebase **before** this change:

- **League creation / ownership** — `src/domain/league/UserLeague.ts` sets the
  owner in the constructor and stores one `LeagueMembership` per participant
  (`role: 'owner' | 'member'`). Season seeds build the league via
  `SeasonService.createNamedSeason(...)`; the UI exposes season creation
  ("Create season" form) but no membership management screen.
- **Invitations** — `UserLeague.invite()` / `UserLeague.acceptInvite()` and
  `src/domain/league/LeagueInvite.ts` exist only in the domain layer and unit
  tests (`src/domain/league/LeagueCreation.test.ts`). No UI calls them.
- **Participant joining** — `src/domain/draft/MockDraftSeries.ts`
  (`join()`, `REQUIRED_PARTICIPANTS = 6`, rejects duplicates and a seventh
  join) is the real "fill" rule. The only UI path that fills the lobby is the
  single **Seed fantasy draft** development button in `src/main.ts`
  (`seedFantasyDraft()`), which joins all five hard-coded participants
  (`fantasyDraftParticipantIds`) in one click. There is **no per-participant
  join action in the UI**.
- **Authentication** — there is no real auth; the app uses the mock
  current-user switcher ("Signed in as" + "Switch account"), persisted per
  browser in `localStorage` (`league-demo-current-user`).
- **Persistence** — `localStorage` keeps the season metadata, current mock
  user, scorekeeper state, and fan posts only. League/draft memberships are
  in-memory and are lost on reload.

## Blocker (documented before application changes)

The walkthrough requires five participants to **join individually through the
UI**, each from a **separate authenticated browser context**, with the
participant count progressing to six and memberships **surviving a reload**.
That is impossible with the app as-is:

1. The only fill action is one bulk button that joins all five participants at
   once (no per-user join UI exists).
2. Membership state is in-memory per page, so separate browser contexts cannot
   see each other's joins, and a reload drops all memberships.

**Minimal change made to unblock (test/demo-only):**

- A dev-server-only membership stand-in: the Vite dev middleware exposes
  `GET/POST /api/demo/fantasy-league` (`join` / `reset`) holding the fantasy
  league lobby in dev-server memory, mirroring the domain rules from
  `MockDraftSeries.join()` (owner seeded first, max six, no duplicates). This
  is the local/test persistence stand-in for the backend the prototype does
  not have; it only exists when running `npm run dev`.
- The real UI workflow is reused as-is: mock account switching and the
  Fantasy league / home dashboard. A "Join league" action was added to a new
  **Fantasy league lobby** panel so each signed-in mock user joins through the
  UI. No domain behavior was changed.

## How the 6-of-6 trigger works (code reference for the team)

The walkthrough video intentionally shows only the application UI — no code or
terminal displays. For the team, the fill trigger lives in
`src/domain/draft/MockDraftSeries.ts`: `join()` rejects duplicates and a
seventh participant, then calls `buildIfReady()` (line ~70-97); the moment the
sixth participant joins, `buildIfReady()` builds one `DraftRoom` per remaining
tournament, so every draft room exists as soon as the league fills. In the UI
the league lobby reaches "League full — 6 of 6 participants", and the app's
existing confirmation is seeding the draft into the "Sunset Open draft" lobby
with an enabled **Start draft** button.

## Seeded setup (not part of the joins)

- Synthetic accounts already ship in `src/main.ts` (`userDirectory`):
  owner `fantasy-owner` plus participants `owen-bell`, `nina-alvarez`,
  `harper-quinn`, `marcus-webb`, `taylor-reed` — the same five IDs the
  app's draft seeding uses.
- The walkthrough's setup step calls `POST /api/demo/fantasy-league/reset` so
  the league starts with exactly the owner. Every join after that happens
  through the UI, one per authenticated browser context.

## Repeatable recording command

```bash
npm install
npx playwright install chromium --with-deps
npx playwright test fill-the-league   # records segments + stitches the MP4
node scripts/generate-fill-the-league-narration.js   # optional: adds ElevenLabs narration (needs ELEVENLABS_API_KEY, reads .env)
```

The spec records one video per browser context and saves them under
`demo/captures/fill-the-league/` (intermediates — Playwright wipes
`demo/captures` at the start of every test run); when FFmpeg is available they
are stitched in join order into the final deliverable
`demo/exports/fill-the-league/fill-the-league-walkthrough.mp4`.
The narration script generates one ElevenLabs clip per segment, muxes each clip
with its segment, and re-stitches the final narrated MP4 at the same path.
Short caption bars are injected as a DOM overlay (`demo/helpers/demoCaptions.ts`)
so explanations appear in the recording without post-production.

Video cut (application UI only, ~38 s): owner with a league of one → first two
joins on camera (Owen Bell, Nina Alvarez) → the final join on camera
(Taylor Reed, 6 of 6) → the owner reloading to show the full six-member list
and the seeded draft lobby. Participants three and four (Harper Quinn, Marcus
Webb) still join through the same UI in their own contexts, just off-camera, to
keep the video short. `demo/captures/` and `demo/exports/` are git-ignored; no
authentication state is written to disk.

## Verification results

Recorded run on the `feat/fill-the-league-walkthrough` branch (Playwright
1.63.0, Chromium headless, Node v24.21.0, Ubuntu 24.04 dev container):

- **Count progression** — the lobby badge progressed `1 of 6` → `2 of 6` → … →
  `6 of 6`, asserted after each UI join.
- **Same league** — `GET /api/demo/fantasy-league` returned a single
  `leagueId` (`league-demo`) with all six memberships under it.
- **Owner counted once** — the owner is seeded first, is never offered the
  "Join league" action, the list shows exactly one "Owner" row, and the API
  shows `fantasy-owner` exactly once.
- **Reload persistence** — after `page.reload()`, the lobby still showed
  `6 of 6` with all six members listed.
- **Draft readiness** — only what the app confirms: at `6 of 6` the lobby
  shows "League full — 6 of 6 participants", and clicking the existing
  **Seed fantasy draft** action built the real "Sunset Open draft" lobby with
  an enabled **Start draft** button. Nothing beyond that is claimed.
- **Video** — 5 narrated, captioned segments (application UI only) stitched to
  `demo/exports/fill-the-league/fill-the-league-walkthrough.mp4`, 37.7 s,
  1280×720 H.264 + AAC narration (ElevenLabs, one clip per segment).
  Playwright: 1 passed.

## Known gaps

- The prototype has no real auth or backend: the mock current-user switcher
  stands in for sign-in, and the lobby store is dev-server memory (a dev-server
  restart resets it; `vite preview`/production builds do not serve the lobby
  API, where the panel reports itself unavailable).
- Invitations (`UserLeague.invite`/`acceptInvite`) remain domain-only; the
  demo join is direct membership, mirroring `MockDraftSeries.join()` rules.
- Seeding the draft still uses the app's five hard-coded participant IDs
  (the same accounts used here); joining the lobby does not itself build
  draft rooms — readiness is confirmed by the seeded draft lobby, as the app
  has always done.
- Six pre-existing `tsc --noEmit` errors on the base demo branch are
  untouched; no new ones were introduced. `npm test` passes (123 tests).
