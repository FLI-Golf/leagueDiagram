import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseTo, moveMouseToElement } from '../helpers/demoCursor';
import { showDemoCaption } from '../helpers/demoCaptions';

/**
 * Entity map highlight tour. Sign in as Super Admin (the diagram is
 * siteAdmin-only), open a diagram view, show the whole map at a glance, then
 * walk every entity on the canvas. Hovering a node shows the app's own info
 * tooltip with the entity summary — the tour moves the demo cursor onto each
 * node so the tooltip reads as the highlight, and adds a temporary outline
 * ring so the active node pops on video. See demo/entity-map-tour.md.
 *
 * Select the view with DIAGRAM_VIEW (default 'pros'):
 *   DIAGRAM_VIEW=league npx playwright test entity-map-tour
 */

type TourStop = { name: string; summary: string };

type DiagramTour = {
  /** DIAGRAM_VIEWS slug and tab label in the app. */
  slug: string;
  tabLabel: string;
  /** The view's rendered page heading. */
  title: string;
  /** One-line overview caption. */
  overviewCaption: string;
  stops: TourStop[];
};

// Tooltips show the shared entity summary (first definition across all
// diagram views), so these summaries match what the hover tooltip renders.
const DIAGRAM_TOURS: Record<string, DiagramTour> = {
  pros: {
    slug: 'pros',
    tabLabel: 'Pros',
    title: 'Pro players and their content',
    overviewCaption: 'The Pros entity map at a glance — six entities and how they connect',
    stops: [
      { name: 'UserProfile', summary: 'The account behind a pro, admin, scorekeeper, or fan.' },
      { name: 'Player', summary: 'A pro on a team, with scorecards and an account.' },
      { name: 'Team', summary: 'A mixed pair of pros entered in the tournament.' },
      { name: 'Scorecard', summary: 'Hole-by-hole results for one pro in one round.' },
      { name: 'ContentSubmission', summary: 'A post with optional photo or video, plus its review status.' },
      { name: 'ContentPipeline', summary: 'Holds pro posts until a league or super admin approves them.' },
    ],
  },
  league: {
    slug: 'league',
    tabLabel: 'League',
    title: 'League, season, and schedule',
    overviewCaption: 'The League entity map at a glance — memberships, season, schedule, standings',
    stops: [
      { name: 'UserLeague', summary: 'The league membership that owns invites, participants, and draft orders.' },
      { name: 'Season', summary: 'The parent record: purse, league reference, schedule, and sponsorship program.' },
      { name: 'SponsorshipProgram', summary: 'Season sponsorships, starting with the single title sponsor.' },
      { name: 'Sponsorship', summary: 'One agreement: sponsor, tier, scope, amount, and status.' },
      { name: 'SeasonBootstrapResult', summary: 'The assembled season seed handed to the app.' },
      { name: 'EventSchedule', summary: 'Calendarized tournaments across a season.' },
      { name: 'TournamentResult', summary: 'One tournament: the course it is played on, the teams entered, and the ranked scorecards.' },
      { name: 'LeagueTable', summary: 'Cumulative standings rolled up from every approved event.' },
    ],
  },
  fantasy: {
    slug: 'fantasy',
    tabLabel: 'Fantasy',
    title: 'Fantasy leagues and drafts',
    overviewCaption: 'The Fantasy entity map at a glance — leagues, rosters, scoring, and the draft',
    stops: [
      { name: 'FantasyLeague', summary: 'The fantasy competition that owns teams and the draft.' },
      { name: 'FantasyTeam', summary: 'A fantasy manager and the pros they drafted.' },
      { name: 'FantasyRoster', summary: 'The drafted set of fantasy players.' },
      { name: 'FantasyPlayer', summary: 'A league pro wrapped with fantasy scoring.' },
      { name: 'FantasyScoring', summary: 'Derives fantasy standings from approved event scores.' },
      { name: 'TournamentResult', summary: 'One tournament: the course it is played on, the teams entered, and the ranked scorecards.' },
      { name: 'FantasyDraft', summary: 'Draft rounds, picks, and the resulting rosters.' },
      { name: 'DraftRoom', summary: 'Live draft state with pick timers and auto picks.' },
    ],
  },
  course: {
    slug: 'course',
    tabLabel: 'Course',
    title: 'Courses, holes, and sponsors',
    overviewCaption: 'The Course entity map at a glance — layouts, holes, and sponsors',
    stops: [
      { name: 'Course', summary: 'The layout a tournament is played on.' },
      { name: 'Hole', summary: 'Distance, basket placement, and sponsor branding for one hole.' },
      { name: 'Sponsor', summary: 'Branding attached to a hole or the league.' },
    ],
  },
  sponsorship: {
    slug: 'sponsorship',
    tabLabel: 'Sponsorship',
    title: 'Who is paying for what',
    overviewCaption: 'The Sponsorship entity map at a glance — who is paying for what',
    stops: [
      { name: 'SponsorshipProgram', summary: 'Season sponsorships, starting with the single title sponsor.' },
      { name: 'Sponsorship', summary: 'One agreement: sponsor, tier, scope, amount, and status.' },
      { name: 'Sponsor', summary: 'Branding attached to a hole or the league.' },
      { name: 'Season', summary: 'The parent record: purse, league reference, schedule, and sponsorship program.' },
      { name: 'Course', summary: 'The layout a tournament is played on.' },
      { name: 'Hole', summary: 'Distance, basket placement, and sponsor branding for one hole.' },
      { name: 'Player', summary: 'A pro on a team, with scorecards and an account.' },
      { name: 'Team', summary: 'A mixed pair of pros entered in the tournament.' },
    ],
  },
  pipelines: {
    slug: 'pipelines',
    tabLabel: 'Pipelines',
    title: 'Approval pipelines',
    overviewCaption: 'The Pipelines entity map at a glance — nothing becomes official without review',
    stops: [
      { name: 'ScorekeeperPipeline', summary: 'Collects hole scores per group and blocks approval until the card is complete.' },
      { name: 'TournamentResult', summary: 'One tournament: the course it is played on, the teams entered, and the ranked scorecards.' },
      { name: 'FantasyScoring', summary: 'Derives fantasy standings from approved event scores.' },
      { name: 'Group', summary: 'The paired teams a scorekeeper is assigned to.' },
      { name: 'ScoreEntry', summary: 'One team score on one hole.' },
      { name: 'ContentPipeline', summary: 'Holds pro posts until a league or super admin approves them.' },
      { name: 'ContentSubmission', summary: 'A post with optional photo or video, plus its review status.' },
    ],
  },
};

