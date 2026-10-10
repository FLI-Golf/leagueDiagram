import type { Locator, Page } from '@playwright/test';

/**
 * Small helper for slow, visible cursor movement in Playwright demo recordings.
 * Regular Playwright actions (`click()`, `selectOption()`, etc.) jump the mouse
 * instantly, which looks like a glitch on video. These helpers move the mouse
 * through several intermediate points so a viewer can follow the cursor.
 *
 * To make the cursor visible in a captured screen recording, we layer a custom
 * cursor overlay on top of the page and update it while the real browser cursor
 * is also moved with `page.mouse`.
 */

export interface MoveOptions {
  /** Total duration of the move, in milliseconds. */
  durationMs?: number;
  /** Number of intermediate mouse positions between start and end. */
  steps?: number;
}

const DEFAULT_DURATION_MS = 850;
const DEFAULT_STEPS = 28;
const CURSOR_OVERLAY_ID = '__demo-cursor-overlay';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let lastPosition = { x: 0, y: 0 };

const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

async function ensureCursorOverlay(page: Page): Promise<void> {
  await page.evaluate(({ overlayId }) => {
    const existing = document.getElementById(overlayId);
    if (existing) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.position = 'fixed';
    overlay.style.left = '0px';
    overlay.style.top = '0px';
    overlay.style.width = '22px';
    overlay.style.height = '22px';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647';
    overlay.style.opacity = '0';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.transition = 'opacity 120ms ease';
    overlay.style.borderRadius = '50%';
    overlay.style.display = 'block';
    overlay.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.9), 0 10px 28px rgba(0,0,0,0.28)';
    overlay.style.background = 'rgba(15, 118, 110, 0.18)';
    overlay.style.border = '2px solid rgba(15, 118, 110, 0.9)';
    overlay.innerHTML = `
      <div style="position:absolute; inset: 4px; border-radius:50%; background: rgba(15,118,110,0.22);"></div>
      <div style="position:absolute; left: 50%; top: 50%; width: 2px; height: 2px; background: rgba(15,118,110,0.95); border-radius: 50%; transform: translate(-50%, -50%);"></div>
    `;

    document.body.appendChild(overlay);
  }, { overlayId: CURSOR_OVERLAY_ID });
}

/** Make the custom demo cursor visible on screen so it is easy to follow in the capture. */
export async function showDemoCursor(page: Page): Promise<void> {
  await ensureCursorOverlay(page);
  await page.evaluate(({ overlayId }) => {
    const overlay = document.getElementById(overlayId) as HTMLDivElement | null;
    if (!overlay) {
      return;
    }
    overlay.style.opacity = '1';
  }, { overlayId: CURSOR_OVERLAY_ID });
}

/** Move the mouse smoothly from its last known position to (x, y). */
export async function moveMouseTo(page: Page, x: number, y: number, options: MoveOptions = {}): Promise<void> {
  const { durationMs = DEFAULT_DURATION_MS, steps = DEFAULT_STEPS } = options;
  const start = lastPosition;
  const stepDelay = durationMs / steps;

  await ensureCursorOverlay(page);

  for (let step = 1; step <= steps; step += 1) {
    const progress = easeInOutQuad(step / steps);
    const nextX = start.x + (x - start.x) * progress;
    const nextY = start.y + (y - start.y) * progress;
    await page.mouse.move(nextX, nextY);
    await page.evaluate(
      ({ overlayId, nextX: overlayX, nextY: overlayY }) => {
        const overlay = document.getElementById(overlayId) as HTMLDivElement | null;
        if (!overlay) {
          return;
        }
        overlay.style.left = `${overlayX}px`;
        overlay.style.top = `${overlayY}px`;
        overlay.style.opacity = '1';
      },
      { overlayId: CURSOR_OVERLAY_ID, nextX, nextY },
    );
    await sleep(stepDelay);
  }

  lastPosition = { x, y };
  await page.evaluate(
    ({ overlayId, x: finalX, y: finalY }) => {
      const overlay = document.getElementById(overlayId) as HTMLDivElement | null;
      if (!overlay) {
        return;
      }
      overlay.style.left = `${finalX}px`;
      overlay.style.top = `${finalY}px`;
      overlay.style.opacity = '1';
    },
    { overlayId: CURSOR_OVERLAY_ID, x, y },
  );
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
  await page.evaluate(({ overlayId }) => {
    const overlay = document.getElementById(overlayId) as HTMLDivElement | null;
    if (overlay) {
      overlay.style.transform = 'translate(-50%, -50%) scale(0.9)';
      overlay.style.background = 'rgba(249, 115, 22, 0.28)';
      overlay.style.border = '2px solid rgba(249, 115, 22, 0.95)';
    }
  }, { overlayId: CURSOR_OVERLAY_ID });
  await target.click();
  await sleep(120);
  await page.evaluate(({ overlayId }) => {
    const overlay = document.getElementById(overlayId) as HTMLDivElement | null;
    if (overlay) {
      overlay.style.transform = 'translate(-50%, -50%) scale(1)';
      overlay.style.background = 'rgba(15, 118, 110, 0.18)';
      overlay.style.border = '2px solid rgba(15, 118, 110, 0.9)';
    }
  }, { overlayId: CURSOR_OVERLAY_ID });
}

/** Wait for a fixed amount of time between demo actions (deliberate, for pacing). */
export async function demoWait(ms: number): Promise<void> {
  await sleep(ms);
}
