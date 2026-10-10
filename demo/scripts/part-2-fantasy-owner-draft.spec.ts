import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

test('Part 2: fantasy owner seeds the Sunset Open draft and lets the draft unfold with auto-picks and gender checks', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();
  await moveMouseBelowElement(page, mockUserHeading, 42, { durationMs: 900, steps: 30 });
  await demoWait(500);

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, { durationMs: 1000, steps: 30 });
  await accountSelect.selectOption('fantasy-owner');
  await demoWait(400);

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 1100, steps: 32, pauseBeforeClickMs: 500 });
  await demoWait(1500);

  await expect(page.getByText('Active account:')).toContainText('Fantasy Owner');

  const fantasyLeagueLink = page.getByRole('link', { name: 'Fantasy league' });
  await moveMouseToElement(page, fantasyLeagueLink, { durationMs: 1200, steps: 34 });
  await fantasyLeagueLink.click();
  await demoWait(1000);

  await expect(page.getByRole('heading', { name: 'Fantasy draft not seeded' })).toBeVisible();

  const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
  await moveAndClick(page, seedDraftButton, { durationMs: 1100, steps: 32, pauseBeforeClickMs: 500 });
  await demoWait(800);

  await expect(page.getByRole('heading', { name: /Sunset Open draft/i })).toBeVisible();

  const startDraftButton = page.getByRole('button', { name: 'Start draft' });
  await moveAndClick(page, startDraftButton, { durationMs: 1100, steps: 32, pauseBeforeClickMs: 500 });
  await demoWait(250);

  await page.evaluate(() => {
    const root = document.body;
    root.style.transition = 'transform 0.8s ease';
    root.style.transform = 'scale(0.72)';
    root.style.transformOrigin = 'top center';
    root.style.width = '140%';
    root.style.overflowX = 'hidden';
    window.scrollTo({ top: 560, behavior: 'auto' });
  });
  await demoWait(3000);

  const roundBanner = page.getByText('Round 1 · Pick 1');
  await roundBanner.scrollIntoViewIfNeeded();
  await demoWait(100);

  await page.evaluate(() => {
    const roundText = [...document.querySelectorAll('*')].find((node) => (node.textContent ?? '').includes('Round 1 · Pick 1')) as HTMLElement | undefined;
    const boardText = [...document.querySelectorAll('*')].find((node) => (node.textContent ?? '').includes('Board for Harper Quinn')) as HTMLElement | undefined;
    const anchor = roundText ?? boardText;

    if (anchor) {
      const { top } = anchor.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.scrollY + top - 80), behavior: 'auto' });
    } else {
      window.scrollTo({ top: 900, behavior: 'auto' });
    }

    const liveDraftPanel = document.querySelector('.draft-clock-banner, .draft-recommendation, .draft-board');
    if (liveDraftPanel instanceof HTMLElement) {
      const panelTop = liveDraftPanel.getBoundingClientRect().top;
      window.scrollTo({ top: Math.max(0, window.scrollY + panelTop - 80), behavior: 'auto' });
    }
  });
  await demoWait(600);

  const boardHeader = page.getByText('Board for Taylor Reed');
  const recommendedPickRow = page.locator('.draft-player--recommended').first();
  await boardHeader.scrollIntoViewIfNeeded();
  await recommendedPickRow.scrollIntoViewIfNeeded();
  await demoWait(600);

  const recommendedPro = page.getByText('Recommended pro');
  await moveMouseToElement(page, recommendedPro, { durationMs: 1500, steps: 34 });
  await demoWait(2000);

  const draftClock = page.locator('.draft-clock-value').first();
  await moveMouseToElement(page, draftClock, { durationMs: 1400, steps: 30 });
  await demoWait(5000);

  // Let the 7-second pick clock run through multiple auto-picks so the draft unfolds naturally.
  await demoWait(42000);

  await page.evaluate(() => {
    const root = document.body;
    root.style.transition = 'transform 0.8s ease';
    root.style.transform = 'scale(0.72)';
    root.style.transformOrigin = 'top center';
    root.style.width = '140%';
    root.style.overflowX = 'hidden';
    window.scrollTo({ top: document.body.scrollHeight - 640, behavior: 'auto' });
  });

  const fantasyStandings = page.getByText('Fantasy standings');
  await fantasyStandings.scrollIntoViewIfNeeded();
  await demoWait(10000);
});
