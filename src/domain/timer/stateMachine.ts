/**
 * 计时器状态机（纯函数，无框架依赖，可 100% 单测）。
 *
 * 状态与 csTimer 的交互一致：
 *   idle      ── 按住空格 ──▶ holding ──(≥300ms 变绿)──▶ 松开 ──▶ running
 *   inspecting ─ 按下空格 ──▶ holding ── 松开 ──▶ running（观察超时按 WCA 判罚）
 *   running   ── 按空格 ──▶ stopped（记录成绩，回到 idle）
 *
 * 所有时间都由外部注入（now），因此本模块是确定性的、可测的。
 */

export type TimerPhase = 'idle' | 'inspecting' | 'holding' | 'running' | 'stopped';

export type Penalty = 'none' | '+2' | 'DNF';

export interface TimerState {
  phase: TimerPhase;
  /** 观察开始时刻（ms） */
  inspectionStartedAt: number | null;
  /** 本次按住空格的起点（ms） */
  holdStartedAt: number | null;
  /** 计时起点（ms） */
  startedAt: number | null;
  /** 已停表的原始用时（ms） */
  elapsedMs: number | null;
  /** 松手时是否已达到可开始状态（≥HOLD_READY_MS） */
  holdReady: boolean;
  /** 松手时若不足 HOLD_READY_MS，则本次不计时，需重新按住 */
  aborted: boolean;
}

export const HOLD_READY_MS = 300;
/** WCA 观察时间：15 秒内必须开始，16 秒 +2，17 秒 DNF */
export const INSPECTION_LIMIT_MS = 15_000;
export const INSPECTION_PLUS2_MS = 17_000;

export const INITIAL_TIMER_STATE: TimerState = {
  phase: 'idle',
  inspectionStartedAt: null,
  holdStartedAt: null,
  startedAt: null,
  elapsedMs: null,
  holdReady: false,
  aborted: false,
};

export type TimerEvent =
  | { type: 'press'; at: number; inspectionEnabled: boolean }
  | { type: 'release'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'cancel' }
  | { type: 'reset' };

/** 观察阶段的用时与判罚 */
export function inspectionStatus(state: TimerState, at: number): { elapsedMs: number; penalty: Penalty } {
  if (state.inspectionStartedAt == null) return { elapsedMs: 0, penalty: 'none' };
  const elapsedMs = Math.max(0, at - state.inspectionStartedAt);
  if (elapsedMs >= INSPECTION_PLUS2_MS) return { elapsedMs, penalty: 'DNF' };
  if (elapsedMs >= INSPECTION_LIMIT_MS) return { elapsedMs, penalty: '+2' };
  return { elapsedMs, penalty: 'none' };
}

export function reduce(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case 'press': {
      if (state.phase === 'idle') {
        if (event.inspectionEnabled) {
          return {
            ...INITIAL_TIMER_STATE,
            phase: 'inspecting',
            inspectionStartedAt: event.at,
          };
        }
        return { ...INITIAL_TIMER_STATE, phase: 'holding', holdStartedAt: event.at };
      }
      if (state.phase === 'inspecting') {
        return { ...state, phase: 'holding', holdStartedAt: event.at, holdReady: false, aborted: false };
      }
      if (state.phase === 'running') {
        return {
          ...state,
          phase: 'stopped',
          elapsedMs: Math.max(0, event.at - (state.startedAt ?? event.at)),
        };
      }
      if (state.phase === 'stopped') {
        // 停表后仍显示成绩；此时按下应直接进入新一轮（否则要按两次才能开始）
        return reduce(INITIAL_TIMER_STATE, {
          type: 'press',
          at: event.at,
          inspectionEnabled: event.inspectionEnabled,
        });
      }
      return state;
    }

    case 'release': {
      if (state.phase !== 'holding') return state;
      const held = event.at - (state.holdStartedAt ?? event.at);
      if (held < HOLD_READY_MS) {
        // 太短：回到进入 holding 之前的状态，避免误触
        if (state.inspectionStartedAt != null) {
          return { ...state, phase: 'inspecting', holdStartedAt: null, holdReady: false, aborted: true };
        }
        return { ...INITIAL_TIMER_STATE, aborted: true };
      }
      return {
        ...state,
        phase: 'running',
        holdStartedAt: null,
        holdReady: false,
        aborted: false,
        startedAt: event.at,
        elapsedMs: null,
      };
    }

    case 'tick': {
      if (state.phase !== 'holding') return state;
      const held = event.at - (state.holdStartedAt ?? event.at);
      const holdReady = held >= HOLD_READY_MS;
      return holdReady === state.holdReady ? state : { ...state, holdReady };
    }

    case 'cancel':
      return { ...INITIAL_TIMER_STATE };

    case 'reset':
      return { ...INITIAL_TIMER_STATE };

    default:
      return state;
  }
}

/** 当前该显示的毫秒数（运行中实时、停止后定格） */
export function displayMs(state: TimerState, at: number): number {
  if (state.phase === 'running') return Math.max(0, at - (state.startedAt ?? at));
  if (state.phase === 'stopped') return state.elapsedMs ?? 0;
  return 0;
}

/** 停表后应写入成绩的用时（已含观察判罚） */
export function solveOutcome(
  state: TimerState,
  inspectionEnabled: boolean,
): { elapsedMs: number; penalty: Penalty } {
  if (state.phase !== 'stopped' || state.elapsedMs == null) return { elapsedMs: 0, penalty: 'none' };
  if (!inspectionEnabled || state.inspectionStartedAt == null) {
    return { elapsedMs: state.elapsedMs, penalty: 'none' };
  }
  const inspectDuration = (state.startedAt ?? 0) - state.inspectionStartedAt;
  if (inspectDuration >= INSPECTION_PLUS2_MS) return { elapsedMs: state.elapsedMs, penalty: 'DNF' };
  if (inspectDuration >= INSPECTION_LIMIT_MS) return { elapsedMs: state.elapsedMs, penalty: '+2' };
  return { elapsedMs: state.elapsedMs, penalty: 'none' };
}
