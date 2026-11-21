/**
 * 解析 jperm.net 的公式集数据文件（/lib/<set>.js）。
 *
 * 这些文件是纯 JS 赋值语句（`algsetAlgs=[{name, alg:[...], group}]`），
 * 用 node:vm 在隔离上下文里求值，比正则拆解安全。
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

/** @typedef {{setName:string, displayName:string, puzzleId:string, cases:Array}} ParsedSet */

const PUZZLE_BY_FILE = {
  oll: '3x3x3',
  pll: '3x3x3',
  coll: '3x3x3',
  wv: '3x3x3',
  '2x2cll': '2x2x2',
  '2lookoll': '3x3x3',
  '2lookpll': '3x3x3',
};

export function parseJpermFile(path, setName) {
  const code = readFileSync(path, 'utf-8');
  const sandbox = { console, Math, Date };
  createContext(sandbox);
  runInContext(code, sandbox, { timeout: 5000 });

  const details = sandbox.pageDetails ?? {};
  const raw = sandbox.algsetAlgs;
  if (!Array.isArray(raw)) {
    throw new Error(`${setName}: 未找到 algsetAlgs`);
  }

  const cases = raw.map((item) => ({
    caseName: String(item.name),
    group: item.group ? String(item.group) : '',
    probability: typeof item.prob === 'number' ? item.prob : null,
    algs: (Array.isArray(item.alg) ? item.alg : [item.alg]).filter(Boolean).map((a) => String(a).trim()),
  }));

  return {
    setName,
    displayName: String(details.name ?? setName),
    title: String(details.title ?? ''),
    puzzleId: PUZZLE_BY_FILE[setName] ?? '3x3x3',
    cases,
  };
}
