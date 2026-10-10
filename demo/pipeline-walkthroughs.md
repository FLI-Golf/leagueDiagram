# Pipeline walkthroughs — scorekeeping approval, fantasy scoring, content approval

Three short narrated walkthroughs covering the app's approval gates and the
projected→official flip, recorded with the same conventions as
[fill-the-league.md](fill-the-league.md) (caption overlays, ElevenLabs
narration, git-ignored captures, finals in `demo/exports/`). All are single
continuous sessions: scorekeeper/content state persists in localStorage per
browser, and the mock account switcher is the app's real role flow.

## Scorekeeping pipeline (26 s)

`demo/exports/scorekeeping-pipeline/scorekeeping-pipeline.mp4`

1. **Ava Park** (scorekeeper) opens her group's hole-by-hole scorecard, enters
   scores, submits hole 1 — the round advances to hole 2.
2. Fast-forward via the **Seed all group scores** development control: every
   group's card is complete.
3. **League Admin** opens Approve scores: approval is blocked until every card
   is complete, then **Approve all scores** confirms the round and the team
   finish order appears.

Verified: hole advances after submit; approve-all is enabled once cards are
complete; "Team finish order" appears after approval.

## Fantasy scoring (22 s)

`demo/exports/fantasy-scoring/fantasy-scoring.mp4`

1. The owner seeds and completes the draft; the **Fantasy team leaderboard**
   is marked *Projected* ("Not scored yet — an admin has to confirm…").
2. Scores are confirmed (development fast-path: **Seed scored event + draft**),
   and the same leaderboard flips to real totals — "Every pro carries their
   round score onto the fantasy roster that drafted them. Lowest four-player
   total wins."

Verified: *Projected* badge visible before, gone after; official note text
appears; score column shows relative-to-par totals.

## Content approval (21 s)

`demo/exports/content-approval/content-approval.mp4`

1. **Simon Lizotte** (pro) writes an update and submits it — it shows
   *Pending league review* and stays private.
2. **League Admin** opens Content review, sees the pending post, and clicks
   **Approve & publish** — the decision log marks it *Published*.
3. The post is live on Simon's public profile (`/pros/pro-1`; pro profile
   routes are positional, not name-based).

Verified: pending state after submit; "Simon Lizotte — Published" after
approval; post text visible on the public profile.

## Repeatable recording commands

```bash
npm install && npx playwright install chromium --with-deps
npx playwright test demo/scripts/scorekeeping-pipeline.spec.ts   # or: npm run demo:scorekeeping
npx playwright test demo/scripts/fantasy-scoring.spec.ts         # or: npm run demo:fantasy-scoring
npx playwright test demo/scripts/content-approval.spec.ts        # or: npm run demo:content-approval
node scripts/generate-walkthrough-narration.js --name=scorekeeping-pipeline
node scripts/generate-walkthrough-narration.js --name=fantasy-scoring
node scripts/generate-walkthrough-narration.js --name=content-approval
```

Note: run specs by exact path — `playwright test scorekeeping-pipeline` also
matches the older `part-2-scorekeeping-pipeline.spec.ts` demo.

## Known gaps

- Fast-forward controls are the app's development seeds; the full
  hole-by-hole round (18 holes × 6 groups) is real but too long for video.
- The mock current-user switcher stands in for auth; each session is one
  browser context because state persistence is per-browser localStorage.
