import type { FormulaCategory, FormulaRecord, SetupMode } from '@/domain/model/formula';
import { CURRENT_SCHEMA_VERSION } from '@/domain/model/formula';
import { db, readMeta, writeMeta } from '@/infrastructure/persistence/database';
import { newId } from '@/infrastructure/persistence/formulaRepository';

interface SeedCategory {
  name: string;
  sortOrder: number;
}

interface SeedFormula {
  puzzleId: string;
  category: string;
  title: string;
  alg: string;
  setupMode: SetupMode;
  tags: string[];
  description: string;
}

const CATEGORY_SETS: Record<string, SeedCategory[]> = {
  '3x3x3': [
    { name: '基础', sortOrder: 0 },
    { name: 'F2L', sortOrder: 1 },
    { name: 'OLL', sortOrder: 2 },
    { name: 'PLL', sortOrder: 3 },
    { name: '自定义', sortOrder: 4 },
  ],
  default: [
    { name: '基础', sortOrder: 0 },
    { name: '自定义', sortOrder: 1 },
  ],
};

/**
 * 初始演示数据：全部为经过 KPuzzle 校验的真实动作序列。
 * 注意：这些不是官方 OLL/PLL 案例，只是可验证的示范算法。
 */
const SEED_FORMULAS: SeedFormula[] = [
  {
    puzzleId: '3x3x3',
    category: '基础',
    title: '单次右面转动',
    alg: 'R',
    setupMode: 'solved',
    tags: ['基础', '面转'],
    description: '从复原态执行一次右层顺时针转动，用于确认渲染与转层方向正确。',
  },
  {
    puzzleId: '3x3x3',
    category: '基础',
    title: '右手四步',
    alg: "R U R' U'",
    setupMode: 'inverse',
    tags: ['基础', '手法'],
    description:
      '四步基础手法。初始态由公式逆序生成（教学用可逆演示），播放后魔方回到复原态，用来验证公式与三维状态严格同步。',
  },
  {
    puzzleId: '3x3x3',
    category: '基础',
    title: 'Sune（示范算法）',
    alg: "R U R' U R U2 R'",
    setupMode: 'inverse',
    tags: ['基础', '示范'],
    description: '常见七步算法示范。这里的初始态只是逆公式，不代表标准的 OLL 案例朝向。',
  },
  {
    puzzleId: '3x3x3',
    category: '基础',
    title: '基础换位检验',
    alg: 'R2 U2 R2',
    setupMode: 'solved',
    tags: ['基础', '自检'],
    description: '连续两次半转的组合，用于检查半转角度与顺序播放。',
  },
  {
    puzzleId: '2x2x2',
    category: '基础',
    title: '二阶四步手法',
    alg: "R U R' U'",
    setupMode: 'solved',
    tags: ['基础'],
    description: '二阶只有角块，同一个四步手法在二阶上的效果与三阶不同。',
  },
  {
    puzzleId: '4x4x4',
    category: '基础',
    title: '四阶宽层示范',
    alg: "Rw U2 Rw'",
    setupMode: 'solved',
    tags: ['基础', '宽层'],
    description: 'Rw 表示同时转动右侧两层，用于验证宽层与单层的区别。',
  },
  {
    puzzleId: '5x5x5',
    category: '基础',
    title: '五阶宽层示范',
    alg: "Rw U2 Rw'",
    setupMode: 'solved',
    tags: ['基础', '宽层'],
    description: '五阶宽层动作，右两层一起转动。',
  },
  {
    puzzleId: '6x6x6',
    category: '基础',
    title: '六阶三层宽转',
    alg: "3Rw U2 3Rw'",
    setupMode: 'solved',
    tags: ['基础', '高阶'],
    description: '3Rw 表示右侧三层同时转动，用于验证高阶记号不会被当成三阶处理。',
  },
  {
    puzzleId: '7x7x7',
    category: '基础',
    title: '七阶三层宽转',
    alg: "3Rw U2 3Rw'",
    setupMode: 'solved',
    tags: ['基础', '高阶'],
    description: '七阶的宽层动作，验证高阶渲染与逐步播放。',
  },
  {
    puzzleId: 'pyraminx',
    category: '基础',
    title: '金字塔基础面转',
    alg: "R U R' U'",
    setupMode: 'solved',
    tags: ['基础'],
    description: '金字塔两个面的交替转动，转轴与三阶不同。',
  },
  {
    puzzleId: 'skewb',
    category: '基础',
    title: '斜转基础手法',
    alg: "R U R' U'",
    setupMode: 'solved',
    tags: ['基础'],
    description: '斜转魔方的斜向层转，可用于验证非立方体轴向。',
  },
  {
    puzzleId: 'megaminx',
    category: '基础',
    title: '五魔方双格转',
    alg: "R++ U R-- U'",
    setupMode: 'solved',
    tags: ['基础'],
    description: '++ / -- 表示 2/5 圈的转动，用于验证非 90° 的角度动画。',
  },
  {
    puzzleId: 'square1',
    category: '基础',
    title: 'SQ1 基础切转',
    alg: '(1,0) / (3,0)',
    setupMode: 'solved',
    tags: ['基础', '实验性'],
    description:
      'SQ1 记号为 (a,b)/ 形式。公式可被状态模型解析，但三维形变渲染仍在验证中，界面会标注实验性支持。',
  },
];

export const DEMO_FORMULA_COUNT = SEED_FORMULAS.length;

export async function seedDatabase(force = false): Promise<void> {
  const meta = await readMeta();
  const categoryCount = await db.categories.count();
  if (meta.seeded && !force && categoryCount > 0) return;

  await db.transaction('rw', db.categories, db.formulas, db.settings, async () => {
    const puzzleIds = new Set(SEED_FORMULAS.map((f) => f.puzzleId));
    const categoriesByKey = new Map<string, FormulaCategory>();

    for (const puzzleId of puzzleIds) {
      const existing = await db.categories.where('puzzleId').equals(puzzleId).toArray();
      const set = CATEGORY_SETS[puzzleId] ?? CATEGORY_SETS.default;
      for (const cat of set) {
        const found = existing.find((c) => c.name === cat.name);
        if (found) {
          categoriesByKey.set(`${puzzleId}:${cat.name}`, found);
          continue;
        }
        const record: FormulaCategory = {
          id: newId(),
          puzzleId,
          parentId: null,
          name: cat.name,
          sortOrder: cat.sortOrder,
        };
        await db.categories.add(record);
        categoriesByKey.set(`${puzzleId}:${cat.name}`, record);
      }
    }

    for (const seed of SEED_FORMULAS) {
      const existing = await db.formulas.where('puzzleId').equals(seed.puzzleId).toArray();
      if (existing.some((f) => f.title === seed.title && f.alg === seed.alg)) continue;
      const now = new Date().toISOString();
      const record: FormulaRecord = {
        id: newId(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        puzzleId: seed.puzzleId,
        title: seed.title,
        alg: seed.alg,
        setupMode: seed.setupMode,
        setupAlg: '',
        categoryId: categoriesByKey.get(`${seed.puzzleId}:${seed.category}`)?.id ?? '',
        tags: seed.tags,
        description: seed.description,
        favorite: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.formulas.add(record);
    }

    await writeMeta({ seeded: true, schemaVersion: CURRENT_SCHEMA_VERSION });
  });
}
