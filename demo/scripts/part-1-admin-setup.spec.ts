import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

test('Part 1 narrated: sign in as League Admin and review the pre-populated Manage league form', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseBelowElement(page, mockUserHeading, 42, { durationMs: 900, steps: 30 });
  await demoWait(300);
  await moveMouseToElement(page, accountSelect, { durationMs: 1000, steps: 30 });
  await demoWait(3000);

  await accountSelect.selectOption('league-admin');
  await demoWait(350);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 1200, steps: 32, pauseBeforeClickMs: 500 });
  await demoWait(2000);

  await expect(page.getByText('Active account:')).toContainText('League Admin');
  await expect(page.getByRole('heading', { name: 'Create upcoming season' })).toBeVisible();

  const manageLeagueLink = page.locator('[data-dashboard-filter="Manage league"]');
  await moveMouseToElement(page, manageLeagueLink, { durationMs: 1500, steps: 38 });
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'auto' }));
  await demoWait(300);

  const seasonHeading = page.getByRole('heading', { name: 'Create upcoming season' });
  await seasonHeading.scrollIntoViewIfNeeded();

  const seasonNameInput = page.getByLabel('Season name');
  const purseInput = page.getByLabel('Purse amount');
  const titleSponsorInput = page.getByLabel('Title sponsor name');

  await moveMouseToElement(page, seasonNameInput, { durationMs: 1200, steps: 32 });
  await demoWait(1200);
  await moveMouseToElement(page, purseInput, { durationMs: 1400, steps: 32 });
  await demoWait(2000);
  await moveMouseToElement(page, titleSponsorInput, { durationMs: 1400, steps: 32 });
  await demoWait(2000);

  const seasonSetupHeading = page.getByRole('heading', { name: 'Season setup & tournaments' });
  await seasonSetupHeading.scrollIntoViewIfNeeded();
  await moveMouseToElement(page, seasonSetupHeading, { durationMs: 1600, steps: 34 });
  await demoWait(15000);
});
