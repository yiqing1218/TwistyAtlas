import Papa from 'papaparse';
import type {
  BackupBundle,
  FormulaCategory,
  FormulaRecord,
  ImportPreview,
  ImportPreviewItem,
  SetupMode,
} from '@/domain/model/formula';
import { CURRENT_SCHEMA_VERSION } from '@/domain/model/formula';
import { db, readSettingsRow } from '@/infrastructure/persistence/database';
import {
  newId,
  sanitizeTags,
  sanitizeText,
  sanitizeUrl,
  toPlainFormulaRecord as toPlainRecord,
} from '@/infrastructure/persistence/formulaRepository';
import { parseFormula } from '@/infrastructure/cubing/algService';
import { getPuzzleDescriptor } from '@/infrastructure/cubing/puzzleRegistry';

export const BACKUP_FORMAT = 'twisty-atlas-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const SETUP_MODES: SetupMode[] = ['solved', 'inverse', 'explicit'];

export type ImportStrategy = 'skip' | 'overwrite' | 'new';

export interface ImportResult {
  added: number;
  overwritten: number;
  skipped: number;
  failed: number;
}

function isoNow(): string {
  return new Date().toISOString();
}

function isValidIso(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString();
}

/** 逐字段白名单转换，避免原型污染与未知字段写入数据库 */
function normalizeRecord(raw: unknown, index: number): { record?: FormulaRecord; issues: string[] } {
  const issues: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { issues: [`第 ${index + 1} 条记录不是对象`] };
  }
  const source = raw as Record<string, unknown>;

  const title = sanitizeText(source.title, 120);
  if (!title) issues.push('缺少公式名称');

  const alg = sanitizeText(source.alg, 10_000);
  if (!alg) issues.push('缺少公式内容');

  const puzzleId = sanitizeText(source.puzzleId, 40) || '3x3x3';
  if (!getPuzzleDescriptor(puzzleId)) issues.push(`未知的魔方类型：${puzzleId}`);

  const setupModeRaw = sanitizeText(source.setupMode, 20) || 'solved';
  const setupMode = (SETUP_MODES as string[]).includes(setupModeRaw)
    ? (setupModeRaw as SetupMode)
    : 'solved';
  if (setupMode !== setupModeRaw) issues.push(`未知的初始状态模式：${setupModeRaw}`);

  const setupAlg = setupMode === 'explicit' ? sanitizeText(source.setupAlg, 10_000) : '';
  if (setupMode === 'explicit' && !setupAlg) issues.push('自定义初始状态缺少 setup 公式');

  const difficultyRaw = source.difficulty;
  let difficulty: number | undefined;
  if (difficultyRaw !== undefined && difficultyRaw !== null && `${difficultyRaw}`.trim() !== '') {
    const value = Number(difficultyRaw);
    if (Number.isInteger(value) && value >= 1 && value <= 5) difficulty = value;
    else issues.push('难度必须是 1~5 的整数');
  }

  if (issues.length > 0) return { issues };

  const now = isoNow();
  const record: FormulaRecord = {
    id: sanitizeText(source.id, 80) || newId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    puzzleId,
    title,
    alg,
    setupMode,
    setupAlg,
    categoryId: sanitizeText(source.categoryId, 80),
    tags: sanitizeTags(source.tags),
    description: sanitizeText(source.description, 5000),
    sourceName: sanitizeText(source.sourceName, 200) || undefined,
    sourceUrl: sanitizeUrl(source.sourceUrl),
    favorite: source.favorite === true || source.favorite === 'true' || source.favorite === 1,
    difficulty,
    createdAt: isValidIso(source.createdAt) ?? now,
    updatedAt: isValidIso(source.updatedAt) ?? now,
  };
  return { record, issues };
}

