import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/infrastructure/persistence/database';
import { createFormula, listFormulas } from '@/infrastructure/persistence/formulaRepository';
import {
  applyImport,
  buildBackup,
  contentKey,
  formulasToCsv,
  parseImportText,
  parseTagsField,
} from '@/infrastructure/persistence/importExport';
import { EMPTY_DRAFT, type FormulaDraft } from '@/domain/model/formula';

function draft(patch: Partial<FormulaDraft> = {}): FormulaDraft {
  return { ...EMPTY_DRAFT, title: '右手四步', alg: "R U R' U'", ...patch };
}

beforeEach(async () => {
  await db.formulas.clear();
  await db.categories.clear();
  await db.settings.clear();
});

describe('JSON 备份', () => {
  it('导出包含格式头、公式与分类', async () => {
    await createFormula(draft());
    const bundle = await buildBackup(true);
    expect(bundle.format).toBe('twisty-atlas-backup');
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.formulas).toHaveLength(1);
    expect(bundle.exportedAt).toMatch(/T/);
  });

  it('导出 → 清库 → 导入后字段逐项一致', async () => {
    const record = await createFormula(
      draft({
        title: '带逗号, 与撇号 R\'',
        setupMode: 'explicit',
        setupAlg: 'R U2',
        tags: ['基础', '中文'],
        description: '第一行\n第二行，还有逗号, 和引号"',
        sourceName: '来源',
        sourceUrl: 'https://example.com/doc',
        difficulty: 3,
        favorite: true,
      }),
    );
    const json = JSON.stringify(await buildBackup(true));

    await db.formulas.clear();
    expect(await db.formulas.count()).toBe(0);

    const preview = await parseImportText(json, 'json');
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0].kind).toBe('new');
    const result = await applyImport(preview, 'skip');
    expect(result.added).toBe(1);

    const loaded = (await listFormulas({})).find((f) => f.id === record.id);
    expect(loaded).toBeDefined();
    expect(loaded?.title).toBe(record.title);
    expect(loaded?.alg).toBe(record.alg);
    expect(loaded?.setupMode).toBe('explicit');
    expect(loaded?.setupAlg).toBe('R U2');
    expect(loaded?.tags).toEqual(['基础', '中文']);
    expect(loaded?.description).toBe(record.description);
    expect(loaded?.sourceUrl).toBe('https://example.com/doc');
    expect(loaded?.difficulty).toBe(3);
    expect(loaded?.favorite).toBe(true);
    expect(loaded?.createdAt).toBe(record.createdAt);
  });

  it('拒绝错误的格式标识', async () => {
    await expect(parseImportText('{"format":"other","formulas":[]}', 'json')).rejects.toThrow(
      '不是 Twisty Atlas 备份文件',
    );
  });

  it('拒绝高于当前支持的格式版本', async () => {
    await expect(
      parseImportText('{"format":"twisty-atlas-backup","formatVersion":99,"formulas":[]}', 'json'),
    ).rejects.toThrow('高于当前支持');
  });

  it('拒绝损坏的 JSON', async () => {
    await expect(parseImportText('{oops', 'json')).rejects.toThrow('JSON 解析失败');
  });

  it('标记非法公式而不是静默导入', async () => {
    const payload = JSON.stringify({
      format: 'twisty-atlas-backup',
      formatVersion: 1,
      formulas: [{ title: '坏公式', alg: 'R U ?', puzzleId: '3x3x3' }],
    });
    const preview = await parseImportText(payload, 'json');
    expect(preview.items[0].kind).toBe('invalid');
    const result = await applyImport(preview, 'skip');
    expect(result.failed).toBe(1);
    expect(await db.formulas.count()).toBe(0);
  });

  it('忽略未知字段以阻止原型污染', async () => {
    const payload = `{
      "format": "twisty-atlas-backup",
      "formatVersion": 1,
      "formulas": [{ "title": "注入", "alg": "R", "puzzleId": "3x3x3", "__proto__": { "polluted": true } }]
    }`;
    const preview = await parseImportText(payload, 'json');
    await applyImport(preview, 'skip');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const stored = (await listFormulas({}))[0] as unknown as Record<string, unknown>;
    expect(stored.polluted).toBeUndefined();
  });

  it('恶意 HTML 只作为文本保存', async () => {
    const payload = JSON.stringify({
      format: 'twisty-atlas-backup',
      formatVersion: 1,
      formulas: [
        {
          title: '<img src=x onerror="window.__xss=1">',
          alg: 'R',
          puzzleId: '3x3x3',
          description: '<script>window.__xss=1</script>',
        },
      ],
    });
    const preview = await parseImportText(payload, 'json');
    await applyImport(preview, 'skip');
    const stored = (await listFormulas({}))[0];
    expect(stored.title).toContain('<img');
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });
});

