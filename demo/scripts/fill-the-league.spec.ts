import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

/**
 * "Fill the league" walkthrough: the fantasy league starts with only its owner,
 * then five demo participants join one at a time, each from a separate
 * authenticated browser context (the app's mock current-user switcher is the
 * sign-in). Every join happens through the UI; only the owner-only starting
 * league is seeded (via the dev-server lobby reset). See demo/fill-the-league.md.
 *
 * Each context records its own segment so the video focuses on one page at a
 * time; the segments are stitched in join order into a single MP4 when FFmpeg
 * is available. The final segment also captures annotated PNG snapshots of the
 * 6-of-6 code trigger panel for the team (Playwright screenshots render whatever
 * the page renders, so arrows/highlights are real CSS over the live source).
 */

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'fill-the-league');
const FINAL_MP4 = path.join(CAPTURE_DIR, 'fill-the-league-walkthrough.mp4');
const TARGET_MAX_SECONDS = 60;

const OWNER = { id: 'fantasy-owner', name: 'Fantasy Owner' };
const PARTICIPANTS = [
  { id: 'owen-bell', name: 'Owen Bell' },
  { id: 'nina-alvarez', name: 'Nina Alvarez' },
  { id: 'harper-quinn', name: 'Harper Quinn' },
  { id: 'marcus-webb', name: 'Marcus Webb' },
  { id: 'taylor-reed', name: 'Taylor Reed' },
];

const QUICK_MOVE = { durationMs: 450, steps: 18 };

type LobbyState = { leagueId: string; ownerId: string; participantIds: string[] };

const newRecordedPage = async (browser: Browser): Promise<{ context: Awaited<ReturnType<Browser['newContext']>>; page: Page }> => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: CAPTURE_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  return { context, page };
};

/** Sign in through the app's mock current-user switcher (the only auth the prototype has). */
const signInAs = async (page: Page, userId: string, displayName: string): Promise<void> => {
  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, QUICK_MOVE);
  await accountSelect.selectOption(userId);
  await demoWait(250);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
  await expect(page.getByText('Active account:')).toContainText(displayName);
  await demoWait(400);
};

const saveSegment = async (page: Page, context: Awaited<ReturnType<Browser['newContext']>>, fileName: string): Promise<string> => {
  await context.close();
  const video = page.video();
  if (!video) {
    throw new Error(`No video recorded for segment ${fileName}`);
  }
  const recordedPath = await video.path();
  const targetPath = path.join(CAPTURE_DIR, fileName);
  fs.renameSync(recordedPath, targetPath);
  return targetPath;
};

const stitchSegments = (segments: string[]): string | null => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.log('[fill-the-league] FFmpeg not available; leaving per-segment WebM files in', CAPTURE_DIR);
    return null;
  }

  const inputs = segments.flatMap((segment) => ['-i', segment]);
  execFileSync('ffmpeg', [
    '-y',
    ...inputs,
    '-filter_complex',
    `concat=n=${segments.length}:v=1:a=0[out]`,
    '-map',
    '[out]',
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    FINAL_MP4,
  ], { stdio: 'ignore' });

  const durationOutput = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    FINAL_MP4,
  ]).toString().trim();
  const durationSeconds = Number.parseFloat(durationOutput);

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
    console.log(`[fill-the-league] Walkthrough ran ${durationSeconds.toFixed(1)}s; re-encoded at ${factor.toFixed(2)}x to fit the 60s window.`);
  }

  const finalDuration = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    FINAL_MP4,
  ]).toString().trim();
  console.log(`[fill-the-league] Final walkthrough: ${FINAL_MP4} (${Number.parseFloat(finalDuration).toFixed(1)}s)`);
  return FINAL_MP4;
};

