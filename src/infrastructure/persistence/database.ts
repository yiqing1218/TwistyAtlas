import Dexie, { type Table } from 'dexie';
import type { FormulaCategory, FormulaRecord } from '@/domain/model/formula';
import { CURRENT_SCHEMA_VERSION } from '@/domain/model/formula';
import type { AppSettings } from '@/domain/model/settings';
import type { SolveRecord } from '@/domain/model/solve';

export interface SettingsRow {
  id: string;
  value: unknown;
}

export const META_ID = 'meta';
export const SETTINGS_ID = 'app';

export interface MetaValue {
  seeded: boolean;
  schemaVersion: number;
}

export class AtlasDB extends Dexie {
  formulas!: Table<FormulaRecord, string>;
  categories!: Table<FormulaCategory, string>;
  settings!: Table<SettingsRow, string>;
  solves!: Table<SolveRecord, string>;

  constructor(name = 'TwistyAtlasDB') {
    super(name);
    // 索引：puzzleId / categoryId / favorite / updatedAt / 多值 tags
    this.version(1).stores({
      formulas: 'id, puzzleId, categoryId, favorite, updatedAt, *tags, title',
      categories: 'id, puzzleId, parentId, sortOrder',
      settings: 'id',
    });
    // v2：新增计时成绩表。按会话 + 时间做复合索引，滚动统计只读尾部窗口。
    this.version(2).stores({
      formulas: 'id, puzzleId, categoryId, favorite, updatedAt, *tags, title',
      categories: 'id, puzzleId, parentId, sortOrder',
      settings: 'id',
      solves: 'id, sessionId, puzzleId, createdAt, [sessionId+createdAt]',
    });
    this.on('populate', () => {
      // 首次创建数据库时写入元信息，种子数据由 seedDatabase() 负责。
    });
  }
}

export const db = new AtlasDB();

export async function readMeta(): Promise<MetaValue> {
  const row = await db.settings.get(META_ID);
  if (!row || typeof row.value !== 'object' || row.value === null) {
    return { seeded: false, schemaVersion: CURRENT_SCHEMA_VERSION };
  }
  const value = row.value as Partial<MetaValue>;
  return {
    seeded: Boolean(value.seeded),
    schemaVersion: typeof value.schemaVersion === 'number' ? value.schemaVersion : CURRENT_SCHEMA_VERSION,
  };
}

export async function writeMeta(meta: MetaValue): Promise<void> {
  await db.settings.put({ id: META_ID, value: meta });
}

export async function readSettingsRow(): Promise<Partial<AppSettings> | null> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row || typeof row.value !== 'object' || row.value === null) return null;
  return row.value as Partial<AppSettings>;
}

/**
 * 把设置写回 IndexedDB。
 *
 * 注意：Pinia 里拿到的 `settings` 是响应式 Proxy，而 IndexedDB 的结构化克隆
 * 无法克隆 Proxy（会抛 DataCloneError），所以必须先转成普通对象再落库。
 * 这里做一次 JSON 往返，顺带剥掉 undefined 与 Vue 的响应式包装。
 */
export async function writeSettingsRow(settings: AppSettings): Promise<void> {
  const plain = JSON.parse(JSON.stringify(settings)) as AppSettings;
  await db.settings.put({ id: SETTINGS_ID, value: plain });
}
