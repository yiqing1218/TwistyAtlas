/**
 * 成绩统计（WCA 规则），纯函数。
 *
 * - 单次成绩 = 原始用时 + 判罚（+2 加 2000ms，DNF 记为无效）
 * - aoN：去掉最好与最差后取平均；剩余样本含 DNF 则该组为 DNF
 * - mo3：三轮平均，不去头尾
 */
import type { Penalty } from './stateMachine';

export interface SolveSample {
  elapsedMs: number;
  penalty: Penalty;
  createdAt: number;
}

/** 有效用时（ms）；DNF 返回 null */
export function effectiveMs(sample: SolveSample): number | null {
  if (sample.penalty === 'DNF') return null;
  return sample.elapsedMs + (sample.penalty === '+2' ? 2000 : 0);
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** WCA 平均：去掉最好与最差各一个，余下取平均 */
export function trimmedAverage(samples: SolveSample[]): number | null {
  if (samples.length < 3) return null;
  const values = samples.map((s) => effectiveMs(s));
  if (values.some((v) => v === null)) {
    const dnfCount = values.filter((v) => v === null).length;
    // 去掉最差的一个（可能是 DNF），若仍剩 DNF 则整组无效
    if (dnfCount > 1) return null;
    const numeric = values.filter((v): v is number => v !== null);
    if (numeric.length < 2) return null;
    numeric.sort((a, b) => a - b);
    const trimmed = numeric.slice(1); // 去掉最好
    return mean(trimmed);
  }
  const numeric = values as number[];
  const sorted = [...numeric].sort((a, b) => a - b);
  return mean(sorted.slice(1, -1));
}

export function meanOf(samples: SolveSample[]): number | null {
  if (samples.length === 0) return null;
  const values = samples.map((s) => effectiveMs(s));
  if (values.some((v) => v === null)) return null;
  return mean(values as number[]);
}

export interface SessionStats {
  count: number;
  best: number | null;
  worst: number | null;
  mean: number | null;
  mo3: number | null;
  ao5: number | null;
  ao12: number | null;
  /** 历史最优 ao5 / ao12（滚动窗口里的最小值） */
  bestAo5: number | null;
  bestAo12: number | null;
}

/** 计算滚动窗口历史最好值 */
function bestWindow(samples: SolveSample[], size: number): number | null {
  if (samples.length < size) return null;
  let best: number | null = null;
  for (let i = 0; i + size <= samples.length; i += 1) {
    const value = trimmedAverage(samples.slice(i, i + size));
    if (value === null) continue;
    if (best === null || value < best) best = value;
  }
  return best;
}

/**
 * 汇总一个会话的成绩。
 * samples 需按时间正序（旧 → 新），滚动窗口取"最后 N 次"。
 */
export function summarize(samples: SolveSample[]): SessionStats {
  const values = samples.map((s) => effectiveMs(s)).filter((v): v is number => v !== null);
  const last = (n: number) => (samples.length >= n ? samples.slice(-n) : []);
  const last3 = last(3);
  const last5 = last(5);
  const last12 = last(12);
  return {
    count: samples.length,
    best: values.length > 0 ? Math.min(...values) : null,
    worst: values.length > 0 ? Math.max(...values) : null,
    mean: meanOf(samples),
    mo3: last3.length === 3 ? meanOf(last3) : null,
    ao5: trimmedAverage(last5),
    ao12: trimmedAverage(last12),
    bestAo5: bestWindow(samples, 5),
    bestAo12: bestWindow(samples, 12),
  };
}
