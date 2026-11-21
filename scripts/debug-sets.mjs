import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.goto('http://localhost:5178/#/sets', { waitUntil: 'load' });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const el = document.querySelector('twisty-player');
  const canvas = el?.shadow?.querySelector('canvas');
  const rect = canvas?.getBoundingClientRect();
  const viewport = document.querySelector('.viewport')?.getBoundingClientRect();
  const canvasHost = document.querySelector('.viewport__canvas')?.getBoundingClientRect();
  return {
    hasPlayer: !!el,
    playerH: el?.getBoundingClientRect().height,
    canvas: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
    viewport: viewport ? { w: Math.round(viewport.width), h: Math.round(viewport.height) } : null,
    host: canvasHost ? { w: Math.round(canvasHost.width), h: Math.round(canvasHost.height) } : null,
    stepLabel: document.querySelector('[data-testid="step-label"]')?.textContent?.trim(),
    error: document.querySelector('[data-testid="player-error"]')?.textContent?.trim(),
    loading: !!document.querySelector('[data-testid="viewport-loading"]'),
    scrollY: window.scrollY,
  };
});
console.log(info);
await browser.close();
