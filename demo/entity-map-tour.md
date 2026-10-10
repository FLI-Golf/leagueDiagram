# Entity map tours — diagram view highlight walkthroughs

Narrated highlight tours of the entity map diagram views — all seven:
`/diagram` (overview), `/diagram/pros`, `/diagram/league`, `/diagram/fantasy`,
`/diagram/course`, `/diagram/sponsorship`, `/diagram/pipelines`. Recorded with
the same conventions as [fill-the-league.md](fill-the-league.md) and
[draft-walkthrough.md](draft-walkthrough.md) (caption overlays, ElevenLabs
narration, git-ignored captures, finals in `demo/exports/`).

## What each video shows (application UI only, ~28–55 s)

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

- **Overview** (`entity-map-tour-overview.mp4`, ~55 s): the full 18-entity map
  at a glance, then the 12 key points — Season → UserLeague → EventSchedule →
  TournamentResult → ScorekeeperPipeline → LeagueTable → Course → Team →
  Player → ContentPipeline → FantasyLeague → FantasyScoring. (The remaining
  entities are covered by the per-view tours below.)
- **Pros** (`entity-map-tour-pros.mp4`): UserProfile → Player → Team →
  Scorecard → ContentSubmission → ContentPipeline.
- **League** (`entity-map-tour-league.mp4`): UserLeague → Season →
  SponsorshipProgram → Sponsorship → SeasonBootstrapResult → EventSchedule →
  TournamentResult → LeagueTable.
- **Fantasy** (`entity-map-tour-fantasy.mp4`): FantasyLeague → FantasyTeam →
  FantasyRoster → FantasyPlayer → FantasyScoring → TournamentResult →
  FantasyDraft → DraftRoom.
- **Course** (`entity-map-tour-course.mp4`): Course → Hole → Sponsor.
- **Sponsorship** (`entity-map-tour-sponsorship.mp4`): SponsorshipProgram →
  Sponsorship → Sponsor → Season → Course → Hole → Player → Team.
- **Pipelines** (`entity-map-tour-pipelines.mp4`): ScorekeeperPipeline →
  TournamentResult → FantasyScoring → Group → ScoreEntry → ContentPipeline →
  ContentSubmission.

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
DIAGRAM_VIEW=course npx playwright test entity-map-tour          # Course view (or: npm run demo:entity-map:course)
DIAGRAM_VIEW=sponsorship npx playwright test entity-map-tour     # Sponsorship view (or: npm run demo:entity-map:sponsorship)
DIAGRAM_VIEW=pipelines npx playwright test entity-map-tour       # Pipelines view (or: npm run demo:entity-map:pipelines)
DIAGRAM_VIEW=overview npx playwright test entity-map-tour        # Full map (or: npm run demo:entity-map:overview)
node scripts/generate-entity-map-tour-narration.js               # narration, Pros (default)
node scripts/generate-entity-map-tour-narration.js --view=league # narration, League
node scripts/generate-entity-map-tour-narration.js --view=fantasy # narration, Fantasy
node scripts/generate-entity-map-tour-narration.js --view=course # narration, Course
node scripts/generate-entity-map-tour-narration.js --view=sponsorship # narration, Sponsorship
node scripts/generate-entity-map-tour-narration.js --view=pipelines # narration, Pipelines
node scripts/generate-entity-map-tour-narration.js --view=overview # narration, Overview
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
- Every tour holds a closing beat, and the narration mux freezes the final
  frame to fit the audio, so videos never cut off mid-line.
- All seven diagram views are covered; new entities only need their
  `DIAGRAM_TOURS` stop list updated.
