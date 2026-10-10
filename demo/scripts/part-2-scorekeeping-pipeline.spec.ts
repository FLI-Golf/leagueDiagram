import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

test('Part 2: scorekeeper selects a staff account, edits scores, and advances the hole', async ({ page }) => {
  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();

  await moveMouseBelowElement(page, mockUserHeading, 40, { durationMs: 900, steps: 30 });
  await demoWait(400);

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, { durationMs: 950, steps: 30 });
  await accountSelect.selectOption('ava-park');
  await demoWait(350);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 1000, steps: 32, pauseBeforeClickMs: 500 });
  await demoWait(3000);

  await expect(page.getByText('Active account:')).toContainText('Ava Park');

  const scorekeeperScorecardLink = page.getByRole('link', { name: 'Scorekeeper scorecard' });
  await moveMouseToElement(page, scorekeeperScorecardLink, { durationMs: 1100, steps: 32 });
  await scorekeeperScorecardLink.click();
  await demoWait(3000);

  await expect(page.getByRole('heading', { name: /Hole-by-hole scoring|Final hole/i })).toBeVisible();

  const incrementButtons = page.locator('button[data-action="increment-score"]');
  const firstScore = incrementButtons.first();
  const secondScore = incrementButtons.nth(1);

  await moveMouseToElement(page, firstScore, { durationMs: 800, steps: 26 });
  await firstScore.click();
  await demoWait(250);

  await moveMouseToElement(page, secondScore, { durationMs: 800, steps: 26 });
  await secondScore.click();
  await demoWait(250);

  await demoWait(2000);

  const submitButton = page.getByRole('button', { name: 'Submit Scores & Move to next hole' });
  await moveAndClick(page, submitButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });
  await demoWait(5000);
});
