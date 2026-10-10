# Entity map tour — Pros view highlight walkthrough

Narrated highlight tour of the entity map's **Pros** view (`/diagram/pros`),
recorded with the same conventions as [fill-the-league.md](fill-the-league.md)
and [draft-walkthrough.md](draft-walkthrough.md) (caption overlays, ElevenLabs
narration, git-ignored captures, finals in `demo/exports/`).

## What the video shows (application UI only, ~32 s)

1. Sign in as **Super Admin** through the mock current-user switcher (the
   diagram is siteAdmin-only) and open the schema view via the **Diagram**
   menu card, then the **Pros** tab.
2. Pause on the legend: green edges mean *has many*, blue edges mean *has one*.
3. Highlight each entity in turn — the cursor moves onto the mermaid node, the
   app's own info tooltip shows the entity summary, and a tour-only orange
   ring (injected overlay, not an app change) marks the active node:

   UserProfile → Player → Team → Scorecard → ContentSubmission → ContentPipeline.

## Verification (asserted in the spec)

- The diagram canvas renders (`g.node` elements present after mermaid loads).
- For each of the six entities: the node is visible, the hover tooltip appears
  with that entity's name and its summary text.

## Repeatable recording command

```bash
npm install && npx playwright install chromium --with-deps
npx playwright test entity-map-tour                 # or: npm run demo:entity-map
node scripts/generate-entity-map-tour-narration.js  # narration (needs ELEVENLABS_API_KEY, reads .env)
```

Output: `demo/exports/entity-map-tour/entity-map-tour.mp4` (plus a narrated
`.webm`). Both `demo/captures/` (intermediates) and `demo/exports/` (finals)
are git-ignored.

## Notes

- Tooltips display the shared entity summary (the first definition across all
  diagram views), which can differ slightly from the per-view card text — the
  tour's captions and assertions use the shared summaries so they match what
  is on screen.
- The other diagram views (Overview, League, Fantasy, Course, Sponsorship,
  Pipelines) follow the same structure; the tour covers the Pros view.
