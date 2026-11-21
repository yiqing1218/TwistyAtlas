/**
 * 手机端布局巡检：逐页截图 + 量化检查「整页是否还能上下滑」。
 *
 * 判定标准（对应用户要求「大页面固定、不整页滚动」）：
 *   vScroll = documentElement.scrollHeight - clientHeight  →  必须 ≤ 1
 *   hScroll = documentElement.scrollWidth  - clientWidth   →  必须 ≤ 1
 * 同时输出底部页签的位置，确认它在视口内且未被安全区推出去。
 *
 * 用法：先启动 dev server（默认 5178），再 node scripts/shot-mobile.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://localhost:5178';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = resolve(root, 'docs/screenshots');
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

const rows = [];

async function audit(page, label, name) {
  await page.waitForTimeout(500);
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const tabbar = document.querySelector('.app-tabbar');
    const rect = tabbar ? tabbar.getBoundingClientRect() : null;
    return {
      hash: location.hash,
      vScroll: doc.scrollHeight - doc.clientHeight,
      hScroll: doc.scrollWidth - doc.clientWidth,
      tabbarBottom: rect ? Math.round(rect.bottom) : null,
      tabbarTop: rect ? Math.round(rect.top) : null,
      tabbarVisible: rect ? getComputedStyle(tabbar).display !== 'none' : false,
      innerHeight: window.innerHeight,
      headerNavVisible: (() => {
        const nav = document.querySelector('.app-nav');
        return nav ? getComputedStyle(nav).display !== 'none' : false;
      })(),
    };
  });
  rows.push({ label, ...metrics });
  await page.screenshot({ path: resolve(shotDir, `${name}.png`) });
  console.log(`${label.padEnd(22)} hash=${metrics.hash.padEnd(18)} vScroll=${metrics.vScroll} hScroll=${metrics.hScroll} tabbar=${metrics.tabbarTop}..${metrics.tabbarBottom} (vh=${metrics.innerHeight})`);
  return metrics;
}

for (const [width, height] of [
  [390, 844],
  [360, 800],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const tag = `${width}x${height}`;

  // 1) 入口：手机上应落到公式集
  await page.goto(BASE);
  await page.waitForTimeout(2200);
  await audit(page, `入口 / (${tag})`, `mobile-${tag}-entry`);

  // 2) 公式集
  await page.goto(`${BASE}/#/sets`);
  await page.locator('[data-testid="sets-page"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await audit(page, `公式集 (${tag})`, `mobile-${tag}-sets`);

  // 3) 计时器
  await page.goto(`${BASE}/#/timer`);
  await page.waitForTimeout(2000);
  await audit(page, `计时器 (${tag})`, `mobile-${tag}-timer`);

  // 4) 公式库
  await page.goto(`${BASE}/#/library`);
  await page.locator('.formula-card').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  await audit(page, `公式库 (${tag})`, `mobile-${tag}-library`);

  // 5) 点开一条公式 → 单条详情页
  await page.locator('.formula-card').first().click();
  await page.waitForTimeout(1600);
  await audit(page, `公式详情 (${tag})`, `mobile-${tag}-formula`);

  // 6) 设置
  await page.goto(`${BASE}/#/settings`);
  await page.waitForTimeout(1200);
  await audit(page, `设置 (${tag})`, `mobile-${tag}-settings`);

  // 底部页签可点性
  const tab = page.getByRole('link', { name: '计时器' }).last();
  const box = await tab.boundingBox();
  console.log(`  底部页签「计时器」 box=${box ? `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}` : 'null'}`);

  await page.close();
}

await browser.close();

const bad = rows.filter((r) => r.vScroll > 1 || r.hScroll > 1 || !r.tabbarVisible);
console.log('\n--- 结论 ---');
if (bad.length === 0) console.log('全部页面：整页无滚动、无横向溢出、底部页签可见');
else {
  for (const r of bad) {
    console.log(
      `问题：${r.label} vScroll=${r.vScroll} hScroll=${r.hScroll} tabbarVisible=${r.tabbarVisible}`,
    );
  }
  process.exitCode = 1;
}
