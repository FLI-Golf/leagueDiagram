import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test, type Browser } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseToElement } from '../helpers/demoCursor';
import { showDemoCaption } from '../helpers/demoCaptions';

/**
 * "Draft" walkthrough: with the league full, the owner seeds the draft, starts
 * the clock, watches the first auto-picks land, then fast-forwards to the
 * completed draft and the final-rosters leaderboard. See demo/fill-the-league.md
 * for the league-fill walkthrough and the dev-server lobby stand-in.
 *
 * The draft series lives in page memory, so this is one continuous owner
 * session recorded as a single segment — the whole story happens on the
 * owner's Fantasy league page. The league lobby is refilled beforehand through
 * the same join UI (off-camera) so the video shows a full 6-of-6 league.
 */

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
// Playwright wipes its outputDir (demo/captures) at the start of every run, so
// only intermediates live there; the final deliverables go to demo/exports.
const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'draft-walkthrough');
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'draft-walkthrough');
const FINAL_MP4 = path.join(EXPORT_DIR, 'draft-walkthrough.mp4');
const TARGET_MAX_SECONDS = 60;

const PARTICIPANTS = [
  { id: 'owen-bell', name: 'Owen Bell' },
  { id: 'nina-alvarez', name: 'Nina Alvarez' },
  { id: 'harper-quinn', name: 'Harper Quinn' },
  { id: 'marcus-webb', name: 'Marcus Webb' },
  { id: 'taylor-reed', name: 'Taylor Reed' },
];

const QUICK_MOVE = { durationMs: 450, steps: 18 };

/** A join through the join UI, in its own authenticated context, not recorded. */
const joinOffCamera = async (browser: Browser, participant: { id: string; name: string }, expectedCount: string): Promise<void> => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Signed in as').selectOption(participant.id);
  await page.getByRole('button', { name: 'Switch account' }).click();
  await expect(page.getByText('Active account:')).toContainText(participant.name);
  await page.locator('[data-join-fantasy-league]').click();
  await expect(page.locator('[data-lobby-count]')).toHaveText(expectedCount);
  await context.close();
};

const toMp4 = (webmPath: string): string | null => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.log('[draft-walkthrough] FFmpeg not available; leaving the WebM recording in', CAPTURE_DIR);
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

  // Keep the walkthrough inside the agreed 30-60 second window if pacing drifted long.
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
    console.log(`[draft-walkthrough] Ran ${durationSeconds.toFixed(1)}s; re-encoded at ${factor.toFixed(2)}x to fit the 60s window.`);
  }

  const finalDuration = Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL_MP4]).toString().trim(),
  );
  console.log(`[draft-walkthrough] Final walkthrough: ${FINAL_MP4} (${finalDuration.toFixed(1)}s)`);
  return FINAL_MP4;
};

