import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

/**
 * Demo intro: switch the mock current user to the Fantasy Owner account and
 * open the "Fantasy league" screen. This is a demo-recording aid, not a
 * correctness test — cursor movement is deliberately slowed down so a viewer
 * can follow the interaction.
 */
test('fantasy owner switches account and opens Fantasy league', async ({ page }) => {
  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();

  // Start the cursor just below the "Mock current user" heading.
  await moveMouseBelowElement(page, mockUserHeading, 40, { durationMs: 900, steps: 30 });
  await demoWait(500);

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, { durationMs: 950, steps: 32 });
  await demoWait(250);
  await accountSelect.click();

  const fantasyOwnerOption = accountSelect.locator('option', { hasText: 'Fantasy Owner' }).first();
  const fantasyOwnerValue = await fantasyOwnerOption.getAttribute('value');
  expect(fantasyOwnerValue).toBeTruthy();
  await accountSelect.selectOption(fantasyOwnerValue!);

  await demoWait(1200);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });

  await demoWait(1200);

  await expect(page.getByText('Active account:')).toContainText('Fantasy Owner');

  const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
  await moveMouseToElement(page, fantasyLeagueLink, { durationMs: 1100, steps: 32 });
  await demoWait(450);
  await fantasyLeagueLink.click();

  await demoWait(800);
  await expect(fantasyLeagueLink).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('paragraph').filter({ hasText: 'Draft controls' })).toBeVisible();
  await demoWait(1000);
});
