# Comment for the "Fill the league" sub-issue (FLI-Golf/FLI-Platform-Delivery)

> Note: the FLI-Platform-Delivery repository was not visible to the token used
> for this run (404 on `gh api repos/FLI-Golf/FLI-Platform-Delivery`), so this
> summary could not be posted automatically. Paste it into the existing
> "Fill the league" sub-issue; do not create a duplicate, do not publish the
> video, and do not close the issue.

---

## Fill the league — walkthrough complete

**Video:** `demo/captures/fill-the-league/fill-the-league-walkthrough.mp4`
(51 s, 1280×720 H.264 with ElevenLabs voice narration; git-ignored, one page at
a time — owner start, five joins, final verification). Repeatable command:

```bash
npm install && npx playwright install chromium --with-deps
npx playwright test fill-the-league   # or: npm run demo:fill-league
node scripts/generate-fill-the-league-narration.js   # narration (needs ELEVENLABS_API_KEY)
```

**Commit / environment:** `18c7762` on branch `feat/fill-the-league-walkthrough`
(FLI-Golf/leagueDiagram, forked from the Playwright demo branch). Playwright
1.63.0, Chromium headless, Node v24.21.0, Ubuntu 24.04 dev container.

**Role → action → observed result**

| Role | Action (via UI) | Observed result |
| --- | --- | --- |
| Fantasy Owner | Opened Fantasy league | Lobby "1 of 6", only owner listed; no join action offered to owner |
| Owen Bell | Signed in (mock switcher), Join league | Count → "2 of 6", Owen listed |
| Nina Alvarez | Signed in, Join league | Count → "3 of 6" |
| Harper Quinn | Signed in, Join league | Count → "4 of 6" |
| Marcus Webb | Signed in, Join league | Count → "5 of 6" |
| Taylor Reed | Signed in, Join league | Count → "6 of 6", "League full" note |
| Fantasy Owner | Reloaded, re-opened Fantasy league | Still "6 of 6", six members, one Owner row |
| Fantasy Owner | Seed fantasy draft | App confirms readiness: "Sunset Open draft" lobby + enabled Start draft |

**How the 6-of-6 trigger is built:** when the lobby hits 6 of 6, the panel
shows the live source of the trigger from `src/domain/draft/MockDraftSeries.ts`
(read from disk by the dev server, real line numbers) with arrow markers on the
trigger lines: `join()` → `buildIfReady()` → one `DraftRoom` per remaining
tournament, all built the moment the league fills. Snapshots for the team:
`demo/captures/fill-the-league/code-trigger-panel.png` and `league-lobby-full.png`
(Playwright screenshots render the CSS-annotated panel; Playwright itself does
not auto-annotate code).

**Seeded (not part of joins):** synthetic mock accounts already ship in
`userDirectory`; the setup step calls `POST /api/demo/fantasy-league/reset` so
the league starts owner-only. Every join went through the UI from a separate
authenticated browser context.

**Verification:** all six memberships under one `leagueId` (`league-demo`);
owner counted once (seeded first, never re-joinable); memberships intact after
reload; spec passed (1/1). Unit tests 123/123; no new typecheck errors.

**Known gaps / blocker found first:** the app previously had no per-participant
join UI (only a bulk "Seed fantasy draft" button) and no membership
persistence — documented with evidence in `demo/fill-the-league.md`. The demo
uses a dev-server-only lobby API as the local persistence stand-in (in-memory;
dev-server restart resets it; not present in production builds). Mock
current-user switching stands in for real auth. Invitations
(`UserLeague.invite`/`acceptInvite`) remain domain-only. Draft readiness is
claimed only as far as the app confirms it (seeded draft lobby + Start draft).
