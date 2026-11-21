import { expect, test } from '@playwright/test';

test.describe('计时器成绩管理', () => {
  /** 计时一次并等成绩落库 */
  async function solveOnce(page: import('@playwright/test').Page) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(450);
    await page.keyboard.up('Space');
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    await expect(page.locator('.history__row')).toHaveCount(1, { timeout: 10_000 });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/timer');
    await expect(page.getByTestId('timer-page')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  });

  test('单条成绩可以加 +2、判 DNF、再取消', async ({ page }) => {
    await solveOnce(page);

    const row = page.getByTestId('solve-row-0');
    await row.hover();
    await page.getByTestId('plus2-0').click();
    await expect(row.locator('.history__penalty')).toHaveText('+2');

    // 取消 +2
    await page.getByTestId('plus2-0').click();
    await expect(row.locator('.history__penalty')).toHaveCount(0);

    await page.getByTestId('dnf-0').click();
    await expect(row.locator('.history__penalty')).toHaveText('DNF');

    await page.getByTestId('dnf-0').click();
    await expect(row.locator('.history__penalty')).toHaveCount(0);

    // 判罚要写进数据库：刷新后仍然生效
    await page.getByTestId('plus2-0').click();
    await expect(row.locator('.history__penalty')).toHaveText('+2');
    await page.reload();
    await expect(page.getByTestId('solve-row-0').locator('.history__penalty')).toHaveText('+2');
  });

  test('单条成绩可以删除，Delete 键删除最后一条', async ({ page }) => {
    await solveOnce(page);
    await page.getByTestId('solve-row-0').hover();
    await page.getByTestId('delete-0').click();
    await expect(page.locator('.history__row')).toHaveCount(0);
    await expect(page.getByTestId('timer-flash')).toContainText('已删除');

    // Delete 快捷键
    await solveOnce(page);
    await page.keyboard.press('Delete');
    await expect(page.locator('.history__row')).toHaveCount(0);
  });

  test('可以导出 CSV / JSON / 文本', async ({ page }) => {
    await solveOnce(page);
    await page.getByTestId('plus2-0').click({ force: true });

    for (const [format, expectedExt] of [
      ['csv', '.csv'],
      ['json', '.json'],
      ['text', '.txt'],
    ] as const) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20_000 }),
        page.getByTestId(`export-${format}`).click(),
      ]);
      expect(download.suggestedFilename()).toContain('twisty-atlas');
      expect(download.suggestedFilename()).toContain(expectedExt);
      await expect(page.getByTestId('timer-flash')).toContainText('已导出 1 条');
    }
  });

  test('统计面板包含 ao50 / ao100 与最佳值', async ({ page }) => {
    await solveOnce(page);
    const stats = page.getByTestId('stats-pane');
    await expect(stats).toContainText('ao50');
    await expect(stats).toContainText('ao100');
    await expect(stats).toContainText('mo3');
  });
});
