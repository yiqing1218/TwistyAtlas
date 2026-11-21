import type { PuzzleAdapter } from '../types/puzzle';
import { getPuzzleDescriptor, isPuzzlePlayable } from './puzzleRegistry';
import { createCubeAdapter } from './adapters/cubeNxNAdapter';
import { createGeometryAdapter, type GeometryAdapter } from './adapters/geometryAdapter';

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
export * from './algService';
export * from './puzzleRegistry';
export * from './setupResolver';
export * from './playbackController';
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
} from './cubingBridge';
