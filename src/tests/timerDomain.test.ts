import { describe, expect, it } from 'vitest';
import {
  HOLD_READY_MS,
  INSPECTION_LIMIT_MS,
  INSPECTION_PLUS2_MS,
  INITIAL_TIMER_STATE,
  displayMs,
  inspectionStatus,
  reduce,
  solveOutcome,
  type TimerState,
} from '@/domain/timer/stateMachine';
import { formatMs, formatSolve } from '@/domain/timer/format';
import { summarize, trimmedAverage, type SolveSample } from '@/domain/timer/statistics';

const press = (state: TimerState, at: number, inspectionEnabled = false) =>
  reduce(state, { type: 'press', at, inspectionEnabled });
const release = (state: TimerState, at: number) => reduce(state, { type: 'release', at });

describe('计时器状态机', () => {
  it('按住不足 300ms 不会启动（防误触）', () => {
    let state = press(INITIAL_TIMER_STATE, 1000);
    expect(state.phase).toBe('holding');
    state = release(state, 1000 + HOLD_READY_MS - 50);
    expect(state.phase).toBe('idle');
    expect(state.aborted).toBe(true);
  });

  it('按住超过 300ms 松开后开始计时', () => {
    let state = press(INITIAL_TIMER_STATE, 1000);
    state = release(state, 1000 + HOLD_READY_MS + 20);
    expect(state.phase).toBe('running');
    expect(state.startedAt).toBe(1000 + HOLD_READY_MS + 20);
  });

  it('运行时按空格停表并记录用时', () => {
    let state = press(INITIAL_TIMER_STATE, 0);
    state = release(state, 400);
    state = press(state, 5400);
    expect(state.phase).toBe('stopped');
    expect(state.elapsedMs).toBe(5000);
  });

  it('停表后显示定格成绩，下一次按下回到初始态', () => {
    let state = press(INITIAL_TIMER_STATE, 0);
    state = release(state, 400);
    state = press(state, 2400);
    expect(displayMs(state, 99_999)).toBe(2000);
    const next = press(state, 3000);
    expect(next.phase).toBe('holding');
    expect(next.elapsedMs).toBeNull();
  });

  it('off 状态下不会进入观察', () => {
    const state = press(INITIAL_TIMER_STATE, 100, false);
    expect(state.phase).toBe('holding');
    expect(state.inspectionStartedAt).toBeNull();
  });

  it('开启观察时按下先进入观察阶段', () => {
    const state = press(INITIAL_TIMER_STATE, 100, true);
    expect(state.phase).toBe('inspecting');
    expect(state.inspectionStartedAt).toBe(100);
  });

  it('观察不足 15 秒不判罚', () => {
    const state = press(INITIAL_TIMER_STATE, 0, true);
    expect(inspectionStatus(state, INSPECTION_LIMIT_MS - 1).penalty).toBe('none');
  });

  it('观察 15~17 秒判 +2', () => {
    const state = press(INITIAL_TIMER_STATE, 0, true);
    expect(inspectionStatus(state, INSPECTION_LIMIT_MS + 1).penalty).toBe('+2');
  });

  it('观察超过 17 秒判 DNF', () => {
    const state = press(INITIAL_TIMER_STATE, 0, true);
    expect(inspectionStatus(state, INSPECTION_PLUS2_MS + 1).penalty).toBe('DNF');
  });

  it('观察阶段按住再松开，用时可正常记录', () => {
    let state = press(INITIAL_TIMER_STATE, 0, true);
    state = release(state, 3000); // 观察 3 秒（这里会先回到 inspecting）
    expect(state.phase).toBe('inspecting');
    state = press(state, 4000);
    expect(state.phase).toBe('holding');
    state = release(state, 4500);
    expect(state.phase).toBe('running');
  });

  it('观察超时的判罚会计入成绩', () => {
    let state = press(INITIAL_TIMER_STATE, 0, true);
    // 观察 16 秒后开始
    state = { ...state, phase: 'holding', holdStartedAt: 16_000, holdReady: true };
    state = release(state, 16_000 + HOLD_READY_MS);
    state = press(state, 16_000 + HOLD_READY_MS + 10_000);
    const outcome = solveOutcome(state, true);
    expect(outcome.penalty).toBe('+2');
    expect(outcome.elapsedMs).toBe(10_000);
  });

  it('cancel 会清空状态', () => {
    let state = press(INITIAL_TIMER_STATE, 0, true);
    state = reduce(state, { type: 'cancel' });
    expect(state.phase).toBe('idle');
    expect(state.inspectionStartedAt).toBeNull();
  });
});