test('Draft walkthrough: owner seeds, starts, and completes the Sunset Open draft', async ({ browser }) => {
  test.setTimeout(240000);
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  // --- Seeded background (documented): refill the league lobby through the join
  // UI, off-camera, so the owner's Fantasy league view shows the full 6 of 6. ---
  for (const [index, participant] of PARTICIPANTS.entries()) {
    await joinOffCamera(browser, participant, `${index + 2} of 6`);
  }

  // --- Single recorded session: the owner runs the whole draft. ---
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: CAPTURE_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mock current user' })).toBeVisible();
  await showDemoCaption(page, 'League full at 6 of 6 — the owner seeds the draft');
  await demoWait(600);

  const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
  await moveAndClick(page, fantasyLeagueLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();
  await expect(page.locator('[data-lobby-count]')).toHaveText('6 of 6');
  await demoWait(800);

  const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
  await moveAndClick(page, seedDraftButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();
  const startDraftButton = page.getByRole('button', { name: 'Start draft' });
  await expect(startDraftButton).toBeVisible();
  await moveMouseToElement(page, startDraftButton, QUICK_MOVE);
  await demoWait(1200);

  await showDemoCaption(page, 'The draft begins — a 7-second clock, top pro auto-picked at zero');
  await moveAndClick(page, startDraftButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByText(/Round 1 · Pick 1/)).toBeVisible();

  const draftClock = page.locator('.draft-clock-value').first();
  await moveMouseToElement(page, draftClock, QUICK_MOVE);

  // Let the 7-second clock run through the first auto-pick so the draft unfolds naturally.
  await demoWait(8000);
  await expect(page.getByText('Picks so far')).toBeVisible();
  await expect(page.locator('.draft-pick-log li').first()).toBeVisible();

  const recommendedPro = page.getByText('Recommended pro');
  await moveMouseToElement(page, recommendedPro, QUICK_MOVE);
  await demoWait(800);

  // Pause the live clock so the round-3 board stays put for the showcase.
  const autoPickToggle = page.getByRole('button', { name: /Auto-pick on expiry/ });
  await moveAndClick(page, autoPickToggle, { ...QUICK_MOVE, pauseBeforeClickMs: 250 });

  // Fast-forward through rounds 1-2 with the app's development control.
  await showDemoCaption(page, 'Fast-forward to round 3');
  const seedRoundsButton = page.getByRole('button', { name: 'Seed rounds 1 & 2' });
  await moveAndClick(page, seedRoundsButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByText(/Round 3 · Pick/)).toBeVisible();
  await demoWait(500);

  // Gender filtering in rounds 3-4: a roster already holding two MPO or two FPO
  // players has that gender blocked on the board, so every roster finishes 2+2.
  await showDemoCaption(page, 'Rounds 3–4 — rosters full at MPO or FPO have that gender blocked');
  let blockedPlayers = page.locator('.draft-player--blocked');
  for (let attempt = 0; attempt < 6 && (await blockedPlayers.count()) === 0; attempt += 1) {
    await moveAndClick(page, page.getByRole('button', { name: 'Draft next pick' }), { ...QUICK_MOVE, pauseBeforeClickMs: 200 });
    await demoWait(400);
    blockedPlayers = page.locator('.draft-player--blocked');
  }
  await expect(blockedPlayers.first()).toBeVisible();
  await expect(blockedPlayers.first()).toHaveAttribute('title', /Roster already full at/);
  console.log(`[draft-walkthrough] Gender filtering: "${await blockedPlayers.first().getAttribute('title')}" (${await blockedPlayers.count()} blocked on this board)`);
  try {
    await moveMouseToElement(page, blockedPlayers.first(), QUICK_MOVE);
  } catch {
    // The live board can re-render mid-showcase; the assertions above already proved the filtering.
  }
  await demoWait(2600);

  await showDemoCaption(page, 'Fast-forward — every remaining pick completes the draft');
  const completeDraftButton = page.getByRole('button', { name: 'Complete draft' });
  await moveAndClick(page, completeDraftButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });

  await expect(page.getByRole('heading', { name: 'Fantasy team leaderboard' })).toBeVisible();
  const leaderboardRows = page.locator('.draft-leaderboard tbody tr');
  await expect(leaderboardRows).toHaveCount(6);

  await showDemoCaption(page, 'Draft complete — all six rosters set, projected until scores confirm');
  const leaderboard = page.locator('.draft-leaderboard');
  await moveMouseToElement(page, leaderboard, QUICK_MOVE);
  await demoWait(2500);

  await context.close();
  const video = page.video();
  if (!video) {
    throw new Error('No video recorded for the draft walkthrough');
  }
  const recordedPath = await video.path();
  const segmentPath = path.join(CAPTURE_DIR, 'draft-walkthrough.webm');
  fs.renameSync(recordedPath, segmentPath);

  const finalMp4 = toMp4(segmentPath);
  if (finalMp4) {
    console.log(`[draft-walkthrough] MP4: ${finalMp4}`);
  }
});
