import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

/**
 * Final 50-second presentation cut.
 * Story: League Admin -> Scorekeeper -> Fantasy Owner.
 * The goal is a clean product story with explicit role changes and a branded product flow.
 */
test('mock users tour presentation cut', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();
  await moveMouseBelowElement(page, mockUserHeading, 40, { durationMs: 900, steps: 30 });
  await demoWait(500);

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, { durationMs: 950, steps: 30 });
  await accountSelect.selectOption('league-admin');
  await demoWait(400);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 900, steps: 30, pauseBeforeClickMs: 500 });
  await demoWait(800);

  await expect(page.getByText('Active account:')).toContainText('League Admin');
  await expect(page.getByRole('heading', { name: 'Create upcoming season' })).toBeVisible();

  const seasonNameInput = page.getByLabel('Season name');
  await moveMouseToElement(page, seasonNameInput, { durationMs: 900, steps: 28 });
  await seasonNameInput.fill('North Ridge Summer');
  await demoWait(250);

  const purseInput = page.getByLabel('Purse amount');
  await moveMouseToElement(page, purseInput, { durationMs: 900, steps: 28 });
  await purseInput.fill('4000000');
  await demoWait(250);

  const titleSponsorInput = page.getByLabel('Title sponsor name');
  await moveMouseToElement(page, titleSponsorInput, { durationMs: 900, steps: 28 });
  await titleSponsorInput.fill('Northwind Outfitters');
  await demoWait(300);

  const createSeasonButton = page.getByRole('button', { name: 'Create upcoming season' });
  await moveAndClick(page, createSeasonButton, { durationMs: 950, steps: 30, pauseBeforeClickMs: 450 });
  await demoWait(1200);

  await expect(page.getByText(/Upcoming season .* is ready with Northwind Outfitters as title sponsor\./)).toBeVisible();
  await demoWait(1000);

  await page.goto('/');
  await demoWait(700);
  await expect(page.getByRole('heading', { name: 'Mock current user' })).toBeVisible();

  const scorekeeperSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, scorekeeperSelect, { durationMs: 950, steps: 30 });
  await scorekeeperSelect.selectOption('ava-park');
  await demoWait(400);

  const scorekeeperSwitchButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, scorekeeperSwitchButton, { durationMs: 900, steps: 30, pauseBeforeClickMs: 500 });
  await demoWait(800);

  await expect(page.getByText('Active account:')).toContainText('Ava Park');
  await expect(page.getByText('Coverage:')).toBeVisible();
  await demoWait(1200);

  await page.goto('/');
  await demoWait(700);
  await expect(page.getByRole('heading', { name: 'Mock current user' })).toBeVisible();

  const fantasySelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, fantasySelect, { durationMs: 950, steps: 30 });
  await fantasySelect.selectOption('fantasy-owner');
  await demoWait(400);

  const fantasyOwnerSwitchButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, fantasyOwnerSwitchButton, { durationMs: 900, steps: 30, pauseBeforeClickMs: 500 });
  await demoWait(1000);

  await expect(page.getByText('Active account:')).toContainText('Fantasy Owner');
  await expect(page.getByRole('link', { name: 'Fantasy league' })).toBeVisible();

  const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
  await moveMouseToElement(page, fantasyLeagueLink, { durationMs: 1100, steps: 32 });
  await fantasyLeagueLink.click();
  await demoWait(800);

  await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();

  const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
  await moveAndClick(page, seedDraftButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });
  await demoWait(1200);

  await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();
  await demoWait(1800);
});
