import { expect, test } from '@playwright/test';

const resetDemoState = async (page: any): Promise<void> => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/');
};

const loginAs = async (page: any, userId: string): Promise<void> => {
  await resetDemoState(page);

  const loginForm = page.locator('form[data-action="login"]');
  await expect(loginForm).toBeVisible();
  await page.locator('select[name="userId"]').selectOption(userId);
  await page.locator('form[data-action="login"] button[type="submit"]').click();

  await expect(page.getByText('Active account:')).toContainText(
    userId === 'league-admin' ? 'League Admin' : userId === 'fantasy-owner' ? 'Fantasy Owner' : 'League Admin'
  );
};

test('Launch the league', async ({ page }) => {
  test.setTimeout(60000);

  await loginAs(page, 'league-admin');

  await expect(page.getByRole('heading', { name: 'Create upcoming season' })).toBeVisible();

  const seasonNameInput = page.getByLabel('Season name');
  await expect(seasonNameInput).toBeVisible();
  await seasonNameInput.fill('North Ridge Summer');

  await page.getByLabel('Purse amount').fill('4000000');
  await page.getByLabel('Title sponsor name').fill('Northwind Outfitters');

  await page.getByRole('button', { name: 'Create upcoming season' }).click();

  await expect(
    page.getByText(/Upcoming season .* is ready with Northwind Outfitters as title sponsor\./)
  ).toBeVisible();
});

test('Run the competition', async ({ page }) => {
  test.setTimeout(60000);

  await loginAs(page, 'league-admin');

  await expect(page.getByText('Active account:')).toContainText('League Admin');

  const developmentLink = page.getByRole('link', { name: 'Development' });
  await expect(developmentLink).toBeVisible();
  await developmentLink.click();

  await expect(page.getByRole('heading', { name: 'Mock data controls' })).toBeVisible();

  const seedAllScoresButton = page.getByRole('button', { name: 'Seed all group scores' });
  await expect(seedAllScoresButton).toBeVisible();
  await seedAllScoresButton.click();

  await expect(page.getByRole('heading', { name: 'Mock data controls' })).toBeVisible();
  await expect(page.getByText('Seed all group scores')).toBeVisible();
});

test('Activate fantasy engagement', async ({ page }) => {
  test.setTimeout(60000);

  await loginAs(page, 'fantasy-owner');

  await expect(page.getByText('Active account:')).toContainText('Fantasy Owner');

  const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
  await expect(fantasyLeagueLink).toBeVisible();
  await fantasyLeagueLink.click();

  await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();

  const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
  await expect(seedDraftButton).toBeVisible();
  await seedDraftButton.click();

  await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();
});
