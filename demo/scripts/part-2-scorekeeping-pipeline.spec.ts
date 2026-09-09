import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

test('Part 2: scorekeepers score a round and advance the workflow', async ({ page }) => {
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

  const scorekeeperAssignmentLink = page.getByRole('link', { name: 'Scorekeeper assignment' });
  await moveMouseToElement(page, scorekeeperAssignmentLink, { durationMs: 1100, steps: 32 });
  await scorekeeperAssignmentLink.click();

  await expect(page.getByRole('heading', { name: 'Assign a scorekeeper per group' })).toBeVisible();
  await demoWait(800);

  const beginScoringButton = page.getByRole('button', { name: 'Begin hole-by-hole scoring' });
  await moveAndClick(page, beginScoringButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });
  await demoWait(800);

  await expect(page.getByText('Hole-by-hole scoring')).toBeVisible();

  const incrementButtons = page.locator('button[data-action="increment-score"]');
  const firstThree = incrementButtons.first();
  const secondThree = incrementButtons.nth(1);
  const thirdThree = incrementButtons.nth(2);

  await moveMouseToElement(page, firstThree, { durationMs: 800, steps: 26 });
  await firstThree.click();
  await demoWait(250);
  await moveMouseToElement(page, secondThree, { durationMs: 800, steps: 26 });
  await secondThree.click();
  await demoWait(250);
  await moveMouseToElement(page, thirdThree, { durationMs: 800, steps: 26 });
  await thirdThree.click();
  await demoWait(300);

  const submitButton = page.getByRole('button', { name: 'Submit Scores & Move to next hole' });
  await moveAndClick(page, submitButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });

  await expect(page.getByRole('heading', { name: 'Hole-by-hole scoring' })).toBeVisible();
  await demoWait(1500);
});
