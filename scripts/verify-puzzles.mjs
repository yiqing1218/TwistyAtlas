/**
 * 多魔方能力实测脚本（阶段 F 证据）。
 *
 * 对注册表中的每种魔方：切换类型 → 等待真实 3D 画布 → 记录动作数 →
 * 执行一步并比较真实状态签名 → 跳到终点 → 截图存档。
 *
 * 用法：先启动开发服务器（默认 http://localhost:5178），再运行
 *   node scripts/verify-puzzles.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://localhost:5178';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = resolve(root, 'docs/screenshots');
mkdirSync(shotDir, { recursive: true });

const PUZZLES = [
  '3x3x3',
  '2x2x2',
  '4x4x4',
  '5x5x5',
  '6x6x6',
  '7x7x7',
  'pyraminx',
  'skewb',
  'megaminx',
  'square1',
];

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto(BASE);
await page.getByTestId('puzzle-canvas').waitFor();

async function canvasSize() {
  return page.evaluate(() => {
    const root = document.querySelector('twisty-player');
    if (!root) return null;
    const queue = [root.shadow ?? document];
    const seen = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (seen.has(node)) continue;
      seen.add(node);
      if (node.tagName === 'CANVAS') {
        const rect = node.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) {
          return { width: Math.round(rect.width), height: Math.round(rect.height) };
        }
      }
      if (node.shadow) queue.push(node.shadow);
      for (const child of node.children ?? []) queue.push(child);
    }
    return null;
  });
}

async function pattern() {
  return page.evaluate(async () => {
    const player = document.querySelector('twisty-player');
    return JSON.stringify(await player.experimentalModel.currentPattern.get());
  });
}

async function strategy() {
  return page.evaluate(async () => {
    const player = document.querySelector('twisty-player');
    return player.experimentalModel.visualizationStrategy.get();
  });
}

const rows = [];

for (const id of PUZZLES) {
  const row = { id, canvas: '-', strategy: '-', canvasCount: 0, steps: '-', moveChanged: '-', endOk: '-', shot: '', note: '' };
  try {
    await page.getByTestId('puzzle-select').selectOption(id);
    await page
      .locator('[data-testid="step-label"]')
      .filter({ hasText: /^0 \/ [1-9]/ })
      .waitFor({ timeout: 90_000 });

    // canvas 在首次渲染后才创建，轮询等待而不是立即断言
    let size = null;
    for (let i = 0; i < 40 && !size; i += 1) {
      size = await canvasSize();
      if (!size) await page.waitForTimeout(300);
    }
    row.canvas = size ? `${size.width}×${size.height}` : 'missing';
    row.strategy = await strategy();
    row.canvasCount = await page.locator('twisty-player').count();
    const label = (await page.getByTestId('step-label').textContent())?.trim() ?? '';
    row.steps = label.split('/')[1]?.trim() ?? '-';

    const before = await pattern();
    await page.getByTestId('btn-next').click();
    await page.waitForTimeout(500);
    const after = await pattern();
    row.moveChanged = before !== after ? 'yes' : 'no';

    await page.getByTestId('btn-play').click();
    await page.waitForTimeout(150);
    await page.getByTestId('btn-play').click();
    await page.getByTestId('btn-end').click();
    await page.waitForTimeout(400);
    const endLabel = (await page.getByTestId('step-label').textContent())?.trim() ?? '';
    row.endOk = endLabel === `${row.steps} / ${row.steps}` ? 'yes' : `no (${endLabel})`;

    const shot = resolve(shotDir, `puzzle-${id}.png`);
    await page.getByTestId('puzzle-canvas').screenshot({ path: shot });
    row.shot = `docs/screenshots/puzzle-${id}.png`;
  } catch (err) {
    row.note = String(err).split('\n')[0].slice(0, 160);
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}

await browser.close();

const header = '| 魔方 | 画布尺寸 | 可视化策略 | 播放器实例 | 动作数 | 单步改变状态 | 终点定位 | 截图 |';
const divider = '|---|---|---|---|---|---|---|---|';
const body = rows
  .map(
    (r) =>
      `| \`${r.id}\` | ${r.canvas} | ${r.strategy} | ${r.canvasCount} | ${r.steps} | ${r.moveChanged} | ${r.endOk} | ${r.shot || r.note} |`,
  )
  .join('\n');
writeFileSync(resolve(root, 'docs/capability-raw.md'), `${header}\n${divider}\n${body}\n`, 'utf-8');
console.log('written docs/capability-raw.md');
