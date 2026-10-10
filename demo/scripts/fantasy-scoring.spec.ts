import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseToElement } from '../helpers/demoCursor';
import { showDemoCaption } from '../helpers/demoCaptions';

/**
 * Fantasy scoring walkthrough: the completed draft's leaderboard starts
 * projected, and flips to real totals once the admin confirms the event's
 * scores. Single continuous owner session. See demo/pipeline-walkthroughs.md.
 */

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
// Playwright wipes its outputDir (demo/captures) at the start of every run, so
// only intermediates live there; the final deliverables go to demo/exports.
const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'fantasy-scoring');
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'fantasy-scoring');
const FINAL_MP4 = path.join(EXPORT_DIR, 'fantasy-scoring.mp4');
const TARGET_MAX_SECONDS = 60;

const QUICK_MOVE = { durationMs: 450, steps: 18 };

const toMp4 = (webmPath: string): string | null => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.log('[fantasy-scoring] FFmpeg not available; leaving the WebM recording in', CAPTURE_DIR);
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
    console.log(`[fantasy-scoring] Ran ${durationSeconds.toFixed(1)}s; re-encoded at ${factor.toFixed(2)}x to fit the 60s window.`);
  }

  const finalDuration = Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL_MP4]).toString().trim(),
  );
  console.log(`[fantasy-scoring] Final walkthrough: ${FINAL_MP4} (${finalDuration.toFixed(1)}s)`);
  return FINAL_MP4;
};

test('Fantasy scoring: the leaderboard flips from projected to official once scores confirm', async ({ browser }) => {
  test.setTimeout(240000);
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: CAPTURE_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  await page.goto('/');
  await showDemoCaption(page, 'The owner completes the draft — the leaderboard is projected');
  await demoWait(500);

  const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
  await moveAndClick(page, fantasyLeagueLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();

  const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
  await moveAndClick(page, seedDraftButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();
  await demoWait(600);

  const completeDraftButton = page.getByRole('button', { name: 'Complete draft' });
  await moveAndClick(page, completeDraftButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByRole('heading', { name: 'Fantasy team leaderboard' })).toBeVisible();

  // Before scores: the leaderboard is explicitly projected.
  await expect(page.locator('.draft-leaderboard')).toBeVisible();
  await expect(page.locator('.tee-time-badge', { hasText: 'Projected' })).toBeVisible();
  await expect(page.getByText(/Not scored yet/)).toBeVisible();
  await moveMouseToElement(page, page.locator('.draft-leaderboard'), QUICK_MOVE);
  await demoWait(2400);

  // The admin confirms the event's scores (development fast-path does scoring
  // + approval + confirmation in one control).
  await showDemoCaption(page, 'Scores confirmed — projected becomes official');
  const seedScoredEventButton = page.getByRole('button', { name: 'Seed scored event + draft' });
  await moveAndClick(page, seedScoredEventButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });

  await expect(page.getByText(/Lowest four-player total wins/)).toBeVisible();
  await expect(page.locator('.tee-time-badge', { hasText: 'Projected' })).toHaveCount(0);
  await expect(page.locator('.draft-leaderboard-score').first()).toBeVisible();
  await moveMouseToElement(page, page.locator('.draft-leaderboard'), QUICK_MOVE);
  await demoWait(2200);

  // Closing beat: hold on the official leaderboard so the video does not cut off.
  await showDemoCaption(page, 'Official fantasy standings — lowest four-player total wins');
  await demoWait(3000);

  await context.close();
  const video = page.video();
  if (!video) {
    throw new Error('No video recorded for the fantasy scoring walkthrough');
  }
  const segmentPath = path.join(CAPTURE_DIR, 'fantasy-scoring.webm');
  fs.renameSync(await video.path(), segmentPath);

  const finalMp4 = toMp4(segmentPath);
  if (finalMp4) {
    console.log(`[fantasy-scoring] MP4: ${finalMp4}`);
  }
});