const VIEW_KEY = process.env.DIAGRAM_VIEW ?? 'pros';
const TOUR = DIAGRAM_TOURS[VIEW_KEY];
if (!TOUR) {
  throw new Error(`Unknown DIAGRAM_VIEW "${VIEW_KEY}". Known views: ${Object.keys(DIAGRAM_TOURS).join(', ')}`);
}

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
// Playwright wipes its outputDir (demo/captures) at the start of every run, so
// only intermediates live there; the final deliverables go to demo/exports.
const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', `entity-map-tour-${VIEW_KEY}`);
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'entity-map-tour');
const FINAL_MP4 = path.join(EXPORT_DIR, `entity-map-tour-${VIEW_KEY}.mp4`);
const TARGET_MAX_SECONDS = 60;

const QUICK_MOVE = { durationMs: 450, steps: 18 };

const toMp4 = (webmPath: string): string | null => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.log('[entity-map-tour] FFmpeg not available; leaving the WebM recording in', CAPTURE_DIR);
    return null;
  }

  execFileSync('ffmpeg', [
    '-y',
    '-i', webmPath,
    '-c:v', 'libx264',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    FINAL_MP4,
  ], { stdio: 'ignore' });

  const durationSeconds = Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL_MP4]).toString().trim(),
  );

  if (durationSeconds > TARGET_MAX_SECONDS) {
    const factor = durationSeconds / (TARGET_MAX_SECONDS - 2);
    const adjusted = `${FINAL_MP4}.adjusted.mp4`;
    execFileSync('ffmpeg', [
      '-y',
      '-i', FINAL_MP4,
      '-filter:v', `setpts=PTS/${factor.toFixed(3)}`,
      '-c:v', 'libx264',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      adjusted,
    ], { stdio: 'ignore' });
    fs.renameSync(adjusted, FINAL_MP4);
    console.log(`[entity-map-tour] Ran ${durationSeconds.toFixed(1)}s; re-encoded at ${factor.toFixed(2)}x to fit the 60s window.`);
  }

  const finalDuration = Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL_MP4]).toString().trim(),
  );
  console.log(`[entity-map-tour] Final walkthrough: ${FINAL_MP4} (${finalDuration.toFixed(1)}s)`);
  return FINAL_MP4;
};

