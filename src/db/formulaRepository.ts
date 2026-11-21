import type {
  FormulaCategory,
  FormulaDraft,
  FormulaFilter,
  FormulaRecord,
} from '../types/formula';
import { CURRENT_SCHEMA_VERSION } from '../types/formula';
import { db } from './database';
import { parseFormula } from '../engine/algService';
import { getPuzzleDescriptor } from '../engine/puzzleRegistry';

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface DraftValidation {
  ok: boolean;
  issues: ValidationIssue[];
  normalizedAlg?: string;
}

export const DEFAULT_FILTER: FormulaFilter = {
  puzzleId: null,
  categoryId: null,
  favoriteOnly: false,
  tag: null,
  search: '',
  sortBy: 'updatedAt',
};

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 5000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 30;

export function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

/** 只允许 http / https 链接，阻止 javascript: 等危险协议。 */
export function sanitizeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').slice(0, maxLength).trim();
}

/** 表单/导入共用的字段校验与规范化 */
export async function validateDraft(draft: FormulaDraft): Promise<DraftValidation> {
  const issues: ValidationIssue[] = [];
  const title = sanitizeText(draft.title, MAX_TITLE);
  if (!title) issues.push({ field: 'title', message: '公式名称不能为空' });

  const descriptor = getPuzzleDescriptor(draft.puzzleId);
  if (!descriptor) {
    issues.push({ field: 'puzzleId', message: `未注册的魔方类型：${draft.puzzleId}` });
  }

  let normalizedAlg: string | undefined;
  if (!draft.alg.trim()) {
    issues.push({ field: 'alg', message: '公式不能为空' });
  } else if (descriptor) {
    const parsed = await parseFormula(draft.alg, draft.puzzleId);
    if (!parsed.ok) {
      issues.push({ field: 'alg', message: parsed.error ?? '公式无效' });
    } else {
      normalizedAlg = parsed.normalized;
    }
  }

  if (draft.setupMode === 'explicit') {
    if (!draft.setupAlg.trim()) {
      issues.push({ field: 'setupAlg', message: '自定义初始状态必须填写 setup 公式' });
    } else if (descriptor) {
      const setupParsed = await parseFormula(draft.setupAlg, draft.puzzleId);
      if (!setupParsed.ok) {
        issues.push({
          field: 'setupAlg',
          message: `setup 公式无效：${setupParsed.error ?? ''}`,
        });
      }
    }
  }

  if (draft.description && draft.description.length > MAX_DESCRIPTION) {
    issues.push({ field: 'description', message: `说明不得超过 ${MAX_DESCRIPTION} 字` });
  }
  if (draft.sourceUrl && !sanitizeUrl(draft.sourceUrl)) {
    issues.push({ field: 'sourceUrl', message: '来源链接必须是 http(s) 地址' });
  }
  if (draft.difficulty !== undefined) {
    const d = draft.difficulty;
    if (!Number.isInteger(d) || d < 1 || d > 5) {
      issues.push({ field: 'difficulty', message: '难度必须是 1~5 的整数' });
    }
  }
  if (draft.categoryId) {
    const category = await db.categories.get(draft.categoryId);
    if (!category) {
      issues.push({ field: 'categoryId', message: '所选分类不存在' });
    } else if (category.puzzleId !== draft.puzzleId) {
      issues.push({ field: 'categoryId', message: '所选分类不属于当前魔方类型' });
    }
  }

  return { ok: issues.length === 0, issues, normalizedAlg };
}

function draftToRecord(draft: FormulaDraft, base?: FormulaRecord): FormulaRecord {
  const now = new Date().toISOString();
  return {
    id: base?.id ?? newId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    puzzleId: draft.puzzleId,
    title: sanitizeText(draft.title, MAX_TITLE),
    alg: draft.alg.trim(),
    setupMode: draft.setupMode,
    setupAlg: draft.setupMode === 'explicit' ? draft.setupAlg.trim() : '',
    categoryId: draft.categoryId || '',
    tags: sanitizeTags(draft.tags),
    description: sanitizeText(draft.description, MAX_DESCRIPTION),
    sourceName: sanitizeText(draft.sourceName ?? '', 200) || undefined,
    sourceUrl: sanitizeUrl(draft.sourceUrl),
    favorite: Boolean(draft.favorite),
    difficulty: draft.difficulty,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };
}

export function recordToDraft(record: FormulaRecord): FormulaDraft {
  return {
    puzzleId: record.puzzleId,
    title: record.title,
    alg: record.alg,
    setupMode: record.setupMode,
    setupAlg: record.setupAlg,
    categoryId: record.categoryId,
    tags: [...record.tags],
    description: record.description,
    sourceName: record.sourceName ?? '',
    sourceUrl: record.sourceUrl ?? '',
    favorite: record.favorite,
    difficulty: record.difficulty,
  };
}

export async function createFormula(draft: FormulaDraft): Promise<FormulaRecord> {
  const validation = await validateDraft(draft);
  if (!validation.ok) {
    throw new Error(validation.issues.map((i) => i.message).join('；'));
  }
  const record = draftToRecord({ ...draft, alg: validation.normalizedAlg ?? draft.alg });
  await db.formulas.add(record);
  return record;
}

