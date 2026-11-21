import { expect, test, type Page } from '@playwright/test';

/**
 * 等待计时器真正可输入：
 * 1. 组件挂载完成（data-ready=true 意味着读库、首条打乱、键盘监听都就位）
 * 2. 打乱生成结束（data-pending=false），避免把「生成打乱…」当成打乱文本
 * 3. 打乱文本确实是一条可读的公式
 */
async function waitTimerReady(page: Page) {
  await expect(page.getByTestId('timer-page')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.getByTestId('scramble-text')).toHaveAttribute('data-pending', 'false', { timeout: 30_000 });
  const scramble = ((await page.getByTestId('scramble-text').textContent()) ?? '').trim();
  expect(scramble.length).toBeGreaterThan(8);
  expect(scramble).not.toContain('生成打乱');
  return scramble;
}

/** 按住 Space 达 holdingMs 后松开（holdingMs ≥ 300 才会真正启动） */
async function holdSpace(page: Page, holdingMs: number) {
  await page.keyboard.down('Space');
  await page.waitForTimeout(holdingMs);
  await page.keyboard.up('Space');
}

test.describe('计时器', () => {
  test('按住空格计时、停表后写入成绩并持久化', async ({ page }) => {
    await page.goto('/#/timer');
    const scramble = await waitTimerReady(page);

    // 打乱里应当只有魔方记号，不应混入提示文案
    expect(scramble.split(/\s+/).length).toBeGreaterThan(2);

    // 按住 400ms 后松开 → 开始计时
    await holdSpace(page, 450);
    await page.waitForTimeout(700);
    const running = await page.getByTestId('timer-display').getAttribute('aria-label');
    expect(running).not.toBe('0.000');

    // 再按一次停表
    await page.keyboard.press('Space');
    await expect(page.locator('.history__row')).toHaveCount(1, { timeout: 10_000 });

    // 停表后显示定格成绩（不再变化）
    const stopped = await page.getByTestId('timer-display').getAttribute('aria-label');
    expect(stopped).not.toBe('0.000');
    await page.waitForTimeout(300);
    expect(await page.getByTestId('timer-display').getAttribute('aria-label')).toBe(stopped);

    // 刷新后成绩仍在（IndexedDB 持久化）
    await page.reload();
    await expect(page.locator('.history__row')).toHaveCount(1, { timeout: 20_000 });
  });

  test('按住时间过短不会启动（防误触）', async ({ page }) => {
    await page.goto('/#/timer');
    await waitTimerReady(page);

    await holdSpace(page, 80);
    await page.waitForTimeout(500);
    await expect(page.locator('.history__row')).toHaveCount(0);
    expect(await page.getByTestId('timer-display').getAttribute('aria-label')).toBe('0.000');
  });

  test('切换项目会切换会话并清空列表', async ({ page }) => {
    await page.goto('/#/timer');
    await waitTimerReady(page);

    await holdSpace(page, 450);
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    await expect(page.locator('.history__row')).toHaveCount(1, { timeout: 10_000 });

    await page.getByLabel('计时项目').selectOption('2x2x2');
    await expect(page.locator('.history__row')).toHaveCount(0, { timeout: 10_000 });
  });
});
