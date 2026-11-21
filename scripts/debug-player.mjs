import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 500)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url().slice(0, 220), r.failure()?.errorText));
page.on('response', (r) => {
  if (r.status() >= 400) console.log('[http]', r.status(), r.url().slice(0, 220));
});

await page.addInitScript(() => {
  window.addEventListener('unhandledrejection', (e) => {
    console.log('UNHANDLED_REJECTION', String(e.reason && (e.reason.stack || e.reason.message || e.reason)).slice(0, 600));
  });
});
await page.goto('http://localhost:5178/');
await page.waitForTimeout(7000);

const layout = await page.evaluate(() => {
  const player = document.querySelector('twisty-player');
  const sr = player.shadow;
  const wrapper = sr.querySelector('.wrapper');
  const viz = sr.querySelector('.visualization-wrapper');
  const scene = sr.querySelector('twisty-3d-scene-wrapper');
  const cs = (el) => {
    const s = getComputedStyle(el);
    return { h: s.height, w: s.width, display: s.display, contain: s.contain, flex: s.flex, gridRow: s.gridRow };
  };
  return {
    player: cs(player),
    wrapper: cs(wrapper),
    viz: cs(viz),
    scene: cs(scene),
    sceneRect: scene.getBoundingClientRect().toJSON(),
  };
});
console.log('LAYOUT', JSON.stringify(layout, null, 1));

const importTest = await page.evaluate(async () => {
  try {
    const mod = await import('/node_modules/cubing/dist/lib/cubing/chunks/twisty-dynamic-3d-HSYJR5CM.js');
    return { ok: true, keys: Object.keys(mod).slice(0, 10) };
  } catch (err) {
    return { ok: false, error: String(err && err.stack || err).slice(0, 800) };
  }
});
console.log('IMPORT_TEST', JSON.stringify(importTest));

const deep = await page.evaluate(() => {
  const out = [];
  function walk(el, depth) {
    if (depth > 14 || !el) return;
    if (el.tagName === 'CANVAS') {
      const r = el.getBoundingClientRect();
      out.push({ kind: 'canvas', w: el.width, h: el.height, cssW: Math.round(r.width), cssH: Math.round(r.height) });
    }
    if (el.tagName && el.tagName.startsWith('TWISTY')) {
      const r = el.getBoundingClientRect();
      out.push({ kind: el.tagName, cssW: Math.round(r.width), cssH: Math.round(r.height) });
    }
    if (el.shadow) walk(el.shadow, depth + 1);
    for (const child of el.children ?? []) walk(child, depth + 1);
  }
  walk(document.querySelector('twisty-player'), 0);
  return out;
});
console.log('DEEP', JSON.stringify(deep));

const info = await page.evaluate(() => {
  const el = document.querySelector('twisty-player');
  if (!el) return { found: false };
  // ManagedCustomElement 的 shadow 是 public 字段（closed 模式，shadowRoot 为 null）
  const sr = el.shadow ?? null;
  const canvas = document.createElement('canvas');
  return {
    found: true,
    rect: el.getBoundingClientRect().toJSON(),
    hasShadow: !!sr,
    shadowHTML: sr ? sr.innerHTML.slice(0, 1200) : null,
    canvasInDoc: document.querySelectorAll('canvas').length,
    canvasInShadow: sr ? sr.querySelectorAll('canvas').length : -1,
    hasButtons: !!el.buttons,
    scenes: sr ? sr.querySelectorAll('twisty-3d-scene-wrapper').length : -1,
    webgl: !!(canvas.getContext('webgl2') || canvas.getContext('webgl')),
  };
});
console.log(JSON.stringify(info, null, 2).slice(0, 4000));
await page.screenshot({ path: 'e2e-debug.png' });
await browser.close();
