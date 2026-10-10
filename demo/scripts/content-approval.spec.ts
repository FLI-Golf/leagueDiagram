import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseToElement } from '../helpers/demoCursor';
import { showDemoCaption } from '../helpers/demoCaptions';

/**
 * Content approval walkthrough: a pro submits an update, it stays private
 * while pending, the league admin approves it, and it appears on the pro's
 * public profile. Single continuous session — the content pipeline persists
 * in localStorage, and the mock account switch is the app's real role flow.
 * See demo/pipeline-walkthroughs.md.
 */

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
// Playwright wipes its outputDir (demo/captures) at the start of every run, so
// only intermediates live there; the final deliverables go to demo/exports.
const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'content-approval');
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'content-approval');
const FINAL_MP4 = path.join(EXPORT_DIR, 'content-approval.mp4');
const TARGET_MAX_SECONDS = 60;

const QUICK_MOVE = { durationMs: 450, steps: 18 };
const POST_TEXT = 'Course is playing fast today — trusting the putter early.';
// Pro profile routes are positional (pro-1 = first team's first pro, Simon Lizotte).
const SIMON_PROFILE_ROUTE = '/pros/pro-1';

const toMp4 = (webmPath: string): string | null => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.log('[content-approval] FFmpeg not available; leaving the WebM recording in', CAPTURE_DIR);
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
    console.log(`[content-approval] Ran ${durationSeconds.toFixed(1)}s; re-encoded at ${factor.toFixed(2)}x to fit the 60s window.`);
  }

  const finalDuration = Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', FINAL_MP4]).toString().trim(),
  );
  console.log(`[content-approval] Final walkthrough: ${FINAL_MP4} (${finalDuration.toFixed(1)}s)`);
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

test('Content approval: a pro post goes from pending to published on the public profile', async ({ browser }) => {
  test.setTimeout(240000);
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: CAPTURE_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // --- The pro writes and submits an update. ---
  await page.goto('/');
  await showDemoCaption(page, 'Simon Lizotte, a pro, submits an update for review');
  await signInAs(page, 'simon-lizotte', 'Simon Lizotte');

  await expect(page.getByRole('heading', { name: 'Post content' })).toBeVisible();
  const contentInput = page.locator('form[data-action="post"] textarea[name="content"]');
  await moveMouseToElement(page, contentInput, QUICK_MOVE);
  await contentInput.fill(POST_TEXT);
  await demoWait(400);

  const submitButton = page.getByRole('button', { name: 'Submit for review' });
  await moveAndClick(page, submitButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByText('Sent to the league for review.')).toBeVisible();
  await expect(page.getByText('Pending league review').first()).toBeVisible();
  await demoWait(1000);

  // --- The league admin reviews and approves it. ---
  await showDemoCaption(page, 'The league admin reviews the pending post');
  await signInAs(page, 'league-admin', 'League Admin');
  await moveAndClick(page, page.locator('[data-dashboard-filter="Content review"]'), { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByRole('heading', { name: 'Approve pro content' })).toBeVisible();
  await expect(page.getByText(POST_TEXT)).toBeVisible();
  await demoWait(700);

  const approveButton = page.getByRole('button', { name: 'Approve & publish' });
  await moveAndClick(page, approveButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
  await expect(page.getByText(/Simon Lizotte — Published/)).toBeVisible();
  await demoWait(800);

  // --- The post is now public on the pro's profile. ---
  await showDemoCaption(page, "Approved — the update is live on Simon's public profile");
  await page.goto(SIMON_PROFILE_ROUTE);
  await expect(page.getByRole('heading', { name: 'Simon Lizotte' })).toBeVisible();
  await expect(page.getByText(POST_TEXT)).toBeVisible();
  const postItem = page.locator('.post-item').filter({ hasText: POST_TEXT });
  await moveMouseToElement(page, postItem, QUICK_MOVE);
  await demoWait(1600);

  // Closing beat: hold on the public post so the video does not cut off.
  await showDemoCaption(page, 'From pending to published — the content gate in action');
  await demoWait(3000);

  await context.close();
  const video = page.video();
  if (!video) {
    throw new Error('No video recorded for the content approval walkthrough');
  }
  const segmentPath = path.join(CAPTURE_DIR, 'content-approval.webm');
  fs.renameSync(await video.path(), segmentPath);

  const finalMp4 = toMp4(segmentPath);
  if (finalMp4) {
    console.log(`[content-approval] MP4: ${finalMp4}`);
  }
});
