import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseToElement } from '../helpers/demoCursor';
import { showDemoCaption } from '../helpers/demoCaptions';

/**
 * Scorekeeping pipeline walkthrough: a scorekeeper enters hole scores, the
 * pipeline blocks approval until every card is complete, and the league admin
 * approves the round. Single continuous session — scorekeeper state persists
 * in localStorage, and the mock account switch is the app's real role flow.
 * See demo/pipeline-walkthroughs.md.
 */

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
// Playwright wipes its outputDir (demo/captures) at the start of every run, so
// only intermediates live there; the final deliverables go to demo/exports.
const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'scorekeeping-pipeline');
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'scorekeeping-pipeline');
const FINAL_MP4 = path.join(EXPORT_DIR, 'scorekeeping-pipeline.mp4');
const TARGET_MAX_SECONDS = 60;

const QUICK_MOVE = { durationMs: 450, steps: 18 };

const toMp4 = (webmPath: string): string | null => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.log('[scorekeeping-pipeline] FFmpeg not available; leaving the WebM recording in', CAPTURE_DIR);
    return null;
  }

  execFileSync('ffmpeg', [
    '-y', '-i', webmPath,
    '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    FINAL_MP4,
  ], { stdio: 'ignore' });

  const durationSeconds = Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL_MP4]).toString().trim(),
  );
  if (durationSeconds > TARGET_MAX_SECONDS) {
    const factor = durationSeconds / (TARGET_MAX_SECONDS - 2);
    const adjusted = `${FINAL_MP4}.adjusted.mp4`;
    execFileSync('ffmpeg', [
      '-y', '-i', FINAL_MP4,
      '-filter:v', `setpts=PTS/${factor.toFixed(3)}`,
      '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      adjusted,
    ], { stdio: 'ignore' });
    fs.renameSync(adjusted, FINAL_MP4);
    console.log(`[scorekeeping-pipeline] Ran ${durationSeconds.toFixed(1)}s; re-encoded at ${factor.toFixed(2)}x to fit the 60s window.`);
  }

  const finalDuration = Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL_MP4]).toString().trim(),
  );
  console.log(`[scorekeeping-pipeline] Final walkthrough: ${FINAL_MP4} (${finalDuration.toFixed(1)}s)`);
  return FINAL_MP4;
};

/** Sign in through the app's mock current-user switcher (the only auth the prototype has). */
const signInAs = async (page: import('@playwright/test').Page, userId: string, displayName: string): Promise<void> => {
  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, QUICK_MOVE);
  await accountSelect.selectOption(userId);
  await demoWait(250);
  await moveAndClick(page, page.getByRole('button', { name: 'Switch account' }), { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByText('Active account:')).toContainText(displayName);
  await demoWait(400);
};

test('Scorekeeping pipeline: scorekeeper scores, then the admin approves the round', async ({ browser }) => {
  test.setTimeout(240000);
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: CAPTURE_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // --- The scorekeeper scores the first hole. ---
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('league-demo-scorekeeper-state');
  });
  await page.reload();
  await showDemoCaption(page, 'Ava Park, the scorekeeper, scores her group hole by hole');
  await signInAs(page, 'ava-park', 'Ava Park');

  const scorecardLink = page.getByRole('link', { name: 'Scorekeeper scorecard' });
  await moveAndClick(page, scorecardLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: /Hole-by-hole scoring|Final hole/ })).toBeVisible();
  await demoWait(500);

  const incrementButtons = page.locator('button[data-action="increment-score"]');
  await moveAndClick(page, incrementButtons.first(), { ...QUICK_MOVE, pauseBeforeClickMs: 250 });
  await demoWait(250);
  await moveAndClick(page, incrementButtons.nth(1), { ...QUICK_MOVE, pauseBeforeClickMs: 250 });
  await demoWait(400);

  const submitButton = page.getByRole('button', { name: 'Submit Scores & Move to next hole' });
  await moveAndClick(page, submitButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByText(/Hole 2[/ ]of ?18/)).toBeVisible();
  await demoWait(800);

  // --- Fast-forward: every group's card is completed (development control). ---
  await showDemoCaption(page, 'Fast-forward — every group completes its card');
  await moveAndClick(page, page.locator('[data-dashboard-filter="Development"]'), { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  const seedScoresButton = page.getByRole('button', { name: 'Seed all group scores' });
  await moveAndClick(page, seedScoresButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await demoWait(900);

  // --- The admin reviews and approves. ---
  await showDemoCaption(page, 'The admin approves — blocked until every card is complete');
  await signInAs(page, 'league-admin', 'League Admin');
  await moveAndClick(page, page.locator('[data-dashboard-filter="Approve scores"]'), { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('button', { name: 'Approve all scores' })).toBeEnabled();

  const approveAllButton = page.getByRole('button', { name: 'Approve all scores' });
  await moveAndClick(page, approveAllButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByText('Team finish order')).toBeVisible();
  await demoWait(1000);

  // Closing beat: hold on the approved state so the video does not cut off.
  await showDemoCaption(page, 'Round approved — official scores feed standings and fantasy');
  await demoWait(3000);

  await context.close();
  const video = page.video();
  if (!video) {
    throw new Error('No video recorded for the scorekeeping walkthrough');
  }
  const segmentPath = path.join(CAPTURE_DIR, 'scorekeeping-pipeline.webm');
  fs.renameSync(await video.path(), segmentPath);

  const finalMp4 = toMp4(segmentPath);
  if (finalMp4) {
    console.log(`[scorekeeping-pipeline] MP4: ${finalMp4}`);
  }
});
