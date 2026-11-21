/**
 * 构建期使用的引擎封装（数据流水线专用）。
 *
 * 说明：应用运行时唯一入口是 `src/engine/cubingBridge.ts`；
 * 构建脚本在 Node 下无法 import TS，因此这里保留一个**仅构建期使用**的薄封装，
 * `scripts/check-arch.mjs` 会保证 src 内不出现对 cubing 的直接引用。
 */
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';

const cache = new Map();

export function kpuzzleOf(puzzleId) {
  if (!cache.has(puzzleId)) {
    const loader = puzzles[puzzleId];
    if (!loader) throw new Error(`未知魔方：${puzzleId}`);
    cache.set(puzzleId, loader.kpuzzle());
  }
  return cache.get(puzzleId);
}

/** 解析并校验公式，抛错则说明该魔方不支持 */
export async function transform(puzzleId, algText) {
  const kp = await kpuzzleOf(puzzleId);
  return kp.algToTransformation(new Alg(algText));
}

export async function solvedPatternJson(puzzleId) {
  const kp = await kpuzzleOf(puzzleId);
  return kp.defaultPattern();
}

/**
 * 推导每个轨道里"U 层"包含的下标集合。
 * 做法：对复原态执行一次 U，位置发生变化的块即为 U 层块。
 * 不依赖任何硬编码的块编号约定。
 */
export async function uLayerIndexSets(puzzleId) {
  const kp = await kpuzzleOf(puzzleId);
  const solved = kp.defaultPattern();
  const afterU = solved.applyMove('U');
  const sets = {};
  for (const [orbitName, data] of Object.entries(solved.patternData)) {
    const moved = [];
    for (let i = 0; i < data.pieces.length; i += 1) {
      if (data.pieces[i] !== afterU.patternData[orbitName].pieces[i]) moved.push(i);
    }
    sets[orbitName] = moved;
  }
  return sets;
}

/**
 * 把公式里的"整体旋转"从判定中消掉，得到一条等价的、朝向归零的公式。
 *
 * 为什么需要：KPuzzle 里 `x / y / z` 是**整体旋转**，会把每个块搬到别的槽位，
 * 于是"前两层是否还原"的判定会把 A-perm / E-perm 这类带旋转写法的公式误杀。
 * 但整体旋转只是换观察坐标系：先执行公式 A、再执行旋转序列的逆 R⁻¹，
 * 就回到原来的坐标系，剩下的只有"真正的块置换"（A' = A·R⁻¹，R 为 A 的净旋转）。
 * 对 A' 做块级判定，等价于"忽略观察方向后，这条公式是否只动了顶层"。
 *
 * 净旋转的求法：按出现顺序取出所有旋转记号并串联。面转不改变整体朝向，
 * 因此这个串联序列从复原态执行的结果，就是原公式的净旋转。
 */
export function residualAlgText(algText) {
  const rotTokens = algText
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /^[xyz](?:'|2)?$/.test(t));
  if (rotTokens.length === 0) return algText;
  const inverseRotations = new Alg(rotTokens.join(' ')).invert().toString();
  return `${algText} ${inverseRotations}`;
}

/**
 * 对某个状态做块级判定。
 *
 * 只考察 CORNERS / EDGES：`M` `E` `S` 这类中层转会置换中心块，
 * 但中心块置换在实物上不可见（标准配色下无法察觉），
 * 若把它算进"前两层还原"会导致大量正确的公式被误判。
 */
export function analyzePattern(pattern, uSets) {
  const result = {
    f2lSolved: true,
    llOriented: true,
    llCornersOriented: true,
    llEdgesOriented: true,
    llEdgesIdentity: true,
  };
  for (const [orbitName, data] of Object.entries(pattern.patternData)) {
    if (orbitName === 'CENTERS') continue;
    const uIdx = new Set(uSets[orbitName] ?? []);
    for (let i = 0; i < data.pieces.length; i += 1) {
      const home = data.pieces[i] === i && data.orientation[i] === 0;
      if (uIdx.has(i)) {
        if (data.orientation[i] !== 0) {
          result.llOriented = false;
          if (orbitName === 'CORNERS') result.llCornersOriented = false;
          if (orbitName === 'EDGES') result.llEdgesOriented = false;
        }
        if (orbitName === 'EDGES' && data.pieces[i] !== i) result.llEdgesIdentity = false;
      } else if (!home) {
        result.f2lSolved = false;
      }
    }
  }
  return result;
}

/** 由公式推导"该公式所解的情况"：对复原态施加逆公式 */
export async function casePatternOf(puzzleId, algText) {
  const kp = await kpuzzleOf(puzzleId);
  const inverse = new Alg(algText).invert();
  return kp.defaultPattern().applyTransformation(kp.algToTransformation(inverse));
}