test(`Entity map tour: highlight each entity on the ${TOUR.tabLabel} diagram view`, async ({ browser }) => {
  test.setTimeout(240000);
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: CAPTURE_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // The diagram is super-admin only, so sign in through the mock switcher first.
  await page.goto('/');
  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, QUICK_MOVE);
  await accountSelect.selectOption('super-admin');
  await demoWait(250);
  await moveAndClick(page, page.getByRole('button', { name: 'Switch account' }), { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByText('Active account:')).toContainText('Super Admin');

  await showDemoCaption(page, `Super Admin opens the schema view — the ${TOUR.tabLabel} entity map`);
  // The home page has no top nav; Super Admin reaches the schema view via the Diagram menu card.
  const diagramLink = page.locator('[data-dashboard-filter="Diagram"]');
  await moveAndClick(page, diagramLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: 'League table diagram' })).toBeVisible();

  const viewTab = page.locator('nav.diagram-tabs').getByRole('link', { name: TOUR.tabLabel });
  await moveAndClick(page, viewTab, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: TOUR.title })).toBeVisible();

  // Mermaid renders asynchronously.
  const canvas = page.locator('.diagram-canvas');
  await expect(canvas.locator('g.node').first()).toBeVisible({ timeout: 20000 });
  await demoWait(600);

  // Show the whole diagram at once before touring individual entities.
  await showDemoCaption(page, TOUR.overviewCaption);
  await page.evaluate(() => {
    const canvasEl = document.querySelector('.diagram-canvas');
    const svg = canvasEl?.querySelector('svg');
    if (!(canvasEl instanceof HTMLElement) || !svg) {
      return;
    }
    const bounds = svg.getBoundingClientRect();
    const scale = Math.min(1, 1120 / bounds.width, 500 / bounds.height);
    canvasEl.style.transform = `scale(${scale})`;
    canvasEl.style.transformOrigin = 'top center';
    canvasEl.style.height = `${bounds.height * scale + 24}px`;
  });
  const canvasPanel = page.locator('.diagram-canvas-panel');
  await canvasPanel.scrollIntoViewIfNeeded();
  await demoWait(2800);
  await page.evaluate(() => {
    const canvasEl = document.querySelector('.diagram-canvas');
    if (!(canvasEl instanceof HTMLElement)) {
      return;
    }
    canvasEl.style.transform = '';
    canvasEl.style.height = '';
  });

  // Pause on the legend so viewers can read the edge conventions.
  await showDemoCaption(page, 'Green edges: has many · blue edges: has one');
  const legend = page.locator('.diagram-legend');
  await moveMouseToElement(page, legend, QUICK_MOVE);
  await demoWait(2200);

  // Inject a tour-only highlight ring (like the cursor overlay — not an app change).
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.tour-highlight rect, .tour-highlight .basic.label-container { stroke: #f97316 !important; stroke-width: 3px !important; }';
    document.head.appendChild(style);
  });

  for (const stop of TOUR.stops) {
    await showDemoCaption(page, `${stop.name} — ${stop.summary}`);

    // Match the node by its exact label (badge nodes read e.g. "Seasoni", and
    // plain substring filters would confuse Season with SeasonBootstrapResult).
    const box = await page.evaluate((activeName) => {
      const target = [...document.querySelectorAll('.diagram-canvas g.node')].find((entry) => {
        const label = entry.textContent?.trim() ?? '';
        return label === activeName || label === `${activeName}i`;
      });
      if (!target) {
        return null;
      }
      target.scrollIntoView({ block: 'center' });
      const rect = target.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, stop.name);
    expect(box, `node ${stop.name} should exist on the canvas`).not.toBeNull();
    if (!box) {
      continue;
    }
    // Leaving a node can fire pointerout (hiding the tooltip) after the new
    // pointerover, so re-approach from a neutral point: the last event is then
    // always the pointerover that shows this node's tooltip.
    await page.mouse.move(8, 8, { steps: 6 });
    await moveMouseTo(page, box.x, box.y, QUICK_MOVE);

    // The app's own tooltip is the highlight: hovering shows the entity summary.
    const tooltip = page.locator('#diagram-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(stop.name);
    await expect(tooltip).toContainText(stop.summary);

    await page.evaluate((activeName) => {
      document.querySelectorAll('.tour-highlight').forEach((entry) => entry.classList.remove('tour-highlight'));
      const target = [...document.querySelectorAll('.diagram-canvas g.node')].find((entry) => {
        const label = entry.textContent?.trim() ?? '';
        return label === activeName || label === `${activeName}i`;
      });
      target?.classList.add('tour-highlight');
    }, stop.name);

    await demoWait(2100);
  }

  await showDemoCaption(page, `That is the ${TOUR.tabLabel} map — every entity and connection covered`);
  // Closing beat: hold on the full canvas so the video does not cut off.
  await demoWait(3200);

  await context.close();
  const video = page.video();
  if (!video) {
    throw new Error('No video recorded for the entity map tour');
  }
  const recordedPath = await video.path();
  const segmentPath = path.join(CAPTURE_DIR, `entity-map-tour-${VIEW_KEY}.webm`);
  fs.renameSync(recordedPath, segmentPath);

  const finalMp4 = toMp4(segmentPath);
  if (finalMp4) {
    console.log(`[entity-map-tour] MP4: ${finalMp4}`);
  }
});
