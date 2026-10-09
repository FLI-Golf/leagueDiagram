import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';
import { showDemoCaption } from '../helpers/demoCaptions';

/**
 * "Fill the league" walkthrough: the fantasy league starts with only its owner,
 * then five demo participants join one at a time, each from a separate
 * authenticated browser context (the app's mock current-user switcher is the
 * sign-in). Every join happens through the UI; only the owner-only starting
 * league is seeded (via the dev-server lobby reset). See demo/fill-the-league.md.
 *
 * The video shows only the application UI: the owner, the first two joins, the
 * final join that fills the league, and the full six-member list. The middle
 * joins (participants three and four) still happen through the UI in their own
 * contexts, just off-camera, to keep the video short. Each recorded context
 * captures its own segment; segments are stitched in order into one MP4 when
 * FFmpeg is available.
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
// Recorded on camera: the first two joins and the last one. The rest join
// through the same UI off-camera so the video stays short.
const RECORDED_JOINS = [PARTICIPANTS[0], PARTICIPANTS[1], PARTICIPANTS[4]];
const OFF_CAMERA_JOINS = [PARTICIPANTS[2], PARTICIPANTS[3]];

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

/** A join through the same UI, in its own authenticated context, just not recorded. */
const joinOffCamera = async (browser: Browser, participant: { id: string; name: string }, expectedCount: string): Promise<void> => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Signed in as').selectOption(participant.id);
  await page.getByRole('button', { name: 'Switch account' }).click();
  await expect(page.getByText('Active account:')).toContainText(participant.name);
  await page.locator('[data-join-fantasy-league]').click();
  await expect(page.locator('[data-lobby-count]')).toHaveText(expectedCount);
  await expect(page.locator(`[data-lobby-member="${participant.id}"]`)).toContainText(participant.name);
  await context.close();
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

  // --- Segment 1: the owner opens a league that contains only them. ---
  {
    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mock current user' })).toBeVisible();
    await showDemoCaption(page, 'Fantasy Owner opens the league — only the owner so far (1 of 6)');
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
    await demoWait(1500);

    segments.push(await saveSegment(page, context, '01-owner-league-of-one.webm'));
  }

  // --- Segments 2-3: the first two participants join on camera. ---
  for (const [index, participant] of [PARTICIPANTS[0], PARTICIPANTS[1]].entries()) {
    const expectedBefore = `${index + 1} of 6`;
    const expectedAfter = `${index + 2} of 6`;

    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');
    await showDemoCaption(page, `${participant.name} signs in and joins — ${expectedAfter}`);
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

  // --- Off-camera: participants three and four join through the same UI. ---
  for (const [index, participant] of OFF_CAMERA_JOINS.entries()) {
    await joinOffCamera(browser, participant, `${index + 4} of 6`);
  }

  // --- Segment 4: the fifth participant joins and fills the league. ---
  {
    const participant = RECORDED_JOINS[2];
    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');
    await showDemoCaption(page, `${participant.name} joins last — the league is full (6 of 6)`);
    await signInAs(page, participant.id, participant.name);

    const countBadge = page.locator('[data-lobby-count]');
    await moveMouseToElement(page, countBadge, QUICK_MOVE);
    await expect(countBadge).toHaveText('5 of 6');
    await demoWait(300);

    const joinButton = page.locator('[data-join-fantasy-league]');
    await expect(joinButton).toHaveText(`Join league as ${participant.name}`);
    await moveAndClick(page, joinButton, { ...QUICK_MOVE, pauseBeforeClickMs: 350 });

    await expect(countBadge).toHaveText('6 of 6');
    await expect(page.locator('[data-lobby-ready]')).toContainText('League full — 6 of 6 participants.');
    await expect(page.locator(`[data-lobby-member="${participant.id}"]`)).toContainText(participant.name);
    await moveMouseToElement(page, countBadge, QUICK_MOVE);
    await demoWait(900);

    segments.push(await saveSegment(page, context, `04-join-${participant.id}-league-full.webm`));
  }

  // --- Segment 5: the owner reloads and shows the full six-member league. ---
  {
    const { context, page } = await newRecordedPage(browser);
    await page.goto('/');
    await showDemoCaption(page, 'Owner reloads — all six members remain, and the draft can be seeded');

    const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
    await moveAndClick(page, fantasyLeagueLink, { ...QUICK_MOVE, pauseBeforeClickMs: 300 });

    const countBadge = page.locator('[data-lobby-count]');
    await expect(countBadge).toHaveText('6 of 6');
    await expect(page.locator('[data-lobby-member]')).toHaveCount(6);
    await expect(page.locator('[data-lobby-member]', { hasText: 'Owner' })).toHaveCount(1);
    await moveMouseToElement(page, countBadge, QUICK_MOVE);
    await demoWait(600);

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
    await demoWait(1500);

    segments.push(await saveSegment(page, context, '05-owner-final-six-members.webm'));
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
