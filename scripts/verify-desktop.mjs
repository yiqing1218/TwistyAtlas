/**
 * 通过 CDP 连接已启动的桌面应用，逐页检查真实渲染。
 *
 * 前置：先用调试端口启动打包产物
 *   out/TwistyAtlas/TwistyAtlas.exe --remote-debugging-port=9222
 * 运行：
 *   node scripts/verify-desktop.mjs
 */
import { chromium } from '@playwright/test';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('index.html')) ?? ctx.pages()[0];

const shell = await page.evaluate(() => ({
  title: document.title,
  hash: location.hash,
  hasPlayer: !!document.querySelector('twisty-player'),
  bridge: window.desktop ?? null,
}));
console.log('工作台：', JSON.stringify(shell));

async function goto(hash) {
  await page.evaluate((h) => {
    location.hash = h;
  }, hash);
}

// 计时器页
await goto('#/timer');
await page.waitForSelector('[data-testid="timer-page"][data-ready="true"]', { timeout: 30_000 });
const timer = await page.evaluate(() => ({
  ready: document.querySelector('[data-testid="timer-page"]')?.getAttribute('data-ready'),
  scramble: document.querySelector('[data-testid="scramble-text"]')?.textContent?.trim() ?? '',
  display: document.querySelector('[data-testid="timer-display"]')?.getAttribute('aria-label') ?? '',
  hasCubePreview: !!document.querySelector('.cube-pane twisty-player'),
  statsPane: !!document.querySelector('[data-testid="stats-pane"]'),
}));
console.log('计时器：', JSON.stringify(timer));
await page.screenshot({ path: 'docs/screenshots/desktop-timer.png', timeout: 15_000 }).catch(() => {});

// 公式集页
await goto('#/sets');
await page.waitForSelector('[data-testid="sets-page"]', { timeout: 30_000 });
await page.waitForTimeout(1500);
const sets = await page.evaluate(() => ({
  pills: document.querySelectorAll('[data-testid^="set-pill-"]').length,
  cases: document.querySelectorAll('.case-item').length,
  hasPlayer: !!document.querySelector('twisty-player'),
}));
console.log('公式集：', JSON.stringify(sets));
await page.screenshot({ path: 'docs/screenshots/desktop-sets.png', timeout: 15_000 }).catch(() => {});

await browser.close();
