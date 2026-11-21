import {
  Alg,
  animatedLeaves,
  formatAlg,
  invertAlgText,
  validateAlgForPuzzle,
  type AlgValidationResult,
} from './cubingBridge';

/** 输入上限：防止超长文本拖垮解析与渲染 */
export const MAX_ALG_CHARS = 10_000;
/** 展开动作数量上限 */
export const MAX_EXPANDED_MOVES = 500;

export interface AlgToken {
  /** 动作序号（0 起始），与播放器步骤一一对应 */
  index: number;
  /** 规范化后的动作文本，如 R' / U2 / Rw */
  text: string;
  /** 该动作所转动的层与角度，用于无障碍描述 */
  readable: string;
}

export interface ParsedFormula {
  ok: boolean;
  /** 用户输入的原文（已做字符规范化） */
  normalized: string;
  /** cubing.js 规范化后的完整公式文本 */
  canonical: string;
  tokens: AlgToken[];
  error?: string;
  /** 非致命提示，例如超过动作上限 */
  warning?: string;
}

/**
 * 字符规范化：把常见的 Unicode 弯撇、全角空格等转换为 cubing.js 可接受的写法。
 * 只做"字符层面"的等价替换，不改变任何数字或转动含义。
 */
export function normalizeAlgText(raw: string): string {
  return raw
    .replace(/[\u2018\u2019\u02BC\u2032\u00B4\uFF07]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0|\u3000/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

const MOVE_READABLE: Record<string, string> = {
  R: '右层',
  L: '左层',
  U: '顶层',
  D: '底层',
  F: '前层',
  B: '后层',
  M: '中层(M)',
  E: '赤道层(E)',
  S: '站立层(S)',
  x: '整体绕R轴',
  y: '整体绕U轴',
  z: '整体绕F轴',
};

function describeMove(text: string): string {
  const base = text.replace(/['2]/g, '');
  const face = MOVE_READABLE[base] ?? base;
  const wide = /w$/.test(base) ? '宽层' : '';
  const suffix = text.endsWith("'") ? '逆时针' : text.endsWith('2') ? '180°' : '顺时针';
  return `${face}${wide} ${suffix}`.trim();
}

/** 从动作序列生成步骤 token（不做正则拆分，来自解析后的真实动作） */
export function tokensFromText(algText: string): AlgToken[] {
  return animatedLeaves(algText).map((move, index) => ({
    index,
    text: move.toString(),
    readable: describeMove(move.toString()),
  }));
}

export interface ParseOptions {
  maxExpandedMoves?: number;
}

/**
 * 本地解析（不需要指定魔方）：语法是否合法、展开后有多少动作。
 * 魔方相关校验见 parseFormula，它还会调用 KPuzzle。
 */
export function parseFormulaLocal(raw: string, options: ParseOptions = {}): ParsedFormula {
  const maxMoves = options.maxExpandedMoves ?? MAX_EXPANDED_MOVES;
  const normalized = normalizeAlgText(raw);
  if (!normalized) {
    return { ok: false, normalized, canonical: '', tokens: [], error: '公式不能为空' };
  }
  if (normalized.length > MAX_ALG_CHARS) {
    return {
      ok: false,
      normalized,
      canonical: '',
      tokens: [],
      error: `公式过长（${normalized.length} 字符），上限为 ${MAX_ALG_CHARS} 字符`,
    };
  }

  let canonical: string;
  try {
    canonical = formatAlg(normalized);
  } catch (err) {
    return {
      ok: false,
      normalized,
      canonical: '',
      tokens: [],
      error: `公式无法解析：${(err as Error).message}`,
    };
  }

  let tokens: AlgToken[];
  try {
    tokens = tokensFromText(normalized);
  } catch (err) {
    return {
      ok: false,
      normalized,
      canonical,
      tokens: [],
      error: `公式无法展开：${(err as Error).message}`,
    };
  }

  if (tokens.length === 0) {
    return { ok: false, normalized, canonical, tokens, error: '公式中没有可执行的转动动作' };
  }
  if (tokens.length > maxMoves) {
    return {
      ok: false,
      normalized,
      canonical,
      tokens,
      error: `展开后共 ${tokens.length} 个动作，超过上限 ${maxMoves}，请拆分公式`,
    };
  }

  return { ok: true, normalized, canonical, tokens };
}

export interface ParsedFormulaForPuzzle extends ParsedFormula {
  puzzleId: string;
}

/** 完整解析：先做本地语法/上限检查，再用该魔方的状态模型确认每个动作真实存在。 */
export async function parseFormula(raw: string, puzzleId: string): Promise<ParsedFormulaForPuzzle> {
  const local = parseFormulaLocal(raw);
  if (!local.ok) {
    return { ...local, puzzleId };
  }
  const validation: AlgValidationResult = await validateAlgForPuzzle(puzzleId, local.normalized);
  if (!validation.ok) {
    return { ...local, ok: false, puzzleId, error: validation.error };
  }
  return { ...local, puzzleId };
}

export function invertFormula(raw: string): string {
  const normalized = normalizeAlgText(raw);
  if (!normalized) return '';
  return invertAlgText(normalized);
}

/**
 * 计算第 k 步的算法前缀文本。仅用于调试/分享，
 * 正常播放使用播放器内的时间轴定位（不重建画布）。
 */
export function prefixAlg(raw: string, step: number): string {
  const normalized = normalizeAlgText(raw);
  const moves = animatedLeaves(normalized);
  return moves
    .slice(0, Math.max(0, Math.min(step, moves.length)))
    .map((m) => m.toString())
    .join(' ');
}

/** 与魔方无关的快速语法检查，用于表单即时反馈 */
export function quickSyntaxCheck(raw: string): { ok: boolean; error?: string } {
  const parsed = parseFormulaLocal(raw);
  return parsed.ok ? { ok: true } : { ok: false, error: parsed.error };
}

export { Alg };