function normalizeCategory(raw: unknown): FormulaCategory | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const id = sanitizeText(source.id, 80);
  const puzzleId = sanitizeText(source.puzzleId, 40);
  const name = sanitizeText(source.name, 40);
  if (!id || !puzzleId || !name) return null;
  const parentId = sanitizeText(source.parentId, 80);
  const sortOrder = Number(source.sortOrder);
  return {
    id,
    puzzleId,
    parentId: parentId || null,
    name,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  };
}

export async function buildBackup(includeSettings = true): Promise<BackupBundle> {
  const formulas = await db.formulas.toArray();
  const categories = await db.categories.toArray();
  const settings = includeSettings ? await readSettingsRow() : null;
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: isoNow(),
    appVersion: '1.0.0',
    formulas,
    categories,
    settings: settings ? { ...settings } : undefined,
  };
}

export function backupFileName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `twisty-atlas-backup-${iso}.json`;
}

export function csvFileName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `twisty-atlas-formulas-${iso}.csv`;
}

export function downloadTextFile(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportJson(includeSettings = true): Promise<void> {
  const bundle = await buildBackup(includeSettings);
  downloadTextFile(backupFileName(), JSON.stringify(bundle, null, 2), 'application/json;charset=utf-8');
}

const CSV_COLUMNS = [
  'puzzleId',
  'title',
  'alg',
  'setupMode',
  'setupAlg',
  'category',
  'tags',
  'description',
  'sourceUrl',
] as const;

/** CSV 使用 RFC 4180 规则（由 Papa Parse 负责引号与换行转义），并写入 BOM 便于 Excel 打开中文 */
export async function formulasToCsv(records?: FormulaRecord[]): Promise<string> {
  const list = records ?? (await db.formulas.toArray());
  const categories = await db.categories.toArray();
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const rows = list.map((r) => ({
    puzzleId: r.puzzleId,
    title: r.title,
    alg: r.alg,
    setupMode: r.setupMode,
    setupAlg: r.setupAlg,
    category: categoryName.get(r.categoryId) ?? '',
    tags: JSON.stringify(r.tags),
    description: r.description,
    sourceUrl: r.sourceUrl ?? '',
  }));
  const csv = Papa.unparse({ fields: [...CSV_COLUMNS], data: rows }, { newline: '\r\n' });
  return `\ufeff${csv}`;
}

export async function exportCsv(): Promise<void> {
  const csv = await formulasToCsv();
  downloadTextFile(csvFileName(), csv, 'text/csv;charset=utf-8');
}

/** 解析标签字段：优先 JSON 数组，其次 `|` 分隔，最后按单一标签处理 */
export function parseTagsField(value: unknown): string[] {
  if (Array.isArray(value)) return sanitizeTags(value);
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return sanitizeTags(parsed);
    } catch {
      /* 落到下面的分隔符处理 */
    }
  }
  return sanitizeTags(trimmed.split('|'));
}

export interface ParseMediaOptions {
  /** 文件类型，用于错误提示 */
  fileName?: string;
}

export async function parseImportText(
  text: string,
  format: 'json' | 'csv',
  options: ParseMediaOptions = {},
): Promise<ImportPreview> {
  if (text.length > MAX_IMPORT_BYTES) {
    throw new Error(`文件超过 ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB 上限`);
  }
  if (format === 'json') {
    return parseJsonImport(text, options);
  }
  return parseCsvImport(text, options);
}

