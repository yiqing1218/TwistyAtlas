/**
 * 成绩导出（应用层，纯函数）。
 *
 * 三种格式，都是纯字符串生成，方便单测；真正的下载动作留给表现层：
 *   - csv  给电子表格（Excel / Numbers / Google Sheets）
 *   - json 给备份与再导入（字段与 IndexedDB 一致，便于恢复）
 *   - text 给论坛/群里贴成绩（csTimer 那种一行一条的观感）
 */
import type { SolveRecord } from '@/domain/model/solve';
import { formatSolve } from '@/domain/timer/format';

export type ExportFormat = 'csv' | 'json' | 'text';

export const EXPORT_LABEL: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  text: '文本',
};

export const EXPORT_MIME: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
  text: 'text/plain;charset=utf-8',
};

const PENALTY_TEXT: Record<string, string> = { '': '', '+2': '+2', DNF: 'DNF' };

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function isoTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 用时（秒，保留三位小数），DNF 记为 "DNF" */
function secondsValue(record: SolveRecord): string {
  if (record.penalty === 'DNF') return 'DNF';
  const ms = record.elapsedMs + (record.penalty === '+2' ? 2000 : 0);
  return (ms / 1000).toFixed(3);
}

export interface ExportInput {
  puzzleName: string;
  sessionId: string;
  records: SolveRecord[];
}

export function solvesToCsv({ puzzleName, records }: ExportInput): string {
  const header = ['序号', '项目', '时间', '原始用时(ms)', '判罚', '打乱', '时间戳'];
  const lines = [header.join(',')];
  records.forEach((r, i) => {
    lines.push(
      [
        String(i + 1),
        csvCell(puzzleName),
        secondsValue(r),
        String(r.elapsedMs),
        PENALTY_TEXT[r.penalty] ?? '',
        csvCell(r.scramble),
        isoTime(r.createdAt),
      ].join(','),
    );
  });
  return `${lines.join('\r\n')}\r\n`;
}

export function solvesToJson({ puzzleName, sessionId, records }: ExportInput): string {
  return `${JSON.stringify(
    {
      app: 'Twisty Atlas',
      kind: 'timer-session',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      sessionId,
      puzzle: puzzleName,
      count: records.length,
      solves: records.map((r) => ({
        elapsedMs: r.elapsedMs,
        penalty: r.penalty,
        scramble: r.scramble,
        createdAt: r.createdAt,
        time: formatSolve(r.elapsedMs, r.penalty),
      })),
    },
    null,
    2,
  )}\n`;
}

export function solvesToText({ puzzleName, records }: ExportInput): string {
  const head = [`Twisty Atlas · ${puzzleName} · ${records.length} 次`];
  const body = records.map((r, i) => `${String(i + 1).padStart(3, ' ')}. ${formatSolve(r.elapsedMs, r.penalty)}`);
  return `${[...head, ...body].join('\n')}\n`;
}

export function buildExport(format: ExportFormat, input: ExportInput): string {
  if (format === 'csv') return solvesToCsv(input);
  if (format === 'json') return solvesToJson(input);
  return solvesToText(input);
}

/** 建议的文件名（不含目录） */
export function exportFileName(format: ExportFormat, puzzleName: string, at = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
  const safe = puzzleName.replace(/[\\/:*?"<>|\s]+/g, '_');
  const ext = format === 'text' ? 'txt' : format;
  return `twisty-atlas-${safe}-${stamp}.${ext}`;
}
