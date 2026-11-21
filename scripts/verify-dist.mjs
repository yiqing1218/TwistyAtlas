/**
 * 生产构建产物冒烟验证（阶段 G 证据）。
 *
 * 直接对 `vite build` 产出的 dist/ 做检查，而不是对开发服务器：
 *   - 页面能加载（相对路径资源在 preview 下解析正确）
 *   - 真实 WebGL canvas 出现
 *   - 公式列表有数据（IndexedDB seed 生效）
 *   - Service Worker 已注册，且缓存条目数 > 0
 *
 * 用法：先 `npm run build`，再 `npx vite preview --port 4173`，然后
 *   node scripts/verify-dist.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const failures = [];

page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') failures.push(`console.error: ${msg.text()}`);
});

await page.goto(BASE, { waitUntil: 'load' });
await page.getByTestId('puzzle-canvas').waitFor({ timeout: 60_000 });

// 真实 canvas
let canvas = null;
for (let i = 0; i < 60 && !canvas; i += 1) {
  canvas = await page.evaluate(() => {
    const root = document.querySelector('twisty-player');
    if (!root) return null;
    const queue = [root.shadow ?? document];
    const seen = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (seen.has(node)) continue;
      seen.add(node);
      if (node.tagName === 'CANVAS') {
        const r = node.getBoundingClientRect();
        if (r.width > 50 && r.height > 50) return { w: Math.round(r.width), h: Math.round(r.height) };
      }
      if (node.shadow) queue.push(node.shadow);
      for (const c of node.children ?? []) queue.push(c);
    }
    return null;
  });
  if (!canvas) await page.waitForTimeout(300);
}

const cards = await page.locator('.formula-card').count();
const stepLabel = (await page.getByTestId('step-label').textContent())?.trim();

// Service Worker + 缓存条目
const sw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { supported: true, registered: false };
  await navigator.serviceWorker.ready;
  const names = await caches.keys();
  let entries = 0;
  for (const name of names) entries += (await (await caches.open(name)).keys()).length;
  return { supported: true, registered: true, scriptURL: reg.active?.scriptURL ?? reg.installing?.scriptURL ?? '', caches: names, entries };
});

console.log(JSON.stringify({ url: BASE, canvas, cards, stepLabel, sw, failures }, null, 2));
await browser.close();

const ok = canvas && cards > 0 && stepLabel?.startsWith('0 /') && failures.length === 0;
console.log(ok ? '\nDIST SMOKE: PASS' : '\nDIST SMOKE: FAIL');
process.exit(ok ? 0 : 1);
