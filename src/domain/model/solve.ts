import type { Penalty } from '@/domain/timer/stateMachine';

/** 一次计时成绩 */
export interface SolveRecord {
  id: string;
  /** 会话 ID（按魔方类型划分，如 'session-3x3x3'） */
  sessionId: string;
  puzzleId: string;
  /** 本次使用的打乱 */
  scramble: string;
  /** 原始用时（毫秒） */
  elapsedMs: number;
  penalty: Penalty;
  /** 备注（可选） */
  comment?: string;
  /** 毫秒时间戳，用于排序与滚动窗口 */
  createdAt: number;
}

export const DEFAULT_SESSION_PREFIX = 'session-';

export function defaultSessionId(puzzleId: string): string {
  return `${DEFAULT_SESSION_PREFIX}${puzzleId}`;
}
