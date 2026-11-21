import { expect, type Page } from '@playwright/test';

export const SAMPLE_ALG = "R U R' U'";

export async function gotoStudio(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('puzzle-canvas')).toBeVisible();
}

/** 主动选中一条公式（默认选中的可能是任意一条，测试不应依赖顺序） */
export async function selectFormula(page: Page, title: string) {
  const card = page.locator('.formula-card', { hasText: title }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId('formula-detail')).toContainText(title);
}

export async function waitForFormulaReady(page: Page, expectedSteps: number) {
  await expect(page.getByTestId('step-label')).toHaveText(new RegExp(`^0 / ${expectedSteps}$`), {
    timeout: 60_000,
  });
}

/**
 * TwistyPlayer 使用 closed shadow DOM，且 `shadow` 是公开字段。
 * 这里递归遍历 shadow 树，确认真的存在有尺寸的 WebGL canvas。
 */
async function findCanvasSize(page: Page): Promise<{ width: number; height: number } | null> {
  return page.evaluate(() => {
    const root = document.querySelector('twisty-player') as unknown as {
      shadow?: ShadowRoot | DocumentFragment;
    };
    if (!root) return null;
    const queue: Array<ShadowRoot | DocumentFragment | Element> = [root.shadow ?? document];
    const seen = new Set<unknown>();
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (seen.has(node)) continue;
      seen.add(node);
      const element = node as Element;
      if (element.tagName === 'CANVAS') {
        const canvas = element as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) {
          return { width: Math.round(rect.width), height: Math.round(rect.height) };
        }
      }
      const shadow = (element as unknown as { shadow?: ShadowRoot }).shadow;
      if (shadow) queue.push(shadow);
      for (const child of element.children ?? []) queue.push(child as Element);
    }
    return null;
  });
}

export async function waitForCanvas(page: Page) {
  await expect
    .poll(async () => findCanvasSize(page), { timeout: 60_000, intervals: [200, 400, 800] })
    .not.toBeNull();
}

export async function canvasSize(page: Page) {
  return findCanvasSize(page);
}

/** 读取真实魔方状态（KPuzzle 的 JSON 签名），用于状态级断言而不是截图 */
export async function readPattern(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const player = document.querySelector('twisty-player') as unknown as {
      experimentalModel: { currentPattern: { get: () => Promise<unknown> } };
    };
    if (!player) throw new Error('找不到 twisty-player');
    const pattern = await player.experimentalModel.currentPattern.get();
    return JSON.stringify(pattern);
  });
}

export async function readSolvedPattern(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const player = document.querySelector('twisty-player') as unknown as {
      experimentalModel: { kpuzzle: { get: () => Promise<{ defaultPattern: () => unknown }> } };
    };
    if (!player) throw new Error('找不到 twisty-player');
    const kpuzzle = await player.experimentalModel.kpuzzle.get();
    return JSON.stringify(kpuzzle.defaultPattern());
  });
}

export async function readCamera(
  page: Page,
): Promise<{ latitude: number; longitude: number; distance: number }> {
  return page.evaluate(async () => {
    const player = document.querySelector('twisty-player') as unknown as {
      experimentalModel: {
        twistySceneModel: {
          orbitCoordinates: {
            get: () => Promise<{ latitude: number; longitude: number; distance: number }>;
          };
        };
      };
    };
    if (!player) throw new Error('找不到 twisty-player');
    return player.experimentalModel.twistySceneModel.orbitCoordinates.get();
  });
}

/** 用于点击/拖拽 3D 区域的中心坐标 */
export async function viewportCenter(page: Page) {
  const box = await page.getByTestId('puzzle-canvas').boundingBox();
  if (!box) throw new Error('找不到三维视口');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

export async function playerCount(page: Page): Promise<number> {
  return page.locator('twisty-player').count();
}
