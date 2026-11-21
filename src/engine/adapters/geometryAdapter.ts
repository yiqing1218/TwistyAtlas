import type { CameraDefault, PuzzleAdapter } from '../../types/puzzle';
import { getPuzzleDescriptor } from '../puzzleRegistry';
import { createCubeAdapter } from './cubeNxNAdapter';

/**
 * 多面体 / 异形魔方的公共协议。
 *
 * 目前 Pyraminx、Skewb、Megaminx 的状态都能被 cubing.js 的 KPuzzle 完整描述，
 * 因此状态数学复用同一个实现，只是额外提供几何相关的辅助信息（默认相机、记号提示）。
 * 若将来出现 KPuzzle 无法描述的魔方（如需要真实形变的 Square-1 变体），
 * 应在这里新增独立的几何适配器，而不是伪造实现。
 */
export interface GeometryAdapter extends PuzzleAdapter {
  defaultCamera(): CameraDefault;
  notationHelp(): string;
}

export function createGeometryAdapter(puzzleId: string): GeometryAdapter {
  const base = createCubeAdapter(puzzleId);
  const descriptor = getPuzzleDescriptor(puzzleId);

  return {
    ...base,
    defaultCamera(): CameraDefault {
      return descriptor?.camera ?? { latitude: 30, longitude: 30, distance: 5 };
    },
    notationHelp(): string {
      return descriptor?.notationHelp ?? '';
    },
  };
}
