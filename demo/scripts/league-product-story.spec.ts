import { expect, test } from '@playwright/test';

const setUser = async (page: any, userId: string): Promise<void> => {
  await page.goto('/');
  const loginForm = page.locator('form[data-action="login"]');
  await expect(loginForm).toBeVisible();
  await page.locator('select[name="userId"]').selectOption(userId);
  await page.locator('form[data-action="login"] button[type="submit"]').click();
  await expect(page.getByText('Active account:')).toContainText(userId === 'league-admin' ? 'League Admin' : userId === 'ava-park' ? 'Ava Park' : 'Fantasy Owner');
};

test('Part 1: League + Season creation', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await setUser(page, 'league-admin');

  await expect(page.getByRole('heading', { name: 'Create upcoming season' })).toBeVisible();

  const seasonNameInput = page.getByLabel('Season name');
  await expect(seasonNameInput).toBeVisible();
  await seasonNameInput.fill('North Ridge Summer');

  const purseInput = page.getByLabel('Purse amount');
  await purseInput.fill('4000000');

  const titleSponsorInput = page.getByLabel('Title sponsor name');
  await titleSponsorInput.fill('Northwind Outfitters');

  const createSeasonButton = page.getByRole('button', { name: 'Create upcoming season' });
  await createSeasonButton.click();

  await expect(page.getByText(/Upcoming season .* is ready with Northwind Outfitters as title sponsor\./)).toBeVisible();
});

test('Part 2: Scorekeeping + seed all group scores', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await setUser(page, 'league-admin');

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

test('Part 3: Fantasy Owner + seed fantasy draft', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await setUser(page, 'fantasy-owner');

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
