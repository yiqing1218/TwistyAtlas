import type { PuzzleDescriptor, PuzzleStatus } from '../types/puzzle';

/**
 * 能力矩阵来自"真实运行验证"，不是根据名称猜测。
 * 验证方法：docs/API_VERIFICATION.md 记录脚本；docs/CUBING_CAPABILITY_MATRIX.md 记录结果。
 * 只有通过 3D 渲染 + 真实层转 + 公式播放 的魔方才会被标记为 ready-3d。
 */
const STATUS: Record<string, PuzzleStatus> = {
  '2x2x2': 'ready-3d',
  '3x3x3': 'ready-3d',
  '4x4x4': 'ready-3d',
  '5x5x5': 'ready-3d',
  '6x6x6': 'ready-3d',
  '7x7x7': 'ready-3d',
  pyraminx: 'ready-3d',
  skewb: 'ready-3d',
  megaminx: 'ready-3d',
  square1: 'ready-2d',
};

export const PUZZLE_DESCRIPTORS: PuzzleDescriptor[] = [
  {
    id: '3x3x3',
    displayNameZh: '三阶魔方',
    displayNameEn: '3×3×3 Cube',
    family: 'cube',
    status: STATUS['3x3x3'],
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '面转 R L U D F B，逆时针加 \'，180° 加 2；中层 M E S，整体旋转 x y z，宽层 Rw/Uw。',
    camera: { latitude: 30, longitude: 30, distance: 6.4 },
    exampleAlg: "R U R' U'",
    verificationNote: '阶段 A/B 实测：3D 渲染、R/U 轴向量不同、R\' 反向、逐步定位一致。',
  },
  {
    id: '2x2x2',
    displayNameZh: '二阶魔方',
    displayNameEn: '2×2×2 Cube',
    family: 'cube',
    status: STATUS['2x2x2'],
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '主要使用 R U F 三个面转，没有中心块与棱块。',
    camera: { latitude: 30, longitude: 30, distance: 5.2 },
    exampleAlg: "R U R' U'",
    verificationNote: '实测 3D 渲染与 R/U 层转；无中层动作。',
  },
  {
    id: '4x4x4',
    displayNameZh: '四阶魔方',
    displayNameEn: '4×4×4 Cube',
    family: 'cube',
    status: STATUS['4x4x4'],
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '外层 R，宽层 Rw（= 两层），内层 2R 或 2Rw。',
    camera: { latitude: 30, longitude: 30, distance: 7.6 },
    exampleAlg: 'Rw U2',
    verificationNote: '实测宽层 Rw 与内层 2R 均可解析并转动。',
  },
  {
    id: '5x5x5',
    displayNameZh: '五阶魔方',
    displayNameEn: '5×5×5 Cube',
    family: 'cube',
    status: STATUS['5x5x5'],
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '外层 R，宽层 Rw，内层 2R / 3R。',
    camera: { latitude: 30, longitude: 30, distance: 8.8 },
    exampleAlg: 'Rw U2',
    verificationNote: '实测 3D 渲染与宽层转动。',
  },
  {
    id: '6x6x6',
    displayNameZh: '六阶魔方',
    displayNameEn: '6×6×6 Cube',
    family: 'cube',
    status: STATUS['6x6x6'],
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '外层 R，宽层 Rw，多层 3Rw。',
    camera: { latitude: 30, longitude: 30, distance: 10 },
    exampleAlg: 'Rw U2',
    verificationNote: '实测 3D 渲染；高阶性能需注意。',
  },
  {
    id: '7x7x7',
    displayNameZh: '七阶魔方',
    displayNameEn: '7×7×7 Cube',
    family: 'cube',
    status: STATUS['7x7x7'],
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '外层 R，宽层 Rw，多层 3Rw / 3Uw。',
    camera: { latitude: 30, longitude: 30, distance: 11.2 },
    exampleAlg: 'Rw U2',
    verificationNote: '实测 3D 渲染；首次加载块数较多，需要等待。',
  },
  {
    id: 'pyraminx',
    displayNameZh: '金字塔魔方',
    displayNameEn: 'Pyraminx',
    family: 'polyhedron',
    status: STATUS.pyraminx,
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '大写 R L U B 为两层转动，小写 r l u b 为角块，末尾 \' 表示逆时针。',
    camera: { latitude: 26, longitude: 32, distance: 8 },
    exampleAlg: 'R U',
    verificationNote: '实测四面体 3D 模型与 R/U 面转。',
  },
  {
    id: 'skewb',
    displayNameZh: '斜转魔方',
    displayNameEn: 'Skewb',
    family: 'polyhedron',
    status: STATUS.skewb,
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: 'R L U B 为斜向层转，\' 表示逆时针。',
    camera: { latitude: 28, longitude: 30, distance: 7.6 },
    exampleAlg: 'R U',
    verificationNote: '实测斜转层转轴与三阶不同，渲染正确。',
  },
  {
    id: 'megaminx',
    displayNameZh: '五魔方',
    displayNameEn: 'Megaminx',
    family: 'polyhedron',
    status: STATUS.megaminx,
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: true,
    notationHelp: '面转 R U L 等，++ / -- 表示 2/5 圈，如 R++。',
    camera: { latitude: 25, longitude: 30, distance: 10 },
    exampleAlg: 'R++ U',
    verificationNote: '实测十二面体 3D 与 R++ 双格转动。',
  },
  {
    id: 'square1',
    displayNameZh: 'SQ1 扇形魔方',
    displayNameEn: 'Square-1',
    family: 'shape-shifting',
    status: STATUS.square1,
    supportsAnimation: true,
    supportsStepSeek: true,
    supportsCustomSetup: false,
    notationHelp: '记号为 (a,b)/ 形式，例如 (1,0) / (3,0)。括号内为上下层 30° 单位转动，/ 为中层切转。',
    camera: { latitude: 30, longitude: 30, distance: 7.2 },
    exampleAlg: '(1,0) / (3,0)',
    verificationNote:
      '实测：cubing 0.66.1 对 Square-1 的 visualizationStrategy 为 2D，只提供二维渲染，没有真实形变三维模型。因此标记为 ready-2d，并在界面显示"二维渲染"，不冒充三维。',
  },
];

const byId = new Map(PUZZLE_DESCRIPTORS.map((d) => [d.id, d]));

export function getPuzzleDescriptor(id: string): PuzzleDescriptor | undefined {
  return byId.get(id);
}

export function listPuzzles(): PuzzleDescriptor[] {
  return [...PUZZLE_DESCRIPTORS];
}

export const DEFAULT_PUZZLE_ID = '3x3x3';

export function isPuzzle3DReady(id: string): boolean {
  const d = byId.get(id);
  return !!d && d.status === 'ready-3d' && d.supportsAnimation;
}

export function isPuzzlePlayable(id: string): boolean {
  const d = byId.get(id);
  return (
    !!d &&
    (d.status === 'ready-3d' || d.status === 'ready-2d' || d.status === 'experimental') &&
    d.supportsAnimation
  );
}

/** 是否由真实三维几何渲染（不是二维或实验性） */
export function isPuzzle3DRender(id: string): boolean {
  return byId.get(id)?.status === 'ready-3d';
}

export function puzzleDisplayName(id: string): string {
  return byId.get(id)?.displayNameZh ?? id;
}

export const STATUS_LABEL: Record<PuzzleStatus, string> = {
  'ready-3d': '三维可播放',
  'ready-2d': '二维可播放',
  experimental: '实验性支持',
  unavailable: '暂不支持播放',
};
