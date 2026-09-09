import type { Locator, Page } from '@playwright/test';

/**
 * Small helper for slow, visible cursor movement in Playwright demo recordings.
 * Regular Playwright actions (`click()`, `selectOption()`, etc.) jump the mouse
 * instantly, which looks like a glitch on video. These helpers move the mouse
 * through several intermediate points so a viewer can follow the cursor.
 */

export interface MoveOptions {
  /** Total duration of the move, in milliseconds. */
  durationMs?: number;
  /** Number of intermediate mouse positions between start and end. */
  steps?: number;
}

const DEFAULT_DURATION_MS = 850;
const DEFAULT_STEPS = 28;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let lastPosition = { x: 0, y: 0 };

const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Move the mouse smoothly from its last known position to (x, y). */
export async function moveMouseTo(page: Page, x: number, y: number, options: MoveOptions = {}): Promise<void> {
  const { durationMs = DEFAULT_DURATION_MS, steps = DEFAULT_STEPS } = options;
  const start = lastPosition;
  const stepDelay = durationMs / steps;

  for (let step = 1; step <= steps; step += 1) {
    const progress = easeInOutQuad(step / steps);
    const nextX = start.x + (x - start.x) * progress;
    const nextY = start.y + (y - start.y) * progress;
    await page.mouse.move(nextX, nextY);
    await sleep(stepDelay);
  }

  lastPosition = { x, y };
}

/** Move the mouse smoothly to the visible center of a locator. */
export async function moveMouseToElement(page: Page, target: Locator, options: MoveOptions = {}): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('Cannot move mouse to element: it has no visible bounding box.');
  }
  await moveMouseTo(page, box.x + box.width / 2, box.y + box.height / 2, options);
}

/** Move the mouse to an offset just below a locator (useful as a starting position). */
export async function moveMouseBelowElement(page: Page, target: Locator, offsetY = 40, options: MoveOptions = {}): Promise<void> {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error('Cannot move mouse below element: it has no visible bounding box.');
  }
  await moveMouseTo(page, box.x + box.width / 2, box.y + box.height + offsetY, options);
}

/** Move the cursor to a target and click it, pausing briefly beforehand so the click reads clearly on video. */
export async function moveAndClick(page: Page, target: Locator, options: MoveOptions & { pauseBeforeClickMs?: number } = {}): Promise<void> {
  const { pauseBeforeClickMs = 300, ...moveOptions } = options;
  await moveMouseToElement(page, target, moveOptions);
  await sleep(pauseBeforeClickMs);
  await target.click();
}

/** Wait for a fixed amount of time between demo actions (deliberate, for pacing). */
export async function demoWait(ms: number): Promise<void> {
  await sleep(ms);
}
