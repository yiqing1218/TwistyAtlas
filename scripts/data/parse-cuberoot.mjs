/**
 * 解析 cuberoot（api.cuberoot.me）的公式集 JSON。
 *
 * 数据形状：
 *   { puzzle, set, cases: [{ id, name, subgroup, setup, algs: [[{ alg }]] }] }
 *
 * 记号差异需要归一化：
 *   - Square-1 写作 `1,0/3,0/...`，引擎要求 `(1,0) / (3,0) / ...`
 *   - 斜转里 `b / r / S / H` 这套记法引擎不支持，只能丢弃（计入 rejected）
 *
 * 校验策略（不依赖人工判断）：
 *   对每个 case，用来源自带的 setup 打乱，再执行公式：
 *     solved · setup · alg · [AUF] == solved
 *   允许末尾有一个 AUF（顶层对齐），这是速拧公式的常见写法。
 *   通过 → level = 'structural'（证明这条公式确实解掉标注的这个情况）
 *   不通过但能解析 → level = 'parsed'
 *
 * 展示用初始态（setupAlg）：
 *   - 若 setup 直接命中（无 AUF）→ 用来源 setup，画面与站点一致；
 *   - 否则用 invert(alg)，保证"播到终点一定是复原态"，不会留下顶层少转 90° 的尴尬。
 */
import { readFileSync } from 'node:fs';
import { Alg } from 'cubing/alg';
import { kpuzzleOf } from './engine.mjs';

const AUFS = ['', 'U', 'U2', "U'"];

/** Square-1：把 `1,0/3,0` 这类裸括号补齐成 `(1,0) / (3,0)` */
function normalizeSquare1(text) {
  const segments = text
    .trim()
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length <= 1) return text.trim();
  return segments
    .map((s) => (/^-?\d+,-?\d+$/.test(s) ? `(${s})` : s))
    .join(' / ');
}

function normalize(text, puzzle) {
  const trimmed = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (puzzle === 'sq1') return normalizeSquare1(trimmed);
  return trimmed;
}

/**
 * @param {string} file data/raw/cuberoot 下的文件名
 * @param {{ puzzleId: string, puzzle: string }} options
 */
export async function parseCuberootSet(file, { puzzleId, puzzle }) {
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  const kp = await kpuzzleOf(puzzleId);
  const solved = kp.defaultPattern();
  const solvedJson = JSON.stringify(solved.patternData);

  const cases = [];
  const rejected = [];
  let structural = 0;
  let parsed = 0;

  for (const [index, item] of (raw.cases ?? []).entries()) {
    const sourceSetup = normalize(item.setup ?? '', puzzle);
    const algs = (item.algs ?? []).flat().map((a) => normalize(a.alg, puzzle)).filter(Boolean);
    if (algs.length === 0) {
      rejected.push({ caseId: `${puzzle}-${index + 1}`, alg: '', reason: '来源无公式（skip 情况）' });
      continue;
    }

    const kept = [];
    for (const alg of algs) {
      // 先确认这条公式的记号能被引擎解析
      try {
        kp.algToTransformation(new Alg(alg));
      } catch (error) {
        rejected.push({
          caseId: `${puzzle}-${index + 1}`,
          alg,
          reason: `记号不被引擎支持：${String(error.message).slice(0, 60)}`,
        });
        continue;
      }

      // 用来源 setup 校验：能否把该状态解掉（允许一次 AUF）
      let aufUsed = null;
      if (sourceSetup) {
        for (const auf of AUFS) {
          try {
            const candidate = `${sourceSetup} ${alg} ${auf}`.trim();
            const pattern = solved.applyTransformation(kp.algToTransformation(new Alg(candidate)));
            if (JSON.stringify(pattern.patternData) === solvedJson) {
              aufUsed = auf;
              break;
            }
          } catch {
            break;
          }
        }
      }

      const verified = aufUsed !== null;
      if (verified) structural += 1;
      else parsed += 1;

      let setupAlg;
      if (verified && aufUsed === '') setupAlg = sourceSetup;
      else setupAlg = new Alg(alg).invert().toString();

      kept.push({ alg, level: verified ? 'structural' : 'parsed', setupAlg });
    }

    if (kept.length === 0) continue;
    cases.push({
      caseId: `${puzzle}-${index + 1}`,
      name: item.name || `${raw.set} ${index + 1}`,
      group: item.subgroup || raw.set,
      probability: null,
      setupAlg: kept[0].setupAlg,
      algs: kept,
    });
  }

  return { cases, rejected, stats: { structural, parsed, totalCases: cases.length } };
}
