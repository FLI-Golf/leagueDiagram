import { expect, test } from '@playwright/test';
import { demoWait, moveAndClick, moveMouseBelowElement, moveMouseToElement } from '../helpers/demoCursor';

async function circleAroundElement(page: any, target: any, options: { radius?: number; durationMs?: number; pauseAfterMs?: number } = {}) {
  const { radius = 24, durationMs = 900, pauseAfterMs = 0 } = options;
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('Cannot circle element: it has no visible bounding box.');
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const stepCount = 18;

  for (let index = 0; index < stepCount; index += 1) {
    const angle = (index / stepCount) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    await page.mouse.move(x, y, { steps: 6 });
    await demoWait(durationMs / stepCount);
  }

  if (pauseAfterMs > 0) {
    await demoWait(pauseAfterMs);
  }
}

test('Part 3: switch to Fantasy Owner and seed the fantasy draft', async ({ page }) => {
  await page.goto('/');

  const mockUserHeading = page.getByRole('heading', { name: 'Mock current user' });
  await expect(mockUserHeading).toBeVisible();

  await moveMouseBelowElement(page, mockUserHeading, 40, { durationMs: 900, steps: 30 });
  await demoWait(400);

  const accountSelect = page.getByLabel('Signed in as');
  await moveMouseToElement(page, accountSelect, { durationMs: 950, steps: 30 });
  await accountSelect.selectOption('fantasy-owner');

  const switchAccountButton = page.getByRole('button', { name: 'Switch account' });
  await moveAndClick(page, switchAccountButton, { durationMs: 1000, steps: 32, pauseBeforeClickMs: 500 });

  await expect(page.getByText('Active account:')).toContainText('Fantasy Owner');

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));

  const seedDraftButton = page.getByRole('button', { name: 'Seed fantasy draft' });
  await moveAndClick(page, seedDraftButton, { durationMs: 1000, steps: 30, pauseBeforeClickMs: 500 });

  await expect(page.getByRole('heading', { name: /Fantasy draft not seeded|Sunset Open draft/i })).toBeVisible();

  const sunsetOpenButton = page.getByText('Sunset Open', { exact: true }).first();
  await moveAndClick(page, sunsetOpenButton, { durationMs: 1000, steps: 28, pauseBeforeClickMs: 400 });
  await page.mouse.wheel(0, 220);
  await demoWait(5000);
  await page.mouse.wheel(0, 180);
  await demoWait(2200);

  const oneOfFour = page.getByText('1 of 4', { exact: true }).first();
  await moveMouseToElement(page, oneOfFour, { durationMs: 900, steps: 28 });
  await circleAroundElement(page, oneOfFour, { radius: 22, durationMs: 900, pauseAfterMs: 0 });

  const oneOfTwentyFour = page.getByText('1 of 24', { exact: true }).first();
  await moveMouseToElement(page, oneOfTwentyFour, { durationMs: 900, steps: 28 });
  await circleAroundElement(page, oneOfTwentyFour, { radius: 22, durationMs: 900, pauseAfterMs: 0 });

  const onTheClock = page.getByText('On the clock', { exact: true }).first();
  await moveMouseToElement(page, onTheClock, { durationMs: 900, steps: 28 });
  await circleAroundElement(page, onTheClock, { radius: 24, durationMs: 900, pauseAfterMs: 0 });

  const pickTimer = page.getByText('Pick timer', { exact: true }).first();
  await moveMouseToElement(page, pickTimer, { durationMs: 900, steps: 28 });
  await circleAroundElement(page, pickTimer, { radius: 24, durationMs: 900, pauseAfterMs: 0 });

  await page.mouse.wheel(0, 420);
  await demoWait(3000);

  await expect(page.getByText('Round', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pick', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('On the clock', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pick timer', { exact: true }).first()).toBeVisible();
});
