import { expect, test } from '@playwright/test';
import { gotoStudio, waitForCanvas, waitForFormulaReady } from './helpers';

test.describe('公式库 CRUD 与持久化', () => {
  test('E06 新建、编辑、收藏、删除', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await gotoStudio(page);
    await waitForCanvas(page);

    // 新建
    await page.getByTestId('btn-new-formula').click();
    await page.getByTestId('input-title').fill('测试公式 Alpha');
    await page.getByTestId('input-alg').fill("F R U R' U' F'");
    await page.getByTestId('input-tags').fill('测试, 演示');
    await page.getByTestId('input-description').fill('由端到端测试创建，包含中文与撇号 R\'。');
    await page.getByTestId('btn-save-formula').click();

    const card = page.locator('.formula-card', { hasText: '测试公式 Alpha' });
    await expect(card).toBeVisible();
    await expect(page.getByTestId('detail-alg')).toHaveText("F R U R' U' F'");
    await waitForFormulaReady(page, 6);

    // 收藏
    await card.locator('.star').click();
    await page.getByTestId('filter-favorite').click();
    await expect(page.locator('.formula-card', { hasText: '测试公式 Alpha' })).toBeVisible();
    await page.getByTestId('filter-favorite').click();

    // 编辑
    await page.locator('.formula-card', { hasText: '测试公式 Alpha' }).click();
    await page.getByTestId('btn-edit').click();
    await page.getByTestId('input-title').fill('测试公式 Beta');
    await page.getByTestId('btn-save-formula').click();
    await expect(page.locator('.formula-card', { hasText: '测试公式 Beta' })).toBeVisible();

    // 删除（撤销提示条出现）
    await page.getByTestId('btn-delete').click();
    await expect(page.getByTestId('notice')).toContainText('已删除');
    await expect(page.locator('.formula-card', { hasText: '测试公式 Beta' })).toHaveCount(0);
  });

  test('E06b 删除后可以撤销', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await gotoStudio(page);
    await waitForCanvas(page);

    await page.getByTestId('btn-new-formula').click();
    await page.getByTestId('input-title').fill('待撤销公式');
    await page.getByTestId('input-alg').fill('R U');
    await page.getByTestId('btn-save-formula').click();
    await expect(page.locator('.formula-card', { hasText: '待撤销公式' })).toBeVisible();

    await page.getByTestId('btn-delete').click();
    await expect(page.locator('.formula-card', { hasText: '待撤销公式' })).toHaveCount(0);

    await page.getByRole('button', { name: '撤销删除' }).click();
    await expect(page.locator('.formula-card', { hasText: '待撤销公式' })).toBeVisible();
  });

  test('E07 刷新后数据仍在', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);

    await page.getByTestId('btn-new-formula').click();
    await page.getByTestId('input-title').fill('刷新后仍存在');
    await page.getByTestId('input-alg').fill("R2 U2 R2");
    await page.getByTestId('btn-save-formula').click();
    await expect(page.locator('.formula-card', { hasText: '刷新后仍存在' })).toBeVisible();

    await page.reload();
    await expect(page.locator('.formula-card', { hasText: '刷新后仍存在' })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('非法公式会被拒绝保存并给出原因', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);

    await page.getByTestId('btn-new-formula').click();
    await page.getByTestId('input-title').fill('非法公式');
    await page.getByTestId('input-alg').fill('R U ?');
    await page.getByTestId('btn-save-formula').click();
    await expect(page.getByTestId('editor-error')).toBeVisible();
    await expect(page.locator('.formula-card', { hasText: '非法公式' })).toHaveCount(0);
  });

  test('搜索不会跳到其他魔方类型', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);

    await page.getByTestId('puzzle-select').selectOption('2x2x2');
    await expect(page.getByTestId('formula-detail')).toContainText('二阶四步手法', { timeout: 30_000 });

    await page.getByTestId('formula-search').fill('右手');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('puzzle-select')).toHaveValue('2x2x2');
    await expect(page.locator('.formula-card')).toHaveCount(0);
  });
});
