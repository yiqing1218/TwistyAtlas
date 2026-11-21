/**
 * cubing.js 的唯一出入口。
 *
 * 任务书要求：所有对 `cubing/*` 的引用必须集中在一个模块，方便以后替换引擎。
 * 本项目中除本文件与 `types` 以外，不要在其它业务代码里 import 'cubing/*'。
 */
import { Alg, Move, Pause, type AlgLeaf } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import type { TwistyPlayerConfig } from 'cubing/twisty';
import type { KPuzzle, KPattern as KPatternType } from 'cubing/kpuzzle';
import { KPattern } from 'cubing/kpuzzle';

export type { AlgLeaf };
export { Alg, KPattern, Move, Pause };
export type { KPuzzle, TwistyPlayerConfig, KPatternType };

/** TwistyPlayer 实例类型（用 import type 引用，不产生运行时依赖） */
export type TwistyPlayerInstance = import('cubing/twisty').TwistyPlayer;

type TwistyModule = typeof import('cubing/twisty');
let twistyModulePromise: Promise<TwistyModule> | null = null;

/**
 * 三维渲染模块体积较大，按需动态加载：
 * 既减小首屏体积，也让不涉及 3D 的单元测试不必加载 WebGL 相关代码。
 */
export function loadTwistyModule(): Promise<TwistyModule> {
  if (!twistyModulePromise) twistyModulePromise = import('cubing/twisty');
  return twistyModulePromise;
}

/** 创建 TwistyPlayer。所有配置项集中在这里，便于对照实际安装版本核查。 */
export async function createTwistyPlayer(config: TwistyPlayerConfig): Promise<TwistyPlayerInstance> {
  const { TwistyPlayer } = await loadTwistyModule();
  return new TwistyPlayer(config);
}

const kpuzzleCache = new Map<string, Promise<KPuzzle>>();

export function getPuzzleIds(): string[] {
  return Object.keys(puzzles);
}

export function hasPuzzle(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(puzzles, id);
}

/** 载入并缓存某个魔方的 KPuzzle（真实状态模型）。 */
export function getKPuzzle(puzzleId: string): Promise<KPuzzle> {
  const cached = kpuzzleCache.get(puzzleId);
  if (cached) return cached;
  const loader = puzzles[puzzleId as keyof typeof puzzles];
  if (!loader) {
    return Promise.reject(new Error(`未知的魔方类型：${puzzleId}`));
  }
  const promise = loader.kpuzzle();
  kpuzzleCache.set(puzzleId, promise);
  return promise;
}

export interface AlgValidationResult {
  ok: boolean;
  /** 规范化后的算法文本 */
  normalized: string;
  /** 面向用户的中文错误说明 */
  error?: string;
  /** 出问题的原始 token（若可定位） */
  offendingMove?: string;
}

const ANIMATED_LEAF_MARK = Symbol('animatedLeaf');

/** 展开后的真实动作叶子（Move），已处理括号重复 / 交换子 / 共轭。 */
export function expandAlgLeaves(text: string): AlgLeaf[] {
  const alg = new Alg(text);
  const leaves: AlgLeaf[] = [];
  for (const node of alg.experimentalExpand()) {
    leaves.push(node);
  }
  return leaves;
}

export function animatedLeaves(text: string): Move[] {
  const moves: Move[] = [];
  for (const leaf of expandAlgLeaves(text)) {
    if (leaf instanceof Move) {
      moves.push(leaf as Move);
    }
    // Pause / Newline 不改变状态，不计入步骤。
  }
  return moves;
}

export function countAnimatedLeaves(text: string): number {
  return animatedLeaves(text).length;
}

export function invertAlgText(text: string): string {
  return new Alg(text).invert().toString();
}

export function formatAlg(text: string): string {
  return new Alg(text).toString();
}

/**
 * 用 KPuzzle 校验算法：既能发现语法错误，也能发现"当前魔方不支持该动作"。
 * 不做任何正则拆分，全部交给 cubing.js 的正式解析器。
 */
