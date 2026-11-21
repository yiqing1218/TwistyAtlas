/**
 * 内置公式集（应用层）：把静态数据集暴露为领域对象，不依赖 Vue / Dexie。
 *
 * 数据集由 `node scripts/data/build-dataset.mjs` 生成，每条公式都带
 * 引擎校验结论（level）与来源归属（sourceId）。
 */
import type { SetupMode } from '@/domain/model/formula';

export interface AlgEntry {
  alg: string;
  level: 'parsed' | 'structural';
  setupAlg?: string;
  preservesEdgePermutation?: boolean;
}

export interface AlgCase {
  caseId: string;
  name: string;
  group: string;
  probability: number | null;
  setupAlg: string;
  algs: AlgEntry[];
}

export interface AlgSet {
  id: string;
  puzzleId: string;
  name: string;
  nameZh: string;
  sourceId: string;
  setupMode: SetupMode;
  /** 界面分组：3x3-cfop / 3x3-advanced / 2x2 / big / exotic */
  category?: string;
  note?: string;
  cases: AlgCase[];
}

export const SET_CATEGORY_LABEL: Record<string, string> = {
  '3x3-cfop': '三阶 · CFOP 主线',
  '3x3-advanced': '三阶 · 进阶体系',
  '2x2': '二阶',
  'big': '四阶 / 五阶',
  'exotic': '异形（金字塔 · 五魔方 · SQ-1）',
};

export const SET_CATEGORY_ORDER = ['3x3-cfop', '3x3-advanced', '2x2', 'big', 'exotic'];

/** 按分类分组，供界面上「分组标签 + 组内 pill」渲染 */
export function groupSetsByCategory(sets: AlgSet[]): { category: string; label: string; sets: AlgSet[] }[] {
  const buckets = new Map<string, AlgSet[]>();
  for (const set of sets) {
    const key = set.category ?? '3x3-advanced';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(set);
  }
  return SET_CATEGORY_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    category: key,
    label: SET_CATEGORY_LABEL[key] ?? key,
    sets: buckets.get(key)!,
  }));
}

export interface AlgSource {
  id: string;
  siteName: string;
  homeUrl: string;
  pageUrl: string;
  language: string;
  format: string;
  licenseNote: string;
  accessedAt: string;
}

export interface AlgDataset {
  generatedAt: string;
  schemaVersion: number;
  sources: AlgSource[];
  sets: AlgSet[];
}

let cache: AlgDataset | null = null;

/** 动态加载，避免首屏体积与解析开销 */
export async function loadDataset(): Promise<AlgDataset> {
  if (cache) return cache;
  const module = await import('@/data/algsets.json');
  cache = module.default as unknown as AlgDataset;
  return cache;
}

export function setById(dataset: AlgDataset, id: string): AlgSet | undefined {
  return dataset.sets.find((s) => s.id === id);
}

export function sourceById(dataset: AlgDataset, id: string): AlgSource | undefined {
  return dataset.sources.find((s) => s.id === id);
}

export function datasetTotals(dataset: AlgDataset): { cases: number; algs: number } {
  let cases = 0;
  let algs = 0;
  for (const set of dataset.sets) {
    cases += set.cases.length;
    for (const c of set.cases) algs += c.algs.length;
  }
  return { cases, algs };
}

/** 把某个案例转成播放器需要的加载参数 */
export function caseToPlayback(
  set: AlgSet,
  algCase: AlgCase,
  algIndex = 0,
): { puzzleId: string; alg: string; setupAlg: string; setupMode: SetupMode; title: string } {
  const entry = algCase.algs[algIndex] ?? algCase.algs[0];
  return {
    puzzleId: set.puzzleId,
    alg: entry.alg,
    setupAlg: entry.setupAlg || algCase.setupAlg,
    setupMode: set.setupMode,
    title: algCase.name,
  };
}