async function parseJsonImport(text: string, options: ParseMediaOptions): Promise<ImportPreview> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON 解析失败：${(err as Error).message}`);
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('备份文件内容不是一个对象');
  }
  const bundle = data as Record<string, unknown>;
  if (bundle.format !== BACKUP_FORMAT) {
    throw new Error(`不是 Twisty Atlas 备份文件（format=${String(bundle.format ?? '缺失')}）`);
  }
  const version = Number(bundle.formatVersion);
  if (!Number.isFinite(version) || version > BACKUP_FORMAT_VERSION) {
    throw new Error(`备份格式版本 ${String(bundle.formatVersion)} 高于当前支持的 ${BACKUP_FORMAT_VERSION}`);
  }
  const rawFormulas = Array.isArray(bundle.formulas) ? bundle.formulas : null;
  if (!rawFormulas) throw new Error('备份文件缺少 formulas 数组');

  const rawCategories = Array.isArray(bundle.categories) ? bundle.categories : [];
  const categories = rawCategories
    .map((c) => normalizeCategory(c))
    .filter((c): c is FormulaCategory => c !== null);

  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const items: ImportPreviewItem[] = [];
  for (let i = 0; i < rawFormulas.length; i += 1) {
    const { record, issues } = normalizeRecord(rawFormulas[i], i);
    if (!record) {
      items.push({
        kind: 'invalid',
        reason: issues.join('，'),
        record: emptyRecord(rawFormulas[i]),
      });
      continue;
    }
    const parsed = await parseFormula(record.alg, record.puzzleId);
    if (!parsed.ok) {
      items.push({
        kind: 'invalid',
        reason: `公式无效：${parsed.error ?? ''}`,
        record,
      });
      continue;
    }
    if (record.categoryId && !categoriesById.has(record.categoryId)) {
      const existing = await db.categories.get(record.categoryId);
      if (!existing) {
        record.categoryId = '';
      }
    }
    items.push({ kind: 'new', record });
  }

  const preview: ImportPreview = {
    total: rawFormulas.length,
    items,
    categories,
    settings:
      typeof bundle.settings === 'object' && bundle.settings !== null
        ? (bundle.settings as Record<string, unknown>)
        : undefined,
    format: 'json',
  };
  await detectDuplicates(preview, options);
  return preview;
}

function emptyRecord(raw: unknown): FormulaRecord {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    id: sanitizeText(source.id, 80) || newId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    puzzleId: sanitizeText(source.puzzleId, 40) || '3x3x3',
    title: sanitizeText(source.title, 120) || '（无法识别的记录）',
    alg: sanitizeText(source.alg, 10_000),
    setupMode: 'solved',
    setupAlg: '',
    categoryId: '',
    tags: [],
    description: '',
    favorite: false,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };
}

async function parseCsvImport(text: string, options: ParseMediaOptions): Promise<ImportPreview> {
  const cleaned = text.replace(/^\ufeff/, '');
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV 第 ${(first.row ?? 0) + 2} 行解析失败：${first.message}`);
  }
  const rows = parsed.data ?? [];
  if (rows.length === 0) throw new Error('CSV 中没有数据行');

  const items: ImportPreviewItem[] = [];
  const unknownCategories = new Map<string, FormulaCategory>();
  const existingCategories = await db.categories.toArray();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const categoryName = sanitizeText(row.category, 40);
    let categoryId = '';
    if (categoryName) {
      const puzzleId = sanitizeText(row.puzzleId, 40) || '3x3x3';
      const match = existingCategories.find(
        (c) => c.puzzleId === puzzleId && c.name.toLowerCase() === categoryName.toLowerCase(),
      );
      if (match) {
        categoryId = match.id;
      } else {
        const key = `${puzzleId}:${categoryName}`;
        const pending = unknownCategories.get(key);
        if (pending) {
          categoryId = pending.id;
        } else {
          const category: FormulaCategory = {
            id: newId(),
            puzzleId,
            parentId: null,
            name: categoryName,
            sortOrder: existingCategories.filter((c) => c.puzzleId === puzzleId).length + unknownCategories.size,
          };
          unknownCategories.set(key, category);
          categoryId = category.id;
        }
      }
    }

    const raw = {
      puzzleId: row.puzzleId,
      title: row.title,
      alg: row.alg,
      setupMode: row.setupMode,
      setupAlg: row.setupAlg,
      categoryId,
      tags: parseTagsField(row.tags),
      description: row.description,
      sourceUrl: row.sourceUrl,
    };
    const { record, issues } = normalizeRecord(raw, i);
    if (!record) {
      items.push({ kind: 'invalid', reason: issues.join('，'), record: emptyRecord(raw) });
      continue;
    }
    const parsedAlg = await parseFormula(record.alg, record.puzzleId);
    if (!parsedAlg.ok) {
      items.push({ kind: 'invalid', reason: `公式无效：${parsedAlg.error ?? ''}`, record });
      continue;
    }
    items.push({ kind: 'new', record });
  }

  const preview: ImportPreview = {
    total: rows.length,
    items,
    categories: [...unknownCategories.values()],
    format: 'csv',
  };
  await detectDuplicates(preview, options);
  return preview;
}

