# Entity map tours — diagram view highlight walkthroughs

Narrated highlight tours of the entity map diagram views
(`/diagram/pros`, `/diagram/league`, `/diagram/fantasy`), recorded with the
same conventions as [fill-the-league.md](fill-the-league.md) and
[draft-walkthrough.md](draft-walkthrough.md) (caption overlays, ElevenLabs
narration, git-ignored captures, finals in `demo/exports/`).

## What each video shows (application UI only, ~35–41 s)

1. Sign in as **Super Admin** through the mock current-user switcher (the
   diagram is siteAdmin-only) and open the schema view via the **Diagram**
   menu card, then the view's tab.
2. **Overview at a glance** — the whole entity map is scaled to fit the
   viewport so every entity and connection is visible in one frame.
3. Pause on the legend: green edges mean *has many*, blue edges mean *has one*.
4. Highlight each entity in turn — the cursor moves onto the mermaid node, the
   app's own info tooltip shows the entity summary, and a tour-only orange
   ring (injected overlay, not an app change) marks the active node.

### Views covered

- **Pros** (`entity-map-tour-pros.mp4`): UserProfile → Player → Team →
  Scorecard → ContentSubmission → ContentPipeline.
- **League** (`entity-map-tour-league.mp4`): UserLeague → Season →
  SponsorshipProgram → Sponsorship → SeasonBootstrapResult → EventSchedule →
  TournamentResult → LeagueTable.
- **Fantasy** (`entity-map-tour-fantasy.mp4`): FantasyLeague → FantasyTeam →
  FantasyRoster → FantasyPlayer → FantasyScoring → TournamentResult →
  FantasyDraft → DraftRoom.

## Verification (asserted in the spec)

- The diagram canvas renders (`g.node` elements present after mermaid loads).
- For each entity in the view: the node exists by its exact label, and the
  hover tooltip appears with that entity's name and its summary text.

## Repeatable recording command

```bash
npm install && npx playwright install chromium --with-deps
npx playwright test entity-map-tour                              # Pros view (or: npm run demo:entity-map)
DIAGRAM_VIEW=league npx playwright test entity-map-tour          # League view (or: npm run demo:entity-map:league)
DIAGRAM_VIEW=fantasy npx playwright test entity-map-tour         # Fantasy view (or: npm run demo:entity-map:fantasy)
node scripts/generate-entity-map-tour-narration.js               # narration, Pros (default)
node scripts/generate-entity-map-tour-narration.js --view=league # narration, League
node scripts/generate-entity-map-tour-narration.js --view=fantasy # narration, Fantasy
```

Output: `demo/exports/entity-map-tour/entity-map-tour-<view>.mp4` (plus a
narrated `.webm`). Both `demo/captures/` (intermediates) and `demo/exports/`
(finals) are git-ignored.

## Notes

- Tooltips display the shared entity summary (the first definition across all
  diagram views), which can differ slightly from the per-view card text — the
  tour's captions and assertions use the shared summaries so they match what
  is on screen.
- Nodes are matched by exact label (badge nodes read e.g. "Seasoni"), which
  avoids confusing `Season` with `SeasonBootstrapResult`.
- Each hover re-approaches the node from a neutral point: leaving a node can
  fire `pointerout` after the new `pointerover`, which would otherwise hide
  the tooltip right as it appears.
- The other diagram views (Overview, Fantasy, Course, Sponsorship, Pipelines)
  can be added by extending `DIAGRAM_TOURS` in the spec.
