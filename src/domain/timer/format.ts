/**
 * 时间与成绩的显示格式。
 *
 * 与 csTimer 一致的约定：
 * - 小于 1 分钟：`12.345`
 * - 大于等于 1 分钟：`3:40.079`
 * - DNF 显示为 `DNF`，+2 在成绩后标注
 */

export function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const rounded = Math.round(ms);
  const minutes = Math.floor(rounded / 60000);
  const seconds = Math.floor((rounded % 60000) / 1000);
  const millis = rounded % 1000;
  const sec = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  if (minutes > 0) return `${minutes}:${sec}.${mmm}`;
  return `${seconds}.${mmm}`;
}

/** 运行中的实时显示：分辨率到毫秒，长度随位数增长而稳定 */
export function formatRunning(ms: number): string {
  return formatMs(Math.max(0, ms));
}

/** 带判罚的成绩展示 */
export function formatSolve(elapsedMs: number, penalty: 'none' | '+2' | 'DNF'): string {
  if (penalty === 'DNF') return 'DNF';
  return formatMs(elapsedMs + (penalty === '+2' ? 2000 : 0));
}

/** 观察阶段剩余秒数（用于显示 8 / 12 等提示） */
export function formatInspection(elapsedMs: number): string {
  const seconds = Math.max(0, Math.ceil((15000 - elapsedMs) / 1000));
  if (elapsedMs >= 17000) return 'DNF';
  if (elapsedMs >= 15000) return '+2';
  return String(seconds);
}