export async function updateFormula(id: string, draft: FormulaDraft): Promise<FormulaRecord> {
  const existing = await db.formulas.get(id);
  if (!existing) throw new Error('公式不存在或已被删除');
  const validation = await validateDraft(draft);
  if (!validation.ok) {
    throw new Error(validation.issues.map((i) => i.message).join('；'));
  }
  const record = draftToRecord({ ...draft, alg: validation.normalizedAlg ?? draft.alg }, existing);
  await db.formulas.put(record);
  return record;
}

export async function duplicateFormula(id: string): Promise<FormulaRecord> {
  const existing = await db.formulas.get(id);
  if (!existing) throw new Error('公式不存在或已被删除');
  const copy: FormulaRecord = {
    ...existing,
    id: newId(),
    title: `${existing.title}（副本）`.slice(0, MAX_TITLE),
    favorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.formulas.add(copy);
  return copy;
}

export async function deleteFormula(id: string): Promise<void> {
  await db.formulas.delete(id);
}

/**
 * 重建为纯对象再写库。
 * 来自 Vue 响应式状态（Pinia/ref）的记录是 Proxy，IndexedDB 不能结构化克隆 Proxy，
 * 直接写入会抛 DataCloneError。
 */
export function toPlainFormulaRecord(record: FormulaRecord): FormulaRecord {
  return {
    id: record.id,
    schemaVersion: record.schemaVersion,
    puzzleId: record.puzzleId,
    title: record.title,
    alg: record.alg,
    setupMode: record.setupMode,
    setupAlg: record.setupAlg,
    categoryId: record.categoryId,
    tags: Array.from(record.tags ?? []),
    description: record.description,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    favorite: Boolean(record.favorite),
    difficulty: record.difficulty,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function restoreFormula(record: FormulaRecord): Promise<void> {
  await db.formulas.put(toPlainFormulaRecord(record));
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await db.formulas.update(id, { favorite, updatedAt: new Date().toISOString() });
}

export async function getFormula(id: string): Promise<FormulaRecord | undefined> {
  return db.formulas.get(id);
}

function matchesSearch(record: FormulaRecord, search: string): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [record.title, record.alg, record.description, record.setupAlg, record.sourceName ?? '', ...record.tags]
    .join('\n')
    .toLowerCase();
  return haystack.includes(needle);
}

export async function listFormulas(filter: Partial<FormulaFilter> = {}): Promise<FormulaRecord[]> {
  const merged: FormulaFilter = { ...DEFAULT_FILTER, ...filter };
  let collection = merged.puzzleId
    ? db.formulas.where('puzzleId').equals(merged.puzzleId)
    : db.formulas.toCollection();
  let records = await collection.toArray();

  if (merged.favoriteOnly) records = records.filter((r) => r.favorite);
  if (merged.categoryId) records = records.filter((r) => r.categoryId === merged.categoryId);
  if (merged.tag) {
    const tag = merged.tag.toLowerCase();
    records = records.filter((r) => r.tags.some((t) => t.toLowerCase() === tag));
  }
  if (merged.search) records = records.filter((r) => matchesSearch(r, merged.search));

  const categoryOrder = new Map((await db.categories.toArray()).map((c) => [c.id, c.sortOrder]));
  records.sort((a, b) => {
    if (merged.sortBy === 'title') return a.title.localeCompare(b.title, 'zh-Hans-CN');
    if (merged.sortBy === 'category') {
      const diff = (categoryOrder.get(a.categoryId) ?? 999) - (categoryOrder.get(b.categoryId) ?? 999);
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title, 'zh-Hans-CN');
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return records;
}

export async function countFormulas(): Promise<number> {
  return db.formulas.count();
}

export async function listCategories(puzzleId?: string): Promise<FormulaCategory[]> {
  const all = puzzleId
    ? await db.categories.where('puzzleId').equals(puzzleId).toArray()
    : await db.categories.toArray();
  return all.sort((a, b) => {
    if (a.puzzleId !== b.puzzleId) return a.puzzleId.localeCompare(b.puzzleId);
    return a.sortOrder - b.sortOrder;
  });
}

export async function createCategory(
  puzzleId: string,
  name: string,
  parentId: string | null = null,
): Promise<FormulaCategory> {
  const trimmed = sanitizeText(name, 40);
  if (!trimmed) throw new Error('分类名称不能为空');
  const existing = await db.categories.where('puzzleId').equals(puzzleId).toArray();
  const category: FormulaCategory = {
    id: newId(),
    puzzleId,
    parentId,
    name: trimmed,
    sortOrder: existing.length,
  };
  await db.categories.add(category);
  return category;
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const trimmed = sanitizeText(name, 40);
  if (!trimmed) throw new Error('分类名称不能为空');
  await db.categories.update(id, { name: trimmed });
}

export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.formulas, async () => {
    // 分类被删除时，公式保留但分类置空，避免悬空引用
    await db.formulas.where('categoryId').equals(id).modify({ categoryId: '' });
    await db.categories.delete(id);
  });
}

export async function listTags(puzzleId?: string): Promise<string[]> {
  const records = puzzleId
    ? await db.formulas.where('puzzleId').equals(puzzleId).toArray()
    : await db.formulas.toArray();
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const tag of record.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export async function clearFormulas(): Promise<void> {
  await db.formulas.clear();
}