export async function validateAlgForPuzzle(
  puzzleId: string,
  text: string,
): Promise<AlgValidationResult> {
  const normalized = text.trim();
  if (!normalized) {
    return { ok: false, normalized, error: '公式为空' };
  }
  let kpuzzle: KPuzzle;
  try {
    kpuzzle = await getKPuzzle(puzzleId);
  } catch (err) {
    return { ok: false, normalized, error: (err as Error).message };
  }

  let leaves: AlgLeaf[];
  try {
    leaves = expandAlgLeaves(normalized);
  } catch (err) {
    return { ok: false, normalized, error: parseErrorMessage(err, normalized) };
  }

  try {
    kpuzzle.algToTransformation(new Alg(normalized));
    return { ok: true, normalized };
  } catch {
    // 语法能解析，但状态模型拒绝：定位具体不合法的动作。
    for (const leaf of leaves) {
      if (!(leaf instanceof Move)) continue;
      try {
        kpuzzle.algToTransformation(new Alg(leaf.toString()));
      } catch {
        return {
          ok: false,
          normalized,
          offendingMove: leaf.toString(),
          error: `本魔方（${puzzleId}）不支持动作 ${leaf.toString()}`,
        };
      }
    }
    return {
      ok: false,
      normalized,
      error: `公式无法在 ${puzzleId} 上执行，请检查记号是否属于该魔方`,
    };
  }
}

function parseErrorMessage(err: unknown, text: string): string {
  const message = err instanceof Error ? err.message : String(err);
  const idxMatch = /index (\d+)/.exec(message);
  if (idxMatch) {
    const idx = Number(idxMatch[1]);
    const near = text.slice(Math.max(0, idx - 6), Math.min(text.length, idx + 8));
    return `公式第 ${idx + 1} 个字符附近无法解析（"${near}"），请检查记号写法`;
  }
  return `公式解析失败：${message}`;
}

export interface PatternSignature {
  puzzleId: string;
  json: string;
}

/**
 * 用真实状态模型计算执行 alg（可带 setup）后的状态签名。
 * 用于单元测试与端到端测试的真值比对，而不是截图。
 */
export async function patternSignature(
  puzzleId: string,
  algText: string,
  setupAlgText = '',
): Promise<PatternSignature> {
  const kpuzzle = await getKPuzzle(puzzleId);
  let pattern = kpuzzle.defaultPattern();
  if (setupAlgText.trim()) {
    pattern = pattern.applyTransformation(kpuzzle.algToTransformation(new Alg(setupAlgText)));
  }
  pattern = pattern.applyTransformation(kpuzzle.algToTransformation(new Alg(algText)));
  return { puzzleId, json: JSON.stringify(pattern) };
}

export async function isAlgIdentity(puzzleId: string, algText: string): Promise<boolean> {
  const kpuzzle = await getKPuzzle(puzzleId);
  return kpuzzle.algToTransformation(new Alg(algText)).isIdentityTransformation();
}

/** 复原态的状态签名（JSON 字符串） */
export async function solvedPatternJson(puzzleId: string): Promise<string> {
  const kpuzzle = await getKPuzzle(puzzleId);
  return JSON.stringify(kpuzzle.defaultPattern());
}

/** 对状态签名应用一个动作，返回新的状态签名 */
export async function applyMoveToPatternJson(
  puzzleId: string,
  patternJson: string,
  moveText: string,
): Promise<string> {
  const kpuzzle = await getKPuzzle(puzzleId);
  const parsed = JSON.parse(patternJson) as { patternData: Record<string, unknown> };
  const pattern = new KPattern(kpuzzle, parsed.patternData as never);
  return JSON.stringify(pattern.applyMove(moveText));
}


/**
 * 逐步计算的中间状态签名，index k 表示"前 k 个动作执行完"。
 * 这是播放器步骤定位真值的来源。
 */
export async function patternAtStep(
  puzzleId: string,
  algText: string,
  step: number,
  setupAlgText = '',
): Promise<string> {
  const kpuzzle = await getKPuzzle(puzzleId);
  const moves = animatedLeaves(algText);
  const prefix = moves.slice(0, Math.max(0, Math.min(step, moves.length)));
  let pattern = kpuzzle.defaultPattern();
  if (setupAlgText.trim()) {
    pattern = pattern.applyTransformation(kpuzzle.algToTransformation(new Alg(setupAlgText)));
  }
  for (const move of prefix) {
    pattern = pattern.applyMove(move);
  }
  return JSON.stringify(pattern);
}

export function leavesToText(leaves: AlgLeaf[]): string {
  return leaves.map((leaf) => leaf.toString()).join(' ');
}

export const ANIMATED_LEAF = ANIMATED_LEAF_MARK;
