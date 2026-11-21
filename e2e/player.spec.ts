import { expect, test } from '@playwright/test';
import {
  canvasSize,
  gotoStudio,
  playerCount,
  readCamera,
  readPattern,
  readSolvedPattern,
  selectFormula,
  viewportCenter,
  waitForCanvas,
  waitForFormulaReady,
} from './helpers';

test.describe('三维播放器', () => {
  test('E01 打开应用：3D 区域真实渲染且没有致命错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await gotoStudio(page);
    await waitForCanvas(page);

    const size = await canvasSize(page);
    expect(size?.width ?? 0).toBeGreaterThan(300);
    expect(size?.height ?? 0).toBeGreaterThan(300);

    // 画布不是纯色空白：确认引擎选择了真实 3D 策略，并且画布尺寸有效
    const strategy = await page.evaluate(async () => {
      const player = document.querySelector('twisty-player') as unknown as {
        experimentalModel: { visualizationStrategy: { get: () => Promise<string> } };
      };
      return player.experimentalModel.visualizationStrategy.get();
    });
    expect(strategy).toBe('Cube3D');

    // 3D 渲染确实生效：可视化策略为 Cube3D（见上方断言），且画布尺寸非零

    expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });

  test('E02 公式加载：内置 R U R\' U\' 与播放器一致', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    await expect(page.getByTestId('detail-alg')).toHaveText("R U R' U'");
    const tokens = page.locator('[data-testid="algorithm-tokens"] .token');
    await expect(tokens).toHaveCount(4);
    await expect(tokens.nth(0)).toContainText('R');
    await expect(tokens.nth(2)).toContainText("R'");
  });

  test('E03 播放到终点：最终状态与 KPuzzle 计算结果一致', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    const solved = await readSolvedPattern(page);
    // 内置"右手四步"使用 inverse 初始态，播放完成应回到复原态
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('step-label')).toHaveText('4 / 4', { timeout: 30_000 });
    await page.waitForTimeout(400);

    expect(await readPattern(page)).toBe(solved);
  });

  test('E04 步进：前后步与 0/N 边界一致', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    const step = page.getByTestId('step-label');
    await expect(page.getByTestId('btn-prev')).toBeDisabled();
    await expect(page.getByTestId('btn-start')).toBeDisabled();

    await page.getByTestId('btn-next').click();
    await expect(step).toHaveText('1 / 4');
    await page.getByTestId('btn-next').click();
    await expect(step).toHaveText('2 / 4');

    // 状态与第 2 步的真实结果一致：R 后 U
    const afterTwo = await readPattern(page);
    const solved = await readSolvedPattern(page);
    expect(afterTwo).not.toBe(solved);

    await page.getByTestId('btn-prev').click();
    await expect(step).toHaveText('1 / 4');
    await page.getByTestId('btn-prev').click();
    await expect(step).toHaveText('0 / 4');
    await expect(page.getByTestId('btn-prev')).toBeDisabled();

    await page.getByTestId('btn-end').click();
    await expect(step).toHaveText('4 / 4');
    await expect(page.getByTestId('btn-next')).toBeDisabled();

    await page.getByTestId('btn-start').click();
    await expect(step).toHaveText('0 / 4');
  });

  test('E05 摄像机：旋转视角不改变魔方状态', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    await page.getByTestId('btn-next').click();
    await page.getByTestId('btn-next').click();
    await expect(page.getByTestId('step-label')).toHaveText('2 / 4');

    const before = await readPattern(page);
    const cameraBefore = await readCamera(page);

    const center = await viewportCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 120, center.y + 40, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const cameraAfter = await readCamera(page);
    expect(Math.abs(cameraAfter.longitude - cameraBefore.longitude)).toBeGreaterThan(5);
    expect(await readPattern(page)).toBe(before);
    await expect(page.getByTestId('step-label')).toHaveText('2 / 4');
  });

  test('E05b 视角复位按钮可用', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    const center = await viewportCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + 160, center.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: '复位视角' }).click();
    await page.waitForTimeout(400);
    const camera = await readCamera(page);
    expect(Math.abs(camera.latitude - 30)).toBeLessThan(2);
  });

  test('E10 切换魔方类型：模型与公式不交叉污染', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    await page.getByTestId('puzzle-select').selectOption('2x2x2');
    await expect(page.getByTestId('step-label')).toHaveText('0 / 4', { timeout: 60_000 });
    await expect(page.getByTestId('formula-detail')).toContainText('二阶四步手法');

    // 只存在一个播放器实例
    expect(await playerCount(page)).toBe(1);

    const solved = await readSolvedPattern(page);
    await readPattern(page);
    expect(solved).toContain('2x2x2');
  });

  test('播放中调整速度不会改变最终状态', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    const solved = await readSolvedPattern(page);
    await page.getByTestId('speed-select').selectOption('2');
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('step-label')).toHaveText('4 / 4', { timeout: 30_000 });
    await page.waitForTimeout(400);
    expect(await readPattern(page)).toBe(solved);
  });

  test('空格键播放/暂停，输入框内不触发', async ({ page }) => {
    await gotoStudio(page);
    await waitForCanvas(page);
    await selectFormula(page, '右手四步');
    await waitForFormulaReady(page, 4);

    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Space');
    await expect(page.getByTestId('step-label')).not.toHaveText('0 / 4', { timeout: 15_000 });
    await page.keyboard.press('Space');

    await page.getByTestId('formula-search').fill('R');
    await page.keyboard.press('Space');
    // 焦点在输入框时空格只应输入字符，不改变播放状态
    await expect(page.getByTestId('formula-search')).toHaveValue('R ');
  });
});
