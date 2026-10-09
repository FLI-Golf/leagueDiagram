import type { Page } from '@playwright/test';

/**
 * Short caption bar for demo recordings. The caption is a plain DOM overlay in
 * the recorded page, so it appears in the Playwright video without any
 * post-production editing.
 */

const CAPTION_BAR_ID = '__demo-caption-bar';

/** Show (or update) the caption bar at the bottom of the recorded page. */
export async function showDemoCaption(page: Page, text: string): Promise<void> {
  await page.evaluate(
    ({ barId, caption }) => {
      let bar = document.getElementById(barId);
      if (!bar) {
        bar = document.createElement('div');
        bar.id = barId;
        bar.setAttribute('aria-hidden', 'true');
        bar.style.position = 'fixed';
        bar.style.left = '50%';
        bar.style.bottom = '18px';
        bar.style.transform = 'translateX(-50%)';
        bar.style.background = 'rgba(15, 23, 42, 0.92)';
        bar.style.color = '#e2e8f0';
        bar.style.padding = '10px 18px';
        bar.style.borderRadius = '999px';
        bar.style.font = '600 15px/1.3 system-ui, sans-serif';
        bar.style.zIndex = '2147483646';
        bar.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
        bar.style.pointerEvents = 'none';
        bar.style.maxWidth = '90vw';
        bar.style.textAlign = 'center';
        document.body.appendChild(bar);
      }
      bar.textContent = caption;
      bar.style.opacity = '1';
    },
    { barId: CAPTION_BAR_ID, caption: text },
  );
}
