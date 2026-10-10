import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseToElement } from '../helpers/demoCursor';
import { showDemoCaption } from '../helpers/demoCaptions';

/**
 * Entity map highlight tour: sign in as Super Admin (the diagram is
 * siteAdmin-only), open the Pros view, and walk every entity on the canvas.
 * Hovering a node shows the app's own info tooltip with the entity summary —
 * the tour moves the demo cursor onto each node so the tooltip reads as the
 * highlight, and adds a temporary outline ring so the active node pops on
 * video. See demo/entity-map-tour.md.
 */

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
// Playwright wipes its outputDir (demo/captures) at the start of every run, so
// only intermediates live there; the final deliverables go to demo/exports.
const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'entity-map-tour');
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'entity-map-tour');
const FINAL_MP4 = path.join(EXPORT_DIR, 'entity-map-tour.mp4');
const TARGET_MAX_SECONDS = 60;

const QUICK_MOVE = { durationMs: 450, steps: 18 };

// The Pros view entities, in the order the page documents them. Tooltips show
// the shared entity summary (first definition across all diagram views).
const TOUR_STOPS: Array<{ name: string; summary: string }> = [
  { name: 'UserProfile', summary: 'The account behind a pro, admin, scorekeeper, or fan.' },
  { name: 'Player', summary: 'A pro on a team, with scorecards and an account.' },
  { name: 'Team', summary: 'A mixed pair of pros entered in the tournament.' },
  { name: 'Scorecard', summary: 'Hole-by-hole results for one pro in one round.' },
  { name: 'ContentSubmission', summary: 'A post with optional photo or video, plus its review status.' },
  { name: 'ContentPipeline', summary: 'Holds pro posts until a league or super admin approves them.' },
];

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

test('Entity map tour: highlight each entity on the Pros diagram view', async ({ browser }) => {
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

  await showDemoCaption(page, 'Super Admin opens the schema view — the Pros entity map');
  // The home page has no top nav; Super Admin reaches the schema view via the Diagram menu card.
  const diagramLink = page.locator('[data-dashboard-filter="Diagram"]');
  await moveAndClick(page, diagramLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: 'League table diagram' })).toBeVisible();

  const prosTab = page.locator('nav.diagram-tabs').getByRole('link', { name: 'Pros' });
  await moveAndClick(page, prosTab, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: 'Pro players and their content' })).toBeVisible();

  // Mermaid renders asynchronously.
  const canvas = page.locator('.diagram-canvas');
  await expect(canvas.locator('g.node').first()).toBeVisible({ timeout: 20000 });
  await demoWait(600);

  // Show the whole diagram at once before touring individual entities.
  await showDemoCaption(page, 'The Pros entity map at a glance — six entities and how they connect');
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

  for (const stop of TOUR_STOPS) {
    await showDemoCaption(page, `${stop.name} — ${stop.summary}`);
    const node = canvas.locator('g.node').filter({ hasText: stop.name }).first();
    await expect(node).toBeVisible();
    await moveMouseToElement(page, node, QUICK_MOVE);

    // The app's own tooltip is the highlight: hovering shows the entity summary.
    const tooltip = page.locator('#diagram-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(stop.name);
    await expect(tooltip).toContainText(stop.summary);

    await page.evaluate((activeName) => {
      document.querySelectorAll('.tour-highlight').forEach((entry) => entry.classList.remove('tour-highlight'));
      const target = [...document.querySelectorAll('.diagram-canvas g.node')].find(
        (entry) => entry.textContent?.trim() === activeName,
      );
      target?.classList.add('tour-highlight');
    }, stop.name);

    await demoWait(2100);
  }

  await showDemoCaption(page, 'That is the Pros map — six entities, one approval gate');
  await demoWait(1800);

  await context.close();
  const video = page.video();
  if (!video) {
    throw new Error('No video recorded for the entity map tour');
  }
  const recordedPath = await video.path();
  const segmentPath = path.join(CAPTURE_DIR, 'entity-map-tour.webm');
  fs.renameSync(recordedPath, segmentPath);

  const finalMp4 = toMp4(segmentPath);
  if (finalMp4) {
    console.log(`[entity-map-tour] MP4: ${finalMp4}`);
  }
});
