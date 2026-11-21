/**
 * 构建内置公式集：解析各来源 → 用真实 KPuzzle 校验 → 输出带来源归属的 JSON。
 *
 * 校验分级：
 *   parsed      能被引擎解析且动作在本魔方上合法
 *   structural  额外满足该公式集的结构判据（如 OLL 必须还原前两层且让顶面朝向正确）
 *
 * 输出：
 *   data/verified/algsets.json   应用运行时读取的内置公式集
 *   data/verified/rejected.json  被剔除的条目与原因（可审计）
 *   data/verified/report.json    统计
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJpermFile } from './parse-jperm.mjs';
import { parseScdbCasesWithSetup, parseScdbFlatList } from './parse-scdb.mjs';
import { kpuzzleOf, analyzePattern, uLayerIndexSets, transform, residualAlgText } from './engine.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const raw = (...p) => resolve(root, 'data/raw', ...p);
const outDir = resolve(root, 'data/verified');
mkdirSync(outDir, { recursive: true });

const ACCESSED_AT = new Date().toISOString().slice(0, 10);

const SOURCES = [
  {
    id: 'SRC-JPERM',
    siteName: 'J Perm',
    homeUrl: 'https://jperm.net/',
    pageUrl: 'https://jperm.net/algs/oll',
    language: 'en',
    format: 'JS 数据集',
    licenseNote: '仅用于个人学习；来源页脚声明版权归 J Perm。本站仅保存公式文本与署名，未搬运图片。',
    accessedAt: ACCESSED_AT,
  },
  {
    id: 'SRC-SCDB',
    siteName: 'SpeedCubeDB',
    homeUrl: 'https://speedcubedb.com/',
    pageUrl: 'https://speedcubedb.com/a/3x3/F2L',
    language: 'en',
    format: 'HTML',
    licenseNote: '社区维护的公式库；仅摘录公式文本并署名，未复制图片与排版。',
    accessedAt: ACCESSED_AT,
  },
  {
    id: 'SRC-ZBLL-TRAINER',
    siteName: 'Roman Strakhov · zbll-trainer',
    homeUrl: 'https://github.com/Roman-/zbll-trainer',
    pageUrl: 'https://raw.githubusercontent.com/Roman-/zbll-trainer/master/scripts/casesmap.js',
    language: 'en',
    format: 'JS 数据文件',
    licenseNote: '公开 GitHub 仓库；按仓库可见内容摘录公式文本并署名作者。',
    accessedAt: ACCESSED_AT,
  },
];

/**
 * 每个集合的结构判据。
 *
 * 关键点：判定的是"公式对复原态作用后的状态"，而不是"公式解的那个情况"。
 * - OLL 公式本来就会改变顶层朝向，因此**不能**要求结果顶层已定向；
 *   只要求它保持前两层（这才是"只动顶层"的定义）。
 * - PLL/COLL/ZBLL/CLL 都是在顶层已定向的前提下工作，因此要求结果顶层仍定向。
 * - COLL 额外要求顶层棱块位置不变（只换角）。
 */
const RULES = {
  'cfop-oll': { requireF2l: true },
  'cfop-2look-oll': { requireF2l: true },
  'cfop-2look-pll': { requireF2l: true, requireOriented: true },
  'cfop-pll': { requireF2l: true, requireOriented: true },
  // COLL 会重新定向角块（这正是它的工作），只要求：前两层不动、棱块朝向不变。
  // 是否同时保持棱块位置作为**标记**记录（部分来源混入了 CMLL 公式，会改动棱块排列）。
  'coll': { requireF2l: true, requireEdgeOriented: true, flagEdgeIdentity: true },
  'wv': {},
  // 来源标注为 ZBLL，但逐条引擎校验显示这些公式保持**棱块**定向、却不保持角块定向，
  // 按定义它们属于 1LLL（ZBLL 的近亲集合）。因此按可证明的性质设判据，并在名称与说明里讲清楚。
  'zbll': { requireF2l: true, requireEdgeOriented: true },
  // CLL 同样会重新定向角块，二阶没有棱块，只要求第一层不动
  'cll-2x2': { requireF2l: true },
  'f2l': { requireF2lAfterSetup: true },
  'parity-4x4': {},
  'l2e-5x5': {},
};

