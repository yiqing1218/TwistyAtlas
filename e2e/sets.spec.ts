import { expect, test } from '@playwright/test';

test.describe('内置公式集', () => {
  test('公式集列表与案例可加载到真实播放器', async ({ page }) => {
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible();

    // 37 套内置公式集：CFOP 主线 + 进阶体系 + 二阶 + 高阶 + 异形
    await expect(page.locator('.set-pill')).toHaveCount(37);
    const meta = (await page.locator('.sets-header__meta').textContent()) ?? '';
    expect(meta).toMatch(/个案例/);

    // 首屏默认选中 OLL 第一条，播放器必须给出真实步数
    await expect(page.getByTestId('step-label')).toHaveText(/^0 \/ \d+$/, { timeout: 60_000 });

    // 切到 ZBLL 家族，确认大集合也能加载
    await page.getByTestId('set-pill-zbll').click();
    await expect(page.locator('.case-item').first()).toBeVisible();
    await page.locator('.case-item').first().click();
    await expect(page.getByTestId('step-label')).toHaveText(/^0 \/ \d+$/, { timeout: 60_000 });

    // 来源归属必须展示
    await expect(page.locator('.case-detail__source')).toContainText('来源');
  });

  test('搜索可以过滤案例', async ({ page }) => {
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible();
    await page.getByLabel('搜索案例').fill('OLL 21');
    await expect(page.locator('.case-item')).toHaveCount(1);
  });

  test('新增的进阶与异形集合都能加载到真实播放器', async ({ page }) => {
    await page.goto('/#/sets');
    await expect(page.getByTestId('sets-page')).toBeVisible();

    for (const setId of ['vls', 'pyra-l4e', 'sq1-ep']) {
      await page.getByTestId(`set-pill-${setId}`).click();
      await expect(page.locator('.case-item').first()).toBeVisible();
      await page.locator('.case-item').first().click();
      // 真实步数出现，说明公式被引擎解析并生成了动画时间轴
      await expect(page.getByTestId('step-label')).toHaveText(/^0 \/ \d+$/, { timeout: 60_000 });
    }
  });
});
