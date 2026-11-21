import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { gotoStudio, waitForCanvas } from './helpers';

test.describe('导入导出与安全', () => {
  test('E08 导出 JSON → 删除 → 导入后恢复', async ({ page }, testInfo) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await gotoStudio(page);
    await waitForCanvas(page);

    await page.getByTestId('btn-new-formula').click();
    await page.getByTestId('input-title').fill('备份往返公式');
    await page.getByTestId('input-alg').fill("R U R' U'");
    await page.getByTestId('input-tags').fill('备份');
    await page.getByTestId('input-description').fill('中文说明，含逗号, 与换行\n第二行');
    await page.getByTestId('btn-save-formula').click();
    await expect(page.locator('.formula-card', { hasText: '备份往返公式' })).toBeVisible();

    // 导出
    await page.getByRole('button', { name: '导入 / 导出' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-json').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^twisty-atlas-backup-\d{4}-\d{2}-\d{2}\.json$/);
    // download.path() 返回的是无扩展名的临时文件，导入端按扩展名判断类型，
    // 因此用 saveAs 保存成真实文件名再回灌。
    const backupPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(backupPath);
    await page.locator('.dialog__footer').getByRole('button', { name: '关闭' }).click();

    // 删除该公式
    await page.locator('.formula-card', { hasText: '备份往返公式' }).click();
    await page.getByTestId('btn-delete').click();
    await expect(page.locator('.formula-card', { hasText: '备份往返公式' })).toHaveCount(0);

    // 导入
    await page.getByRole('button', { name: '导入 / 导出' }).click();
    await page.getByRole('button', { name: '导入数据' }).click();
    await page.getByTestId('import-file').setInputFiles(backupPath);
    await expect(page.getByText(/新增 \d+/)).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('confirm-import').click();
    await expect(page.getByTestId('import-success')).toContainText('导入完成');

    await page.locator('.dialog__footer').getByRole('button', { name: '关闭' }).click();
    await expect(page.locator('.formula-card', { hasText: '备份往返公式' })).toBeVisible();
    await page.locator('.formula-card', { hasText: '备份往返公式' }).click();
    await expect(page.getByTestId('formula-detail')).toContainText('中文说明，含逗号, 与换行');
  });

  test('E11 恶意 HTML 作为纯文本导入，不会执行脚本', async ({ page }, testInfo) => {
    const payload = {
      format: 'twisty-atlas-backup',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      formulas: [
        {
          id: 'xss-check-1',
          schemaVersion: 1,
          puzzleId: '3x3x3',
          title: '<img src=x onerror="window.__xss=1">',
          alg: 'R U',
          setupMode: 'solved',
          setupAlg: '',
          categoryId: '',
          tags: ['安全'],
          description: '<script>window.__xss=1</script>',
          favorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      categories: [],
    };
    const file = testInfo.outputPath('xss.json');
    writeFileSync(file, JSON.stringify(payload), 'utf-8');

    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await gotoStudio(page);
    await waitForCanvas(page);
    await page.getByRole('button', { name: '导入 / 导出' }).click();
    await page.getByRole('button', { name: '导入数据' }).click();
    await page.getByTestId('import-file').setInputFiles(file);
    await expect(page.getByTestId('confirm-import')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('confirm-import').click();
    await expect(page.getByTestId('import-success')).toBeVisible({ timeout: 30_000 });
    await page.locator('.dialog__footer').getByRole('button', { name: '关闭' }).click();

    await expect(page.locator('.formula-card', { hasText: '<img src=x' })).toBeVisible();
    expect(dialogs).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__xss)).toBeUndefined();
  });

  test('CSV 导入：中文与撇号不变形', async ({ page }, testInfo) => {
    const csv =
      '\ufeffpuzzleId,title,alg,setupMode,setupAlg,category,tags,description,sourceUrl\r\n' +
      '3x3x3,"CSV 中文 R\'","R U R\' U\'",solved,,"基础","[""导入"",""测试""]","含逗号的说明, 第二句",\r\n';
    const file = testInfo.outputPath('import.csv');
    writeFileSync(file, csv, 'utf-8');

    await gotoStudio(page);
    await waitForCanvas(page);
    await page.getByRole('button', { name: '导入 / 导出' }).click();
    await page.getByRole('button', { name: '导入数据' }).click();
    await page.getByTestId('import-file').setInputFiles(file);
    await expect(page.getByTestId('confirm-import')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('confirm-import').click();
    await expect(page.getByTestId('import-success')).toBeVisible({ timeout: 30_000 });
    await page.locator('.dialog__footer').getByRole('button', { name: '关闭' }).click();

    const card = page.locator('.formula-card', { hasText: "CSV 中文 R'" });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByTestId('detail-alg')).toHaveText("R U R' U'");
    await expect(page.getByTestId('formula-detail')).toContainText('含逗号的说明, 第二句');
  });
});
