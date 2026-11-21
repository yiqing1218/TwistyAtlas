import type { PuzzleAdapter, PuzzleDescriptor } from '@/domain/model/puzzle';
import { invertFormula, parseFormula } from '@/infrastructure/cubing/algService';
import { applyMoveToPatternJson, solvedPatternJson } from '@/infrastructure/cubing/cubingBridge';
import { getPuzzleDescriptor } from '@/infrastructure/cubing/puzzleRegistry';

/**
 * 普通 N 阶魔方（以及所有"用 KPuzzle 就能完整描述状态"的魔方）的通用适配器。
 *
 * 状态用 KPattern 的 JSON 签名表示，动作是单个记号文本。
 * 状态数学全部委托给 cubing.js 的 KPuzzle，本层只负责协议与合法性检查。
 */
export function createCubeAdapter(puzzleId: string): PuzzleAdapter {
  const descriptor = getPuzzleDescriptor(puzzleId);

  return {
    puzzleId,

    async validateAlgorithm(text: string) {
      const parsed = await parseFormula(text, puzzleId);
      return parsed.ok ? { ok: true } : { ok: false, error: parsed.error };
    },

    async initialState() {
      return solvedPatternJson(puzzleId);
    },

    async applyMove(state: string, move: string) {
      return applyMoveToPatternJson(puzzleId, state, move);
    },

    async isMoveLegal(_state: string, move: string) {
      const parsed = await parseFormula(move, puzzleId);
      return parsed.ok;
    },

    async inverseAlgorithm(text: string) {
      const parsed = await parseFormula(text, puzzleId);
      if (!parsed.ok) throw new Error(parsed.error ?? '公式无效，无法求逆');
      return invertFormula(parsed.canonical);
    },

    capabilities(): PuzzleDescriptor {
      if (!descriptor) throw new Error(`未注册的魔方类型：${puzzleId}`);
      return descriptor;
    },
  };
}