/** F2L 的四个朝向：把 setup 用 y 旋转共轭，覆盖 Front/Left/Back/Right 四个槽位 */
const F2L_SETUP_VARIANTS = [
  (setup) => setup,
  (setup) => `y ${setup} y'`,
  (setup) => `y' ${setup} y`,
  (setup) => `y2 ${setup} y2`,
];

const sets = [];
const rejected = [];

/* ---------- jperm 系列 ---------- */
const JPERM_SETS = [
  { file: 'oll', id: 'cfop-oll', name: 'OLL', nameZh: 'OLL · 顶面朝向', mode: 'inverse' },
  { file: 'pll', id: 'cfop-pll', name: 'PLL', nameZh: 'PLL · 顶层排列', mode: 'inverse' },
  { file: 'coll', id: 'coll', name: 'COLL', nameZh: 'COLL · 顶层角块', mode: 'inverse' },
  { file: 'wv', id: 'wv', name: 'WV', nameZh: 'WV · 冬季变体', mode: 'inverse' },
  { file: '2x2cll', id: 'cll-2x2', name: 'CLL (2×2)', nameZh: '二阶 CLL', mode: 'inverse' },
  // 入门向：两步 OLL / 两步 PLL（CFOP 学习路径的第一层台阶）
  { file: '2lookoll', id: 'cfop-2look-oll', name: '2-Look OLL', nameZh: '2-Look OLL · 两步顶层定向', mode: 'inverse' },
  { file: '2lookpll', id: 'cfop-2look-pll', name: '2-Look PLL', nameZh: '2-Look PLL · 两步顶层排列', mode: 'inverse' },
];

for (const cfg of JPERM_SETS) {
  const parsed = parseJpermFile(raw('jperm', `${cfg.file}.js`), cfg.file);
  sets.push({
    id: cfg.id,
    puzzleId: parsed.puzzleId,
    name: cfg.name,
    nameZh: cfg.nameZh,
    sourceId: 'SRC-JPERM',
    setupMode: cfg.mode,
    cases: parsed.cases.map((c, index) => ({
      caseId: `${cfg.id}-${index + 1}`,
      name: `${cfg.name} ${c.caseName}`,
      group: c.group,
      probability: c.probability,
      setupAlg: '',
      algs: c.algs.map((alg) => ({ alg })),
    })),
  });
}

/* ---------- speedcubedb：F2L ---------- */
{
  const html = readFileSync(raw('scdb', '3x3-F2L.html'), 'utf-8');
  const parsed = parseScdbCasesWithSetup(html, { puzzleId: '3x3x3', setId: 'f2l', displayName: 'F2L' });
  sets.push({
    id: 'f2l',
    puzzleId: '3x3x3',
    name: 'F2L',
    nameZh: 'F2L · 前两层',
    sourceId: 'SRC-SCDB',
    setupMode: 'explicit',
    cases: parsed.cases.map((c, i) => ({
      caseId: `f2l-${i + 1}`,
      name: c.caseName,
      group: 'Free Pairs',
      probability: null,
      setupAlg: c.setupAlg,
      algs: c.algs.map((alg) => ({ alg })),
    })),
  });
}

/* ---------- speedcubedb：4x4 / 5x5 ---------- */
for (const cfg of [
  { file: '4x4-OLLParity.html', id: 'parity-4x4-oll', name: '4×4 OLL Parity', puzzleId: '4x4x4', prefix: '4×4 OLL Parity' },
  { file: '4x4-PLLParity.html', id: 'parity-4x4-pll', name: '4×4 PLL Parity', puzzleId: '4x4x4', prefix: '4×4 PLL Parity' },
  { file: '5x5-L2E.html', id: 'l2e-5x5', name: '5×5 L2E', puzzleId: '5x5x5', prefix: '5×5 L2E' },
]) {
  const html = readFileSync(raw('scdb', cfg.file), 'utf-8');
  const parsed = parseScdbFlatList(html, {
    puzzleId: cfg.puzzleId,
    setId: cfg.id,
    displayName: cfg.name,
    casePrefix: cfg.prefix,
  });
  sets.push({
    id: cfg.id,
    puzzleId: cfg.puzzleId,
    name: cfg.name,
    nameZh: cfg.name,
    sourceId: 'SRC-SCDB',
    setupMode: 'inverse',
    cases: parsed.cases.map((c, i) => ({
      caseId: `${cfg.id}-${i + 1}`,
      name: c.caseName,
      group: '',
      probability: null,
      setupAlg: '',
      algs: c.algs.map((alg) => ({ alg })),
    })),
  });
}