describe('成绩统计', () => {
  const make = (list: Array<[number, 'none' | '+2' | 'DNF']>): SolveSample[] =>
    list.map(([elapsedMs, penalty], index) => ({ elapsedMs, penalty, createdAt: index }));

  it('ao5 去掉最好最差后取平均', () => {
    const samples = make([
      [10000, 'none'],
      [12000, 'none'],
      [9000, 'none'],
      [11000, 'none'],
      [20000, 'none'],
    ]);
    // 去掉 9000 与 20000 → (10000+12000+11000)/3 = 11000
    expect(trimmedAverage(samples)).toBe(11000);
  });

  it('ao5 出现两个 DNF 时整组无效', () => {
    const samples = make([
      [10000, 'none'],
      [12000, 'DNF'],
      [9000, 'none'],
      [11000, 'DNF'],
      [20000, 'none'],
    ]);
    expect(trimmedAverage(samples)).toBeNull();
  });

  it('ao5 只有一个 DNF 时按最差处理', () => {
    const samples = make([
      [10000, 'none'],
      [12000, 'DNF'],
      [9000, 'none'],
      [11000, 'none'],
      [20000, 'none'],
    ]);
    // DNF 视为最差去掉，再去掉最好的 9000 → (10000+11000+20000)/3
    expect(trimmedAverage(samples)).toBeCloseTo(13666.67, 1);
  });

  it('+2 计入有效用时', () => {
    const samples = make([
      [10000, '+2'],
      [8000, 'none'],
      [20000, 'none'],
    ]);
    // 有效值 12000 / 8000 / 20000 → 去掉 8000 与 20000，剩 12000
    expect(trimmedAverage(samples)).toBe(12000);
  });

  it('样本不足时返回 null', () => {
    expect(trimmedAverage(make([[1000, 'none']]))).toBeNull();
    expect(summarize(make([[1000, 'none']])).ao5).toBeNull();
  });

  it('summarize 汇总最优值与历史最好 ao5', () => {
    const samples = make([
      [15000, 'none'],
      [10000, 'none'],
      [11000, 'none'],
      [12000, 'none'],
      [13000, 'none'],
      [9000, 'none'],
    ]);
    const stats = summarize(samples);
    expect(stats.count).toBe(6);
    expect(stats.best).toBe(9000);
    expect(stats.worst).toBe(15000);
    expect(stats.bestAo5).not.toBeNull();
    expect(stats.ao5).not.toBeNull();
  });

  it('mean 遇到 DNF 返回 null', () => {
    const samples = make([
      [1000, 'none'],
      [2000, 'DNF'],
    ]);
    expect(summarize(samples).mean).toBeNull();
  });

  it('ao50 / ao100：样本不足时为空，够了就按去头尾平均', () => {
    const few = make(Array.from({ length: 49 }, (_, i) => [10000 + i * 10, 'none'] as [number, 'none']));
    expect(summarize(few).ao50).toBeNull();
    expect(summarize(few).ao100).toBeNull();

    const many = make(Array.from({ length: 100 }, (_, i) => [10000 + i * 10, 'none'] as [number, 'none']));
    const stats = summarize(many);
    expect(stats.ao50).not.toBeNull();
    expect(stats.ao100).not.toBeNull();
    expect(stats.bestAo50).not.toBeNull();
    // 100 个等差样本，去头尾后均值 = 中间两点平均
    expect(stats.ao100).toBeCloseTo(10495, 0);
  });
});

describe('时间格式化', () => {
  it('小于一分钟只显示秒与毫秒', () => {
    expect(formatMs(12_345)).toBe('12.345');
    expect(formatMs(0)).toBe('0.000');
  });

  it('超过一分钟显示 分:秒.毫秒', () => {
    expect(formatMs(220_079)).toBe('3:40.079');
  });

  it('DNF 与 +2 的展示', () => {
    expect(formatSolve(12_000, 'DNF')).toBe('DNF');
    expect(formatSolve(12_000, '+2')).toBe('14.000');
    expect(formatMs(null)).toBe('—');
  });
});
