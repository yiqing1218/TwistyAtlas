import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/infrastructure/persistence/database';
import {
  createCategory,
  createFormula,
  deleteCategory,
  deleteFormula,
  duplicateFormula,
  getFormula,
  listCategories,
  listFormulas,
  listTags,
  restoreFormula,
  sanitizeTags,
  sanitizeUrl,
  setFavorite,
  updateFormula,
  validateDraft,
} from '@/infrastructure/persistence/formulaRepository';
import type { FormulaDraft } from '@/domain/model/formula';
import { EMPTY_DRAFT } from '@/domain/model/formula';

function draft(patch: Partial<FormulaDraft> = {}): FormulaDraft {
  return {
    ...EMPTY_DRAFT,
    title: '右手四步',
    alg: "R U R' U'",
    ...patch,
  };
}

beforeEach(async () => {
  await db.formulas.clear();
  await db.categories.clear();
  await db.settings.clear();
});

describe('字段校验', () => {
  it('拒绝空标题', async () => {
    const result = await validateDraft(draft({ title: '   ' }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.field === 'title')).toBe(true);
  });

  it('拒绝无效公式并给出原因', async () => {
    const result = await validateDraft(draft({ alg: 'R U ?' }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.field === 'alg')).toBe(true);
  });

  it('拒绝当前魔方不支持的动作', async () => {
    const result = await validateDraft(draft({ puzzleId: '2x2x2', alg: 'M' }));
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain('不支持动作');
  });

  it('explicit 模式必须提供 setup', async () => {
    const result = await validateDraft(draft({ setupMode: 'explicit', setupAlg: '' }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.field === 'setupAlg')).toBe(true);
  });

  it('explicit 模式校验 setup 的合法性', async () => {
    const ok = await validateDraft(draft({ setupMode: 'explicit', setupAlg: 'R U2' }));
    expect(ok.ok).toBe(true);
    const bad = await validateDraft(draft({ setupMode: 'explicit', setupAlg: 'R U ?' }));
    expect(bad.ok).toBe(false);
  });

  it('拒绝非 http(s) 的来源链接', async () => {
    const result = await validateDraft(draft({ sourceUrl: 'javascript:alert(1)' }));
    expect(result.ok).toBe(false);
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('https://example.com/a')).toBe('https://example.com/a');
  });

  it('标签去重、去空、限制数量', () => {
    expect(sanitizeTags(['基础', '基础', ' 手法 ', '', 1 as unknown as string])).toEqual(['基础', '手法']);
    expect(sanitizeTags(Array.from({ length: 40 }, (_, i) => `t${i}`))).toHaveLength(20);
  });

  it('难度必须是 1~5', async () => {
    const bad = await validateDraft(draft({ difficulty: 9 }));
    expect(bad.ok).toBe(false);
  });
});

describe('CRUD 与持久化', () => {
  it('创建后可读取，字段完整', async () => {
    const record = await createFormula(draft({ tags: ['基础'], description: '多行\n说明' }));
    const loaded = await getFormula(record.id);
    expect(loaded?.title).toBe('右手四步');
    expect(loaded?.schemaVersion).toBe(1);
    expect(loaded?.tags).toEqual(['基础']);
    expect(loaded?.description).toBe('多行\n说明');
    expect(loaded?.createdAt).toBe(record.createdAt);
  });

  it('solved 模式不会保存 setupAlg', async () => {
    const record = await createFormula(draft({ setupMode: 'solved', setupAlg: 'R U' }));
    expect(record.setupAlg).toBe('');
  });

  it('编辑保留 createdAt 并更新 updatedAt', async () => {
    const record = await createFormula(draft());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await updateFormula(record.id, draft({ title: '改名了' }));
    expect(updated.title).toBe('改名了');
    expect(updated.createdAt).toBe(record.createdAt);
    expect(updated.updatedAt >= record.updatedAt).toBe(true);
  });

  it('编辑不存在的记录会报错', async () => {
    await expect(updateFormula('nope', draft())).rejects.toThrow('不存在');
  });

  it('删除后可以通过 restore 撤销', async () => {
    const record = await createFormula(draft());
    await deleteFormula(record.id);
    expect(await getFormula(record.id)).toBeUndefined();
    await restoreFormula(record);
    expect(await getFormula(record.id)).toBeDefined();
  });

  it('复制生成新 id 与"（副本）"标题', async () => {
    const record = await createFormula(draft());
    const copy = await duplicateFormula(record.id);
    expect(copy.id).not.toBe(record.id);
    expect(copy.title).toContain('副本');
  });

  it('收藏状态可以切换', async () => {
    const record = await createFormula(draft());
    await setFavorite(record.id, true);
    expect((await getFormula(record.id))?.favorite).toBe(true);
  });
});

describe('检索与筛选', () => {
  beforeEach(async () => {
    const basic = await createCategory('3x3x3', '基础');
    const oll = await createCategory('3x3x3', 'OLL');
    await createFormula(
      draft({ title: '右手四步', categoryId: basic.id, tags: ['手法'], favorite: true }),
    );
    await createFormula(
      draft({ title: 'OLL 演示', alg: "R U R' U R U2 R'", categoryId: oll.id, tags: ['OLL'] }),
    );
    await createFormula(draft({ puzzleId: '2x2x2', title: '二阶手法', tags: ['二阶'] }));
  });

  it('按魔方类型隔离', async () => {
    const three = await listFormulas({ puzzleId: '3x3x3' });
    expect(three).toHaveLength(2);
    const two = await listFormulas({ puzzleId: '2x2x2' });
    expect(two).toHaveLength(1);
  });

  it('按标题/公式/标签搜索', async () => {
    expect((await listFormulas({ puzzleId: '3x3x3', search: '右手' }))).toHaveLength(1);
    expect((await listFormulas({ puzzleId: '3x3x3', search: 'U2' }))).toHaveLength(1);
    expect((await listFormulas({ puzzleId: '3x3x3', search: '手法' }))).toHaveLength(1);
  });

  it('按分类与收藏筛选', async () => {
    const categories = await listCategories('3x3x3');
    const oll = categories.find((c) => c.name === 'OLL');
    expect((await listFormulas({ puzzleId: '3x3x3', categoryId: oll?.id }))).toHaveLength(1);
    expect((await listFormulas({ puzzleId: '3x3x3', favoriteOnly: true }))).toHaveLength(1);
  });

  it('按标签筛选且不区分大小写', async () => {
    expect((await listFormulas({ puzzleId: '3x3x3', tag: 'oll' }))).toHaveLength(1);
  });

  it('标签列表按出现次数排序', async () => {
    const tags = await listTags('3x3x3');
    expect(tags).toContain('手法');
    expect(tags).toContain('OLL');
  });

  it('删除分类不删除公式，只清空 categoryId', async () => {
    const categories = await listCategories('3x3x3');
    const oll = categories.find((c) => c.name === 'OLL');
    await deleteCategory(oll!.id);
    const records = await listFormulas({ puzzleId: '3x3x3' });
    const affected = records.find((r) => r.title === 'OLL 演示');
    expect(affected).toBeDefined();
    expect(affected?.categoryId).toBe('');
  });
});