test('Fill the league: owner plus five participants join through the UI', async ({ browser, request }) => {
  test.setTimeout(240000);
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  const segments: string[] = [];

  // --- Seeded setup (documented): reset the demo league so it starts with the owner only. ---
  const resetResponse = await request.post(`${BASE_URL}/api/demo/fantasy-league/reset`);
  expect(resetResponse.ok()).toBeTruthy();
  const seededLobby = (await resetResponse.json()) as LobbyState;
  expect(seededLobby.leagueId).toBe('league-demo');
  expect(seededLobby.ownerId).toBe(OWNER.id);
  expect(seededLobby.participantIds).toEqual([OWNER.id]);

  // --- Segment 1: owner opens the league, which contains only them. ---
  {
    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mock current user' })).toBeVisible();
    await moveMouseBelowElement(page, page.getByRole('heading', { name: 'Mock current user' }), 40, QUICK_MOVE);
    await demoWait(400);

    const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
    await moveAndClick(page, fantasyLeagueLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
    await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();

    const countBadge = page.locator('[data-lobby-count]');
    await expect(countBadge).toHaveText('1 of 6');
    await expect(page.locator('[data-lobby-member]')).toHaveCount(1);
    await expect(page.locator(`[data-lobby-member="${OWNER.id}"]`)).toContainText('Owner');
    // The owner is already a member, so no join action is offered (owner counted once).
    await expect(page.locator('[data-join-fantasy-league]')).toHaveCount(0);
    await moveMouseToElement(page, countBadge, QUICK_MOVE);
    await demoWait(1600);

    segments.push(await saveSegment(page, context, '01-owner-league-of-one.webm'));
  }

  // --- Segments 2-6: each participant joins from a separate authenticated context. ---
  for (const [index, participant] of PARTICIPANTS.entries()) {
    const expectedBefore = `${index + 1} of 6`;
    const expectedAfter = `${index + 2} of 6`;

    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');
    await signInAs(page, participant.id, participant.name);

    const countBadge = page.locator('[data-lobby-count]');
    await moveMouseToElement(page, countBadge, QUICK_MOVE);
    await expect(countBadge).toHaveText(expectedBefore);
    await demoWait(300);

    const joinButton = page.locator('[data-join-fantasy-league]');
    await expect(joinButton).toHaveText(`Join league as ${participant.name}`);
    await moveAndClick(page, joinButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });

    await expect(countBadge).toHaveText(expectedAfter);
    await expect(page.locator(`[data-lobby-member="${participant.id}"]`)).toContainText(participant.name);
    // The join action disappears once they are a member.
    await expect(page.locator('[data-join-fantasy-league]')).toHaveCount(0);
    await moveMouseToElement(page, countBadge, QUICK_MOVE);
    await demoWait(700);

    segments.push(await saveSegment(page, context, `0${index + 2}-join-${participant.id}.webm`));
  }

  // --- Segment 7: owner reloads, verifies the full league, and seeds the draft. ---
  {
    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');

    const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
    await moveAndClick(page, fantasyLeagueLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });

    const countBadge = page.locator('[data-lobby-count]');
    await expect(countBadge).toHaveText('6 of 6');
    await expect(page.locator('[data-lobby-member]')).toHaveCount(6);
    await expect(page.locator('[data-lobby-member]', { hasText: 'Owner' })).toHaveCount(1);
    await expect(page.locator('[data-lobby-ready]')).toContainText('League full — 6 of 6 participants.');
    await moveMouseToElement(page, countBadge, QUICK_MOVE);
    await demoWait(700);

    // Memberships must survive a reload (the mock user persists via localStorage).
    await page.reload();
    await expect(countBadge).toHaveText('6 of 6');
    await expect(page.locator('[data-lobby-member]')).toHaveCount(6);
    for (const member of [OWNER, ...PARTICIPANTS]) {
      await expect(page.locator(`[data-lobby-member="${member.id}"]`)).toContainText(member.name);
    }
    await demoWait(500);

    // Draft readiness as the app actually confirms it: seeding builds the draft lobby.
    // The reload landed back on the home dashboard, so reopen the Fantasy league view.
    await moveAndClick(page, fantasyLeagueLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });
    await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();
    const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
    await moveAndClick(page, seedDraftButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });
    await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();
    const startDraftButton = page.getByRole('button', { name: 'Start draft' });
    await expect(startDraftButton).toBeVisible();
    await moveMouseToElement(page, startDraftButton, QUICK_MOVE);
    await demoWait(1800);

    segments.push(await saveSegment(page, context, '07-owner-verifies-full-league.webm'));
  }

  // --- Segment 8: show the team the code trigger that fires at 6 of 6. ---
  {
    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');

    const triggerPanel = page.locator('[data-trigger-panel]');
    await expect(triggerPanel).toBeVisible();
    const triggerLines = page.locator('.code-line--trigger');
    await expect(triggerLines).toHaveCount(4);

    await moveMouseToElement(page, triggerPanel, QUICK_MOVE);
    await demoWait(1800);
    // Annotated code snapshot for the team: real source lines with arrow markers.
    await triggerPanel.screenshot({ path: path.join(CAPTURE_DIR, 'code-trigger-panel.png') });
    await moveMouseToElement(page, triggerLines.first(), QUICK_MOVE);
    await demoWait(1000);
    await page.locator('[data-fantasy-league-lobby]').screenshot({ path: path.join(CAPTURE_DIR, 'league-lobby-full.png') });
    await demoWait(800);

    segments.push(await saveSegment(page, context, '08-how-the-trigger-fires.webm'));
  }

  // --- Programmatic verification against the league record. ---
  const lobbyResponse = await request.get(`${BASE_URL}/api/demo/fantasy-league`);
  expect(lobbyResponse.ok()).toBeTruthy();
  const lobby = (await lobbyResponse.json()) as LobbyState;

  // All six memberships belong to the same league.
  expect(lobby.leagueId).toBe('league-demo');
  expect(lobby.participantIds).toHaveLength(6);
  expect(new Set(lobby.participantIds).size).toBe(6);
  // The owner is counted once and is first.
  expect(lobby.ownerId).toBe(OWNER.id);
  expect(lobby.participantIds[0]).toBe(OWNER.id);
  expect(lobby.participantIds.filter((id) => id === OWNER.id)).toHaveLength(1);
  // Exactly the owner plus the five demo participants.
  expect([...lobby.participantIds].sort()).toEqual([OWNER.id, ...PARTICIPANTS.map((p) => p.id)].sort());

  const finalMp4 = stitchSegments(segments);
  console.log(`[fill-the-league] Segments: ${segments.map((s) => path.basename(s)).join(', ')}`);
  if (finalMp4) {
    console.log(`[fill-the-league] MP4: ${finalMp4}`);
  }
});
