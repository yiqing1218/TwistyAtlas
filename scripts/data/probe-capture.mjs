#!/usr/bin/env node
/**
 * 通用「数据源探测」：用无头浏览器打开页面，记录它自己发出的 JSON 请求与响应。
 *
 * 很多公式站是纯客户端渲染（Next.js Flight / React SPA），HTML 里没有公式文本，
 * 但页面会去请求一份 JSON。这里直接把这层抓下来，避免去逆向站点代码。
 *
 * 用法：
 *   node scripts/data/probe-capture.mjs <slug> <url> [等待毫秒]
 *
 * 产物：
 *   data/raw/probe/<slug>/page.html        渲染后的 DOM（便于看结构）
 *   data/raw/probe/<slug>/resp-<n>.json    捕获到的 JSON 响应
 *   data/raw/probe/<slug>/index.json       捕获清单（url / 大小 / 是否含 alg 字样）
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [slug, url, waitMs = '12000'] = process.argv.slice(2);
if (!slug || !url) {
  console.error('用法：node scripts/data/probe-capture.mjs <slug> <url> [等待毫秒]');
  process.exit(1);
}

const outDir = resolve(root, 'data/raw/probe', slug);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const captured = [];
page.on('response', async (res) => {
  const type = res.headers()['content-type'] ?? '';
  if (!/json|text\/plain/.test(type)) return;
  try {
    const body = await res.text();
    if (body.length < 400) return;
    captured.push({ url: res.url(), status: res.status(), bytes: body.length, body });
  } catch {
    /* 响应体已被丢弃，忽略 */
  }
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
// 触发懒加载：滚动到底部几次
for (let i = 0; i < 6; i += 1) {
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(900);
}
await page.waitForTimeout(Number(waitMs));

const index = [];
for (const [i, item] of captured.entries()) {
  const file = `resp-${i}.json`;
  writeFileSync(resolve(outDir, file), item.body, 'utf-8');
  index.push({
    file,
    url: item.url,
    status: item.status,
    bytes: item.bytes,
    algHits: (item.body.match(/"(?:alg|algs)"/g) ?? []).length,
  });
}
writeFileSync(resolve(outDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');

const html = await page.content();
writeFileSync(resolve(outDir, 'page.html'), html, 'utf-8');

console.log(`页面：${url}`);
console.log(`DOM：${(html.length / 1024).toFixed(0)} KB  捕获 JSON：${index.length} 份`);
for (const item of index.sort((a, b) => b.algHits - a.algHits).slice(0, 8)) {
  console.log(`  ${String(item.algHits).padStart(5)} alg命中  ${(item.bytes / 1024).toFixed(0)}KB  ${item.file}  ${item.url.slice(0, 110)}`);
}

await browser.close();
