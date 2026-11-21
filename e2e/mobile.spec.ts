import { expect, test } from '@playwright/test';
import { gotoStudio, playerCount, selectFormula, waitForCanvas, waitForFormulaReady } from './helpers';

test.describe('移动端（360×800 / 390×844）', () => {
  test('E09 无水平溢出，核心控件可点击', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await expect(page.getByTestId('puzzle-select')).toBeVisible();
    await expect(page.getByTestId('btn-play')).toBeVisible();

    const playBox = await page.getByTestId('btn-play').boundingBox();
    expect(playBox?.width ?? 0).toBeGreaterThan(40);
    expect(playBox?.height ?? 0).toBeGreaterThanOrEqual(38);

    // 触控步进
    await page.getByTestId('btn-next').click();
    await expect(page.getByTestId('step-label')).toHaveText('1 / 4');
    await page.getByTestId('btn-prev').click();
    await expect(page.getByTestId('step-label')).toHaveText('0 / 4');

    // 移动端标签切换
    await page.getByRole('tab', { name: '详情与说明' }).click();
    await expect(page.getByTestId('formula-detail')).toBeVisible();
    await page.getByRole('tab', { name: '公式库' }).click();
    await expect(page.getByTestId('formula-list')).toBeVisible();

    const overflowAfter = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowAfter).toBeLessThanOrEqual(1);
  });

  test('E09b 390×844 横竖屏切换后模型仍存在', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoStudio(page);
    await waitForCanvas(page);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(800);
    await waitForCanvas(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await waitForCanvas(page);
    expect(await playerCount(page)).toBe(1);
  });

  test('E09c 移动端可以新建公式并回到列表查看', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoStudio(page);
    await waitForCanvas(page);

    await page.getByRole('button', { name: '新建公式' }).click();
    await page.getByTestId('input-title').fill('手机端新建');
    await page.getByTestId('input-alg').fill('R U');
    await page.getByTestId('btn-save-formula').click();

    await page.getByRole('tab', { name: '公式库' }).click();
    const card = page.locator('.formula-card', { hasText: '手机端新建' });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByTestId('formula-detail')).toContainText('手机端新建');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

});