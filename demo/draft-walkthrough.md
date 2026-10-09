# Draft walkthrough — owner seeds, starts, and completes the draft

Playwright walkthrough of the fantasy draft, companion to
[fill-the-league.md](fill-the-league.md) (same conventions: dev-server lobby
stand-in, caption overlays, ElevenLabs narration, git-ignored captures).

## What the video shows (application UI only, ~31 s)

One continuous owner session on the Fantasy league page:

1. **Seed the draft** — the league lobby reads 6 of 6; the owner clicks
   **Seed fantasy draft**, which builds one draft room per remaining
   tournament (`MockDraftSeries`), and the "Sunset Open draft" lobby appears
   with an enabled **Start draft** button.
2. **Start the draft** — the 7-second pick clock runs live; when it hits zero
   the recommended pro is auto-picked. The pick log ("Picks so far") fills
   with the first picks while roster tiles show "N of 4 drafted".
3. **Complete the draft** — the owner fast-forwards with the **Complete
   draft** development control; the "Final rosters / Fantasy team leaderboard"
   lists all six fantasy teams with their MPO/FPO rosters, marked *Projected*
   until an admin confirms event scores.

## Seeded / off-camera setup

- The five lobby joins happen through the same join UI in their own browser
  contexts, off-camera, so the owner's view shows the full 6-of-6 league (the
  draft series itself is in-memory per page and needs no lobby state).
- Synthetic accounts are the ones already shipping in `userDirectory`.

## Verification (asserted in the spec)

- Draft lobby heading "Sunset Open draft" and enabled **Start draft** after seeding.
- "Round 1 · Pick 1" banner and a running pick clock after **Start draft**.
- At least two auto-picks land in the pick log while watching live.
- After **Complete draft**: "Fantasy team leaderboard" with exactly six rows.

## Repeatable recording command

```bash
npm install && npx playwright install chromium --with-deps
npx playwright test draft-walkthrough              # or: npm run demo:draft
node scripts/generate-draft-walkthrough-narration.js   # narration (needs ELEVENLABS_API_KEY, reads .env)
```

Output: `demo/captures/draft-walkthrough/draft-walkthrough.mp4`
(31.0 s, 1280×720 H.264 + AAC). `demo/captures/` is git-ignored.

## Known gaps

- The 7-second pick clock makes a full real-time draft ~3 minutes, so the
  video fast-forwards with the app's **Complete draft** control after the
  first live auto-picks.
- The leaderboard shows projected mock ratings; real scoring depends on the
  admin confirming team finish orders (separate workflow).
- Draft state is in-memory per page load, so the walkthrough is a single
  continuous session rather than separate per-context segments.
