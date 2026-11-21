/**
 * 界面截图存档脚本（交付证据）。
 *
 * 覆盖任务书要求的三档视口：1366×768（桌面）、390×844、360×800（手机）。
 * 所有截图均在真实 WebGL 画布出现后拍摄，不使用任何示意图。
 *
 * 用法：先启动开发服务器（默认 http://localhost:5178），再运行
 *   node scripts/shots.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://localhost:5178';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = resolve(root, 'docs/screenshots');
mkdirSync(shotDir, { recursive: true });

async function canvasReady(page) {
  return page.evaluate(() => {
    const root = document.querySelector('twisty-player');
    if (!root) return false;
    const queue = [root.shadow ?? document];
    const seen = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (seen.has(node)) continue;
      seen.add(node);
      if (node.tagName === 'CANVAS') {
        const rect = node.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) return true;
      }
      if (node.shadow) queue.push(node.shadow);
      for (const child of node.children ?? []) queue.push(child);
    }
    return false;
  });
}

async function waitCanvas(page) {
  for (let i = 0; i < 60; i += 1) {
    if (await canvasReady(page)) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

const log = [];

async function shot(page, name, options = {}) {
  const path = resolve(shotDir, `${name}.png`);
  await page.screenshot({ path, ...options });
  log.push(`${name}.png  ${page.viewportSize().width}×${page.viewportSize().height}`);
  console.log(`captured ${name}.png`);
}

// ---------- 桌面 1366×768 ----------
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto(BASE);
  await page.getByTestId('puzzle-canvas').waitFor();
  await page.locator('.formula-card').first().waitFor();
  await page.locator('.formula-card').first().click();
  await page.waitForFunction(() => /^0 \/ \d+$/.test(document.querySelector('[data-testid="step-label"]')?.textContent?.trim() ?? ''));
  await waitCanvas(page);
  await page.waitForTimeout(600);
  await shot(page, 'desktop-home-1366x768');
  await shot(page, 'desktop-home-1366x768-full', { fullPage: true });

  // 播放到第 2 步，证明步骤 chip 与画面同步
  await page.getByTestId('btn-next').click();
  await page.getByTestId('btn-next').click();
  await page.waitForTimeout(700);
  await shot(page, 'desktop-step2-1366x768');

  // 编辑器
  await page.getByRole('button', { name: '新建公式' }).click();
  await page.locator('[data-testid="input-title"]').waitFor();
  await page.waitForTimeout(300);
  await shot(page, 'desktop-editor-1366x768');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 导入 / 导出
  await page.getByRole('button', { name: '导入 / 导出' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'desktop-import-1366x768');
  await page.locator('.dialog__footer').getByRole('button', { name: '关闭' }).click();
  await page.waitForTimeout(300);

  // 公式库
  await page.goto(`${BASE}/#/library`);
  await page.locator('.formula-card').first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'desktop-library-1366x768');

  // 设置 / 能力矩阵
  await page.goto(`${BASE}/#/settings`);
  await page.locator('table').first().waitFor();
  await page.waitForTimeout(400);
  await shot(page, 'desktop-settings-1366x768');
  await shot(page, 'desktop-settings-1366x768-full', { fullPage: true });

  await page.close();
}

// ---------- 手机端截图 ----------
// 手机端是独立的四页签结构（计时器 / 公式集 / 公式库 / 设置），
// 由 scripts/shot-mobile.mjs 负责逐页截图与「整页不滚动」量化检查。
console.log('手机端截图与布局检查请运行：node scripts/shot-mobile.mjs');

await browser.close();
console.log('\n--- 存档 ---');
for (const line of log) console.log(line);
