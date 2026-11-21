/**
 * 打乱生成（WCA 随机状态）。
 *
 * 依赖 `cubing/scramble`：三阶本质是 wasm 随机状态搜索，四阶较慢（约 1s+），
 * 因此统一放在这里做缓存与降级，界面层不需要关心实现。
 */

/** 本项目支持的计时项目 → cubing 事件名 */
const EVENT_BY_PUZZLE: Record<string, string> = {
  '3x3x3': '333',
  '2x2x2': '222',
  '4x4x4': '444',
  '5x5x5': '555',
  pyraminx: 'pyraminx',
  skewb: 'skewb',
  megaminx: 'minx',
};

export function eventForPuzzle(puzzleId: string): string | null {
  return EVENT_BY_PUZZLE[puzzleId] ?? null;
}

const FACES: Record<string, string[]> = {
  '3x3x3': ['R', 'L', 'U', 'D', 'F', 'B'],
  '2x2x2': ['R', 'U', 'F'],
  '4x4x4': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Uw', 'Fw'],
  '5x5x5': ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Uw', 'Fw'],
};

/** 降级：均匀随机走子（不是 WCA 随机状态，但保证可用） */
export function randomMoveScramble(puzzleId: string, length = 20): string {
  const faces = FACES[puzzleId] ?? FACES['3x3x3'];
  const suffixes = ['', "'", '2'];
  const out: string[] = [];
  let last = '';
  while (out.length < length) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    if (face === last) continue;
    last = face;
    out.push(face + suffixes[Math.floor(Math.random() * suffixes.length)]);
  }
  return out.join(' ');
}

let modulePromise: Promise<typeof import('cubing/scramble')> | null = null;

function loadScrambleModule() {
  if (!modulePromise) modulePromise = import('cubing/scramble');
  return modulePromise;
}

/**
 * 生成一条打乱。
 * @param puzzleId 本项目魔方 ID
 * @returns 打乱文本；`source` 标明是随机状态还是降级随机走子
 */
export async function generateScramble(
  puzzleId: string,
): Promise<{ scramble: string; source: 'state' | 'moves' }> {
  const event = eventForPuzzle(puzzleId);
  if (event) {
    try {
      const { randomScrambleForEvent } = await loadScrambleModule();
      const alg = await randomScrambleForEvent(event);
      return { scramble: alg.toString(), source: 'state' };
    } catch {
      /* 落到降级方案 */
    }
  }
  const length = puzzleId === '2x2x2' ? 11 : puzzleId === '3x3x3' ? 20 : 40;
  return { scramble: randomMoveScramble(puzzleId, length), source: 'moves' };
}