async function detectDuplicates(preview: ImportPreview, _options: ParseMediaOptions): Promise<void> {
  const existing = await db.formulas.toArray();
  const byId = new Map(existing.map((r) => [r.id, r]));
  const byContent = new Map<string, FormulaRecord>();
  for (const record of existing) {
    byContent.set(contentKey(record), record);
  }
  for (const item of preview.items) {
    if (item.kind === 'invalid') continue;
    const sameId = byId.get(item.record.id);
    const sameContent = byContent.get(contentKey(item.record));
    if (sameId) {
      item.kind = 'duplicate';
      item.duplicateOfId = sameId.id;
      item.reason = 'ID 与现有公式重复';
    } else if (sameContent) {
      item.kind = 'duplicate';
      item.duplicateOfId = sameContent.id;
      item.reason = '内容与现有公式重复（同魔方、同公式、同初始状态）';
    }
  }
}

export function contentKey(record: ContentKeySource): string {
  return [record.puzzleId, record.alg.replace(/\s+/g, ' ').trim(), record.setupMode, record.setupAlg.trim()]
    .join('|')
    .toLowerCase();
}

interface ContentKeySource {
  puzzleId: string;
  alg: string;
  setupMode: string;
  setupAlg: string;
}

/** 分类同样需要重建为纯对象，原因见 toPlainFormulaRecord 的说明。 */
function toPlainCategory(category: FormulaCategory): FormulaCategory {
  return {
    id: category.id,
    puzzleId: category.puzzleId,
    parentId: category.parentId,
    name: category.name,
    sortOrder: category.sortOrder,
  };
}

/**
 * 应用导入：整个写入在 Dexie 事务中完成，任何异常都会回滚，不留下半截数据。
 */
export async function applyImport(
  preview: ImportPreview,
  strategy: ImportStrategy,
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, overwritten: 0, skipped: 0, failed: 0 };

  await db.transaction('rw', db.formulas, db.categories, async () => {
    for (const category of preview.categories) {
      const plain = toPlainCategory(category);
      const existing = await db.categories.get(plain.id);
      if (!existing) await db.categories.add(plain);
    }

    for (const item of preview.items) {
      if (item.kind === 'invalid') {
        result.failed += 1;
        continue;
      }
      if (item.kind === 'duplicate') {
        if (strategy === 'skip') {
          result.skipped += 1;
          continue;
        }
        if (strategy === 'overwrite') {
          const targetId = item.duplicateOfId ?? item.record.id;
          const existing = await db.formulas.get(targetId);
          if (!existing) {
            await db.formulas.add(toPlainRecord(item.record));
            result.added += 1;
            continue;
          }
          await db.formulas.put({
            ...toPlainRecord(item.record),
            id: targetId,
            createdAt: existing.createdAt,
            updatedAt: isoNow(),
          });
          result.overwritten += 1;
          continue;
        }
        // strategy === 'new'：作为新记录导入
        await db.formulas.add({ ...toPlainRecord(item.record), id: newId(), updatedAt: isoNow() });
        result.added += 1;
        continue;
      }
      // kind === 'new'
      const plain = toPlainRecord(item.record);
      const exists = await db.formulas.get(plain.id);
      if (exists) {
        await db.formulas.put({ ...plain, id: newId() });
      } else {
        await db.formulas.add(plain);
      }
      result.added += 1;
    }
  });

  return result;
}
