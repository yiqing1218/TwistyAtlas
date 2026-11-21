import { expect, test } from '@playwright/test';

/**
 * 演示底面：选"白底"后，公式会以共轭形式（`x2 ... x2`）播放，
 * 并且播放到终点必须仍然是复原态（不能因为换了底面而把魔方转乱）。
 */
test.describe('演示底面', () => {
  test('默认是黄底，公式原样呈现', async ({ page }) => {
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible();
    await expect(page.getByTestId('bottom-select')).toHaveValue('yellow');

    const tokens = page.locator('[data-testid="algorithm-tokens"] .token');
    await expect(tokens.first()).toBeVisible({ timeout: 60_000 });
    // 芯片按钮的文本里带步号（"1x2"），用 aria-label 判断真实动作
    expect(await tokens.first().getAttribute('aria-label')).not.toContain('x2');
  });

  test('切换白底后公式前后各多一个旋转，且播放到终点仍是复原态', async ({ page }) => {
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible();

    // 选一个能回到复原态的案例：OLL 的逆公式初始态 → 播放后回到复原
    await page.getByTestId('bottom-select').selectOption('white');

    const tokens = page.locator('[data-testid="algorithm-tokens"] .token');
    await expect(tokens.first()).toHaveAttribute('aria-label', /x2/, { timeout: 60_000 });
    await expect(tokens.last()).toHaveAttribute('aria-label', /x2/);

    const solved = await page.evaluate(async () => {
      const player = document.querySelector('twisty-player') as unknown as {
        experimentalModel: { kpuzzle: { get: () => Promise<{ defaultPattern: () => unknown }> } };
      };
      const kpuzzle = await player.experimentalModel.kpuzzle.get();
      return JSON.stringify(kpuzzle.defaultPattern());
    });

    await page.getByTestId('btn-end').click();
    await page.waitForTimeout(600);
    const end = await page.evaluate(async () => {
      const player = document.querySelector('twisty-player') as unknown as {
        experimentalModel: { currentPattern: { get: () => Promise<unknown> } };
      };
      return JSON.stringify(await player.experimentalModel.currentPattern.get());
    });

    // 共轭后终态必须**仍然是复原态**：换底面只改观察方向，不能把魔方转乱
    expect(end).toBe(solved);
  });

  test('底面选择会被持久化', async ({ page }) => {
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible();
    await page.getByTestId('bottom-select').selectOption('blue');
    // 写库是异步的：先确认界面已切到蓝底，再刷新验证持久化
    await expect(page.getByTestId('bottom-select')).toHaveValue('blue');
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByTestId('bottom-select')).toHaveValue('blue', { timeout: 30_000 });
  });
});