/* ---------- ZBLL（472 例，排除 21 个 PLL 情形） ---------- */
{
  const code = readFileSync(raw('github', '51c602f2.js'), 'utf-8');
  const sandbox = {};
  const vm = await import('node:vm');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 5000 });
  const map = sandbox.zbllMap;
  const OCLL_ZH = {
    H: 'H', L: 'L', Pi: 'Pi', S: 'S', T: 'T', U: 'U', aS: 'Antisune',
  };
  const cases = [];
  for (const [ocll, groups] of Object.entries(map)) {
    for (const [cornerPerm, caseMap] of Object.entries(groups)) {
      for (const [caseName, algList] of Object.entries(caseMap)) {
        cases.push({
          caseId: `zbll-${ocll}-${cornerPerm}-${caseName}`.toLowerCase(),
          name: `ZBLL ${OCLL_ZH[ocll] ?? ocll} · ${cornerPerm} · ${caseName}`,
          group: `${OCLL_ZH[ocll] ?? ocll} / ${cornerPerm}`,
          probability: null,
          setupAlg: '',
          algs: algList.map((alg) => ({ alg })),
        });
      }
    }
  }
  sets.push({
    id: 'zbll',
    puzzleId: '3x3x3',
    name: 'ZBLL / 1LLL',
    nameZh: 'ZBLL · 1LLL 家族（棱块已定向）',
    note:
      '公式来自 zbll-trainer 的 472 个 ZBLL 案例表。逐条用 cubing.js 状态模型校验后发现：' +
      '它们都保持前两层与顶层棱块定向，但会同时改变角块朝向，因此严格按定义属于 1LLL 家族而非标准 ZBLL。' +
      '为避免误导，此处按校验结果标注。',
    sourceId: 'SRC-ZBLL-TRAINER',
    setupMode: 'inverse',
    cases,
  });
}

/* ---------- 校验 ---------- */
const stats = { totalCases: 0, totalAlgs: 0, verified: 0, parsedOnly: 0, rejected: 0, bySet: {} };

