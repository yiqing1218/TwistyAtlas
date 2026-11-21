import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') logs.push('CONSOLE: ' + m.text()); });
await page.goto('http://localhost:5178/#/timer');
await page.waitForTimeout(2500);
await page.keyboard.down('Space');
await page.waitForTimeout(450);
await page.keyboard.up('Space');
await page.waitForTimeout(800);
const running = await page.getByTestId('timer-display').getAttribute('aria-label');
await page.keyboard.press('Space');
await page.waitForTimeout(1200);
const rows = await page.locator('.history__row').count();
const stopped = await page.getByTestId('timer-display').getAttribute('aria-label');
const dbg = await page.evaluate(async () => {
  try {
    const dbs = await indexedDB.databases();
    return { dbs };
  } catch (e) { return { err: String(e) }; }
});
console.log({ running, stopped, rows, logs: logs.slice(0, 5), dbg });
await browser.close();
