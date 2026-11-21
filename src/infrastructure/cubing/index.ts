import type { PuzzleAdapter } from '@/domain/model/puzzle';
import { getPuzzleDescriptor, isPuzzlePlayable } from '@/infrastructure/cubing/puzzleRegistry';
import { createCubeAdapter } from '@/infrastructure/cubing/adapters/cubeNxNAdapter';
import { createGeometryAdapter, type GeometryAdapter } from '@/infrastructure/cubing/adapters/geometryAdapter';

const adapterCache = new Map<string, PuzzleAdapter>();

/**
 * 按魔方类型取得适配器。业务层只依赖 PuzzleAdapter 协议，
 * 不直接引用任何 TwistyPlayer 细节。
 */
export function getPuzzleAdapter(puzzleId: string): PuzzleAdapter {
  const cached = adapterCache.get(puzzleId);
  if (cached) return cached;
  const descriptor = getPuzzleDescriptor(puzzleId);
  if (!descriptor) throw new Error(`未注册的魔方类型：${puzzleId}`);
  const adapter =
    descriptor.family === 'cube' ? createCubeAdapter(puzzleId) : createGeometryAdapter(puzzleId);
  adapterCache.set(puzzleId, adapter);
  return adapter;
}

export function getGeometryAdapter(puzzleId: string): GeometryAdapter {
  return createGeometryAdapter(puzzleId);
}

export { isPuzzlePlayable };
export * from '@/infrastructure/cubing/algService';
export * from '@/infrastructure/cubing/puzzleRegistry';
export * from '@/infrastructure/cubing/setupResolver';
export * from '@/infrastructure/cubing/playbackController';
export {
  animatedLeaves,
  countAnimatedLeaves,
  expandAlgLeaves,
  getKPuzzle,
  getPuzzleIds,
  invertAlgText,
  isAlgIdentity,
  patternAtStep,
  patternSignature,
  solvedPatternJson,
  validateAlgForPuzzle,
} from '@/infrastructure/cubing/cubingBridge';
