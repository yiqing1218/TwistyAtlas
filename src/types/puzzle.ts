export type PuzzleStatus = 'ready-3d' | 'ready-2d' | 'experimental' | 'unavailable';

export type PuzzleFamily = 'cube' | 'polyhedron' | 'shape-shifting' | 'other';

export interface CameraDefault {
  latitude: number;
  longitude: number;
  distance: number;
}

export interface PuzzleDescriptor {
  /** cubing.js 中使用的 puzzle ID */
  id: string;
  displayNameZh: string;
  displayNameEn: string;
  family: PuzzleFamily;
  status: PuzzleStatus;
  supportsAnimation: boolean;
  supportsStepSeek: boolean;
  supportsCustomSetup: boolean;
  notationHelp: string;
  camera: CameraDefault;
  /** 记号示例，用于帮助与自检 */
  exampleAlg: string;
  /** 标记该魔方 capability 的验证来源（docs/CUBING_CAPABILITY_MATRIX.md 章节） */
  verificationNote: string;
}

/**
 * 本项目的抽象接口（不是 cubing.js 官方 API）。业务层只依赖这些接口，
 * 具体实现可在以后替换引擎而不影响公式库与 UI。
 */
export interface PuzzleAdapter<State = string, Move = string> {
  readonly puzzleId: string;
  validateAlgorithm(text: string): Promise<{ ok: boolean; error?: string }>;
  initialState(): Promise<State>;
  applyMove(state: State, move: Move): Promise<State>;
  isMoveLegal(state: State, move: Move): Promise<boolean>;
  inverseAlgorithm(text: string): Promise<string>;
  capabilities(): PuzzleDescriptor;
}

export interface PlayerBridge {
  load(puzzleId: string, alg: string, setupAlg: string): Promise<void>;
  play(): void;
  pause(): void;
  seekToStep(step: number): Promise<void>;
  setSpeed(speed: number): void;
  resetCamera(): void;
  dispose(): void;
}
