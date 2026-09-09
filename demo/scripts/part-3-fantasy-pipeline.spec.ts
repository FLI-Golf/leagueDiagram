import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

test('Part 3: fantasy owner seeds a draft and reviews the draft board', async ({ page }) => {
  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();

  await moveMouseBelowElement(page, mockUserHeading, 40, { durationMs: 900, steps: 30 });
  await demoWait(400);

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, { durationMs: 950, steps: 30 });
  await accountSelect.selectOption('fantasy-owner');
  await demoWait(500);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 1000, steps: 32, pauseBeforeClickMs: 500 });
  await demoWait(800);

  await expect(page.getByText('Active account:')).toContainText('Fantasy Owner');

  const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
  await moveMouseToElement(page, fantasyLeagueLink, { durationMs: 1100, steps: 32 });
  await fantasyLeagueLink.click();

  await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();
  await demoWait(700);

  const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
  await moveAndClick(page, seedDraftButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });
  await demoWait(900);

  await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();

  const completeDraftButton = page.getByRole('button', { name: 'Complete draft' });
  await moveAndClick(page, completeDraftButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });

  await expect(page.getByText('Draft complete')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();
  await demoWait(2000);
});
