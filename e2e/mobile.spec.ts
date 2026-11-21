import { expect, test, type Page } from '@playwright/test';
import { waitForCanvas } from './helpers';

/**
 * 手机端验收：底部页签（拇指可达）+ 「大页面固定、不整页滚动」。
 *
 * 判定方式全部基于真实布局数值（scrollHeight / boundingBox），不做截图比对。
 */

const MOBILE_PAGES = [
  { hash: '#/timer', tab: '计时器' },
  { hash: '#/sets', tab: '公式集' },
  { hash: '#/library', tab: '公式库' },
  { hash: '#/settings', tab: '设置' },
];

async function scrollMetrics(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const tabbar = document.querySelector('.app-tabbar');
    const rect = tabbar?.getBoundingClientRect();
    return {
      v: doc.scrollHeight - doc.clientHeight,
      h: doc.scrollWidth - doc.clientWidth,
      tabbarDisplay: tabbar ? getComputedStyle(tabbar).display : 'missing',
      tabbarBottom: rect ? Math.round(rect.bottom) : -1,
      innerHeight: window.innerHeight,
    };
  });
}

function tabbar(page: Page) {
  return page.locator('.app-tabbar');
}

test.describe('移动端（360×800 / 390×844）', () => {
  test('E09 底部页签可达，四个核心页面都不整页滚动', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible({ timeout: 30_000 });

    const shell = await scrollMetrics(page);
    // 顶部导航在手机上隐藏，导航只在底部
    expect(shell.tabbarDisplay).not.toBe('none');
    expect(await page.locator('.app-nav').isVisible()).toBe(false);
    // 底部页签贴着视口底边（安全区由 env() 撑开，这里只要求落在视口内）
    expect(shell.tabbarBottom).toBeGreaterThan(shell.innerHeight - 40);
    expect(shell.tabbarBottom).toBeLessThanOrEqual(shell.innerHeight + 1);

    for (const target of MOBILE_PAGES) {
      await tabbar(page).getByRole('link', { name: target.tab, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${target.hash}$`));
      await page.waitForTimeout(400);

      const metrics = await scrollMetrics(page);
      expect(metrics.v, `${target.tab} 整页不应上下滚动`).toBeLessThanOrEqual(1);
      expect(metrics.h, `${target.tab} 不应有横向溢出`).toBeLessThanOrEqual(1);
      expect(metrics.tabbarDisplay, `${target.tab} 底部页签应可见`).not.toBe('none');
    }
  });

  test('E09b 手机入口落到公式集，桌面三栏工作台不在手机暴露', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');
    await expect(page).toHaveURL(/#\/sets$/, { timeout: 30_000 });
    await expect(page.getByTestId('sets-page')).toBeVisible();
  });

  test('E09c 计时器大数字完整落在屏内，不被裁掉', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/#/timer');
    const display = page.getByTestId('timer-display');
    await expect(display).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(600);

    const box = await display.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(361);
    // 打乱文字必须完整（不能因为 clamp 高度被截断）
    const scramble = page.locator('.scramble-bar__text');
    const clipped = await scramble.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(clipped).toBeLessThanOrEqual(1);
  });

  test('E09d 公式集：播放器可见，案例列表在容器内部滚动', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible({ timeout: 30_000 });

    await expect(page.locator('.cases-player__viewport canvas, .cases-player__viewport twisty-player').first()).toBeVisible({
      timeout: 30_000,
    });
    const pane = page.getByTestId('cases-pane');
    await expect(pane).toBeVisible();
    const inner = await pane.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(inner, '案例列表应该是内部滚动的长列表').toBeGreaterThan(10);

    const metrics = await scrollMetrics(page);
    expect(metrics.v).toBeLessThanOrEqual(1);
  });

  test('E09e 公式库点一条直接进单条详情页（带播放器）', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/library');
    const card = page.locator('.formula-card').first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    const title = (await card.locator('.formula-card__title').textContent())?.trim() ?? '';

    await card.click();
    await expect(page).toHaveURL(/#\/formula\//);
    await expect(page.locator('.detail-view__title')).toHaveText(title);
    await expect(page.locator('.detail-view')).not.toContainText('正在读取公式');

    await waitForCanvas(page);
    const metrics = await scrollMetrics(page);
    expect(metrics.v).toBeLessThanOrEqual(1);
    expect(metrics.h).toBeLessThanOrEqual(1);
  });

  test('E09f 横竖屏切换后模型仍存在', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible({ timeout: 30_000 });
    await waitForCanvas(page);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(800);
    await waitForCanvas(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await waitForCanvas(page);
    expect(await page.locator('twisty-player').count()).toBe(1);
  });
});
