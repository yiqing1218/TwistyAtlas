import { describe, expect, it } from 'vitest';
import { buildExport, exportFileName, solvesToCsv, solvesToJson, solvesToText } from '@/application/timer/exportSolves';
import type { SolveRecord } from '@/domain/model/solve';

function record(partial: Partial<SolveRecord>): SolveRecord {
  return {
    id: partial.id ?? 'id-1',
    sessionId: partial.sessionId ?? 'session-3x3x3',
    puzzleId: partial.puzzleId ?? '3x3x3',
    scramble: partial.scramble ?? "R U R' U'",
    elapsedMs: partial.elapsedMs ?? 12345,
    penalty: partial.penalty ?? 'none',
    createdAt: partial.createdAt ?? Date.UTC(2026, 10, 20, 15, 30, 0),
  };
}

const input = {
  puzzleName: '三阶魔方',
  sessionId: 'session-3x3x3',
  records: [
    record({ id: 'a', elapsedMs: 12345, penalty: 'none' }),
    record({ id: 'b', elapsedMs: 10000, penalty: '+2' }),
    record({ id: 'c', elapsedMs: 9000, penalty: 'DNF' }),
  ],
};

describe('成绩导出', () => {
  it('CSV 含表头、+2 计入有效时间、DNF 原样标注', () => {
    const csv = solvesToCsv(input);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('序号,项目,时间,原始用时(ms),判罚,打乱,时间戳');
    expect(lines[1]).toContain('12.345');
    expect(lines[2]).toContain('12.000'); // 10.000 + 2 秒
    expect(lines[3]).toContain('DNF');
    expect(lines).toHaveLength(4);
  });

  it('CSV 会转义包含逗号与引号的打乱', () => {
    const csv = solvesToCsv({
      ...input,
      records: [record({ scramble: 'R U, "x" R2' })],
    });
    expect(csv).toContain('"R U, ""x"" R2"');
  });

  it('JSON 是合法且可回溯的备份结构', () => {
    const parsed = JSON.parse(solvesToJson(input)) as {
      kind: string;
      count: number;
      solves: { elapsedMs: number; penalty: string; time: string }[];
    };
    expect(parsed.kind).toBe('timer-session');
    expect(parsed.count).toBe(3);
    expect(parsed.solves[1]).toMatchObject({ elapsedMs: 10000, penalty: '+2' });
    expect(parsed.solves[2].time).toContain('DNF');
  });

  it('文本格式一行一条，带序号', () => {
    const text = solvesToText(input);
    expect(text.split('\n')[0]).toContain('三阶魔方');
    expect(text).toContain('1. 12.345');
    expect(text.trim().split('\n')).toHaveLength(4);
  });

  it('buildExport 会按格式分派', () => {
    expect(buildExport('csv', input)).toBe(solvesToCsv(input));
    expect(buildExport('json', input)).toBe(solvesToJson(input));
    expect(buildExport('text', input)).toBe(solvesToText(input));
  });

  it('文件名带项目名与时间戳，且不含非法字符', () => {
    const name = exportFileName('csv', '三阶/魔方 4x4', new Date(2026, 10, 20, 9, 5));
    expect(name).toBe('twisty-atlas-三阶_魔方_4x4-20261120-0905.csv');
    expect(exportFileName('text', 'x')).toMatch(/\.txt$/);
  });
});