for (const set of sets) {
  const kp = await kpuzzleOf(set.puzzleId);
  const uSets = await uLayerIndexSets(set.puzzleId);
  const solved = kp.defaultPattern();
  const rule = RULES[set.id] ?? {};
  const setStat = { cases: 0, algs: 0, rejected: 0, levels: { structural: 0, parsed: 0 } };
  const seenAlgs = new Set();

  for (const c of set.cases) {
    const keptAlgs = [];
    for (const item of c.algs) {
      const algText = item.alg.trim();
      if (!algText) continue;
      const dedupeKey = `${c.caseId}|${algText}`;
      if (seenAlgs.has(dedupeKey)) continue;
      seenAlgs.add(dedupeKey);

      try {
        // L1：解析 + 合法性。结构判定用「净旋转归零」后的等价公式，
        // 避免整体旋转把块搬到别的槽位而污染"是否只动顶层"的判定；展示仍用原公式。
        const checkText = residualAlgText(algText) || algText;
        const t = await transform(set.puzzleId, checkText);
        const result = solved.applyTransformation(t);

        let level = 'parsed';
        let ok = true;
        let reason = '';

        let edgeIdentityFlag;
        if (rule.requireF2l || rule.requireOriented || rule.requireEdgeIdentity || rule.requireEdgeOriented) {
          const a = analyzePattern(result, uSets);
          if (rule.flagEdgeIdentity) edgeIdentityFlag = a.llEdgesIdentity;
          if (rule.requireF2l && !a.f2lSolved) { ok = false; reason = '执行后前两层未还原'; }
          if (ok && rule.requireOriented && !a.llOriented) { ok = false; reason = '执行后顶层未完全定向'; }
          if (ok && rule.requireEdgeOriented && !a.llEdgesOriented) { ok = false; reason = '执行后顶层棱块朝向被改变'; }
          if (ok && rule.requireEdgeIdentity && !a.llEdgesIdentity) { ok = false; reason = '执行后顶层棱块位置被改变'; }
          if (ok) level = 'structural';
        } else if (rule.requireF2lAfterSetup && c.setupAlg) {
          // 同一案例的四个朝向用不同的 setup；逐个尝试，命中即采纳
          let matchedSetup = '';
          for (const variant of F2L_SETUP_VARIANTS) {
            const candidate = variant(c.setupAlg);
            try {
              const withSetup = solved
                .applyTransformation(kp.algToTransformation(candidate))
                .applyTransformation(t);
              if (analyzePattern(withSetup, uSets).f2lSolved) {
                matchedSetup = candidate;
                break;
              }
            } catch {
              /* 该朝向的 setup 不合法，继续下一个 */
            }
          }
          if (!matchedSetup) {
            ok = false;
            reason = 'setup + 公式后前两层未还原（四个朝向均未命中）';
          } else {
            level = 'structural';
            item.matchedSetup = matchedSetup;
          }
        }

        if (!ok) {
          rejected.push({ setId: set.id, caseId: c.caseId, alg: algText, reason });
          setStat.rejected += 1;
          continue;
        }
        keptAlgs.push({
          alg: algText,
          level,
          setupAlg: item.matchedSetup ?? '',
          ...(edgeIdentityFlag === undefined ? {} : { preservesEdgePermutation: edgeIdentityFlag }),
        });
        setStat.levels[level] += 1;
      } catch (err) {
        rejected.push({ setId: set.id, caseId: c.caseId, alg: algText, reason: `解析失败：${(err && err.message) || err}`.slice(0, 160) });
        setStat.rejected += 1;
      }
    }
    // 关键：无论是否全部被拒，都要写回结果，否则被拒的原始公式会残留在产物里
    c.algs = keptAlgs;
    if (keptAlgs.length === 0) continue;
    setStat.cases += 1;
    setStat.algs += keptAlgs.length;
  }

  set.cases = set.cases.filter((c) => c.algs.length > 0);
  stats.bySet[set.id] = setStat;
  stats.totalCases += setStat.cases;
  stats.totalAlgs += setStat.algs;
  stats.verified += setStat.levels.structural;
  stats.parsedOnly += setStat.levels.parsed;
}
stats.rejected = rejected.length;

/** 页面上的展示顺序：先 CFOP 主线，再派生体系，最后其他阶数 */
const DISPLAY_ORDER = [
  'cfop-oll',
  'cfop-pll',
  'cfop-2look-oll',
  'cfop-2look-pll',
  'f2l',
  'coll',
  'wv',
  'zbll',
  'cll-2x2',
  'parity-4x4-oll',
  'parity-4x4-pll',
  'l2e-5x5',
];

const payload = {
  generatedAt: new Date().toISOString(),
  schemaVersion: 1,
  sources: SOURCES,
  sets: sets
    .filter((s) => s.cases.length > 0)
    .sort((a, b) => {
      const ia = DISPLAY_ORDER.indexOf(a.id);
      const ib = DISPLAY_ORDER.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    }),
};

writeFileSync(resolve(outDir, 'algsets.json'), JSON.stringify(payload), 'utf-8');
writeFileSync(resolve(outDir, 'rejected.json'), JSON.stringify(rejected, null, 1), 'utf-8');
writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(stats, null, 2), 'utf-8');
// 应用运行时直接 import src/data/algsets.json（Vite 打成一个独立 chunk）。
// 直接写一份到这里，避免 data/verified 与 src/data 两份产物漂移。
writeFileSync(resolve(root, 'src/data/algsets.json'), JSON.stringify(payload), 'utf-8');

console.log(JSON.stringify(stats, null, 2));
console.log('\n集合明细：');
for (const s of payload.sets) {
  console.log(` ${s.id.padEnd(16)} ${s.puzzleId.padEnd(8)} cases=${String(s.cases.length).padStart(4)} algs=${String(s.cases.reduce((a, c) => a + c.algs.length, 0)).padStart(5)}`);
}
console.log('\n输出：data/verified/algsets.json');
