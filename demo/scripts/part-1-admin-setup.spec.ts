import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

test('Part 1: admin creates the season and assigns scorekeepers', async ({ page }) => {
  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();

  await moveMouseBelowElement(page, mockUserHeading, 40, { durationMs: 900, steps: 30 });
  await demoWait(400);

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, { durationMs: 950, steps: 30 });
  await accountSelect.selectOption('league-admin');
  await demoWait(500);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 1000, steps: 32, pauseBeforeClickMs: 500 });
  await demoWait(800);

  await expect(page.getByText('Active account:')).toContainText('League Admin');
  await expect(page.getByRole('heading', { name: 'Create upcoming season' })).toBeVisible();

  const seasonNameInput = page.getByLabel('Season name');
  await moveMouseToElement(page, seasonNameInput, { durationMs: 900, steps: 28 });
  await seasonNameInput.fill('North Ridge Summer');
  await demoWait(300);

  const purseInput = page.getByLabel('Purse amount');
  await moveMouseToElement(page, purseInput, { durationMs: 900, steps: 28 });
  await purseInput.fill('4000000');
  await demoWait(250);

  const titleSponsorInput = page.getByLabel('Title sponsor name');
  await moveMouseToElement(page, titleSponsorInput, { durationMs: 900, steps: 28 });
  await titleSponsorInput.fill('Northwind Outfitters');
  await demoWait(250);

  const createSeasonButton = page.getByRole('button', { name: 'Create upcoming season' });
  await moveAndClick(page, createSeasonButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 450 });

  await expect(page.getByText('Upcoming season "North Ridge Summer" is ready with Northwind Outfitters as title sponsor.')).toBeVisible();
  await demoWait(1200);

  const scorekeeperAssignmentLink = page.getByRole('link', { name: 'Scorekeeper assignment' });
  await moveMouseToElement(page, scorekeeperAssignmentLink, { durationMs: 1100, steps: 32 });
  await scorekeeperAssignmentLink.click();

  await expect(page.getByRole('heading', { name: 'Assign a scorekeeper per group' })).toBeVisible();
  await demoWait(800);

  const beginScoringButton = page.getByRole('button', { name: 'Begin hole-by-hole scoring' });
  await moveAndClick(page, beginScoringButton, { durationMs: 1000, steps: 32, pauseBeforeClickMs: 500 });

  await expect(page.getByText('Coverage:')).toBeVisible();
  await expect(page.getByText('Hole-by-hole scoring')).toBeVisible();
  await demoWait(1500);
});