describe('CSV 导入导出', () => {
  it('导出包含 BOM 并使用 RFC 4180 转义', async () => {
    await createFormula(draft({ title: '带,逗号', description: '第一行\n第二行' }));
    const csv = await formulasToCsv();
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"带,逗号"');
    expect(csv).toContain('"第一行\n第二行"');
  });

  it('导出 → 清库 → 导入保持字段一致', async () => {
    await createFormula(
      draft({
        title: '中文标题 R\'',
        tags: ['标签A', '标签B'],
        description: '包含逗号, 与\n换行',
        setupMode: 'inverse',
      }),
    );
    const csv = await formulasToCsv();
    await db.formulas.clear();

    const preview = await parseImportText(csv, 'csv');
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0].kind).toBe('new');
    await applyImport(preview, 'skip');
    const stored = (await listFormulas({}))[0];
    expect(stored.title).toBe("中文标题 R'");
    expect(stored.tags).toEqual(['标签A', '标签B']);
    expect(stored.description).toBe('包含逗号, 与\n换行');
    expect(stored.setupMode).toBe('inverse');
  });

  it('标签字段同时支持 JSON 数组与 | 分隔', () => {
    expect(parseTagsField('["a","b"]')).toEqual(['a', 'b']);
    expect(parseTagsField('a|b')).toEqual(['a', 'b']);
    expect(parseTagsField('单个')).toEqual(['单个']);
  });

  it('未知分类名会被创建并关联', async () => {
    const csv =
      'puzzleId,title,alg,setupMode,setupAlg,category,tags,description,sourceUrl\n' +
      '3x3x3,测试,R,solved,,新分类,["a"],,';
    const preview = await parseImportText(csv, 'csv');
    expect(preview.categories.some((c) => c.name === '新分类')).toBe(true);
    await applyImport(preview, 'skip');
    const categories = await db.categories.toArray();
    expect(categories.some((c) => c.name === '新分类')).toBe(true);
    const stored = (await listFormulas({}))[0];
    expect(stored.categoryId).toBe(preview.categories[0].id);
  });

  it('缺少必填字段的行被标记为无效', async () => {
    const csv = 'puzzleId,title,alg\n3x3x3,,R\n';
    const preview = await parseImportText(csv, 'csv');
    expect(preview.items[0].kind).toBe('invalid');
  });
});

describe('重复处理策略', () => {
  async function setupDuplicate() {
    const record = await createFormula(draft({ title: '原有公式' }));
    const backup = JSON.stringify(await buildBackup(true));
    return { record, backup };
  }

  it('skip：跳过重复，不覆盖原记录', async () => {
    const { record, backup } = await setupDuplicate();
    const preview = await parseImportText(backup, 'json');
    expect(preview.items[0].kind).toBe('duplicate');
    const result = await applyImport(preview, 'skip');
    expect(result.skipped).toBe(1);
    const stored = await db.formulas.get(record.id);
    expect(stored?.title).toBe('原有公式');
  });

  it('overwrite：用导入内容覆盖同一条记录', async () => {
    const { record, backup } = await setupDuplicate();
    const bundle = JSON.parse(backup) as { formulas: { title: string }[] };
    bundle.formulas[0].title = '导入的新名称';
    const preview = await parseImportText(JSON.stringify(bundle), 'json');
    const result = await applyImport(preview, 'overwrite');
    expect(result.overwritten).toBe(1);
    const stored = await db.formulas.get(record.id);
    expect(stored?.title).toBe('导入的新名称');
    expect(await db.formulas.count()).toBe(1);
  });

  it('new：作为新记录导入，产生两条', async () => {
    const { backup } = await setupDuplicate();
    const preview = await parseImportText(backup, 'json');
    const result = await applyImport(preview, 'new');
    expect(result.added).toBe(1);
    expect(await db.formulas.count()).toBe(2);
  });

  it('内容相同但 id 不同也会识别为重复', () => {
    expect(
      contentKey({ puzzleId: '3x3x3', alg: "R  U R' U'", setupMode: 'solved', setupAlg: '' }),
    ).toBe(contentKey({ puzzleId: '3x3x3', alg: "R U R' U'", setupMode: 'solved', setupAlg: '' }));
  });
});
