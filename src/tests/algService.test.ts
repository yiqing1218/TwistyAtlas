import { describe, expect, it } from 'vitest';
import {
  MAX_EXPANDED_MOVES,
  invertFormula,
  normalizeAlgText,
  parseFormula,
  parseFormulaLocal,
  prefixAlg,
  tokensFromText,
} from '@/infrastructure/cubing/algService';
import { isAlgIdentity, patternAtStep, patternSignature } from '@/infrastructure/cubing/cubingBridge';

describe('normalizeAlgText', () => {
  it('把常见 Unicode 弯撇规范化为英文直撇', () => {
    expect(normalizeAlgText('R’ U’ F’')).toBe("R' U' F'");
    expect(normalizeAlgText('Rʼ U′')).toBe("R' U'");
  });

  it('压缩多余空白但保留动作分隔', () => {
    expect(normalizeAlgText('  R   U\u3000R\'  ')).toBe("R U R'");
  });

  it('不改变数字含义', () => {
    expect(normalizeAlgText('R2 U2')).toBe('R2 U2');
  });
});

describe('parseFormulaLocal', () => {
  it('接受基本动作并产生与动作一一对应的 token', () => {
    const parsed = parseFormulaLocal("R U R' U'");
    expect(parsed.ok).toBe(true);
    expect(parsed.tokens).toHaveLength(4);
    expect(parsed.tokens.map((t) => t.text)).toEqual(['R', 'U', "R'", "U'"]);
    expect(parsed.tokens[2].readable).toContain('右层');
  });

  it('展开括号重复为真实动作数', () => {
    const parsed = parseFormulaLocal('(R U)3');
    expect(parsed.ok).toBe(true);
    expect(parsed.tokens).toHaveLength(6);
  });

  it('支持交换子语法并展开为真实动作', () => {
    const parsed = parseFormulaLocal("[R, U]");
    expect(parsed.ok).toBe(true);
    expect(parsed.tokens.map((t) => t.text)).toEqual(['R', 'U', "R'", "U'"]);
  });

  it('拒绝空公式', () => {
    const parsed = parseFormulaLocal('   ');
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('不能为空');
  });

  it('拒绝无法解析的字符并给出位置', () => {
    const parsed = parseFormulaLocal('R U ? U');
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBeTruthy();
  });

  it('超过动作上限时拒绝', () => {
    const long = 'R U '.repeat(MAX_EXPANDED_MOVES);
    const parsed = parseFormulaLocal(long);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('超过上限');
  });
});

describe('tokensFromText / invertFormula / prefixAlg', () => {
  it('逆公式为代数逆序', () => {
    expect(invertFormula("R U R' U'")).toBe('U R U\' R\'');
  });

  it('前缀只取前 k 个动作', () => {
    expect(prefixAlg("R U R' U'", 2)).toBe('R U');
    expect(prefixAlg("R U R' U'", 0)).toBe('');
    expect(prefixAlg("R U R' U'", 99)).toBe("R U R' U'");
  });

  it('tokens 序号连续', () => {
    const tokens = tokensFromText('R U2');
    expect(tokens.map((t) => t.index)).toEqual([0, 1]);
  });
});

describe('使用 KPuzzle 校验真实状态（3×3）', () => {
  it('R 连续 4 次回到复原态', async () => {
    await expect(isAlgIdentity('3x3x3', 'R R R R')).resolves.toBe(true);
  });

  it('R2 连续 2 次回到复原态', async () => {
    await expect(isAlgIdentity('3x3x3', 'R2 R2')).resolves.toBe(true);
  });

  it('R R\' 与 U U\' 是单位变换', async () => {
    await expect(isAlgIdentity('3x3x3', "R R'")).resolves.toBe(true);
    await expect(isAlgIdentity('3x3x3', "U U'")).resolves.toBe(true);
  });

  it('A + A^-1 恢复状态', async () => {
    const alg = "R U R' U' F2 D";
    const inverted = invertFormula(alg);
    await expect(isAlgIdentity('3x3x3', `${alg} ${inverted}`)).resolves.toBe(true);
  });

  it('R 只影响右层：状态与复原态不同，但 R4 相同于复原态', async () => {
    const solved = await patternSignature('3x3x3', '');
    const afterR = await patternSignature('3x3x3', 'R');
    expect(afterR.json).not.toBe(solved.json);
    const r4 = await patternSignature('3x3x3', 'R R R R');
    expect(r4.json).toBe(solved.json);
  });

  it('逐步状态与完整公式一致：第 N 步 = 完整公式结果', async () => {
    const alg = "R U R' U F2";
    const full = await patternSignature('3x3x3', alg);
    const lastStep = await patternAtStep('3x3x3', alg, 5);
    expect(lastStep).toBe(full.json);
  });

  it('setup 参与初态计算：inverse 模式下播放到第 N 步回到复原态', async () => {
    const alg = "R U R' U'";
    const solved = (await patternSignature('3x3x3', '')).json;
    // 初始态 = 逆公式作用后的打乱态；因此第 0 步不是复原态
    const initial = await patternAtStep('3x3x3', alg, 0, invertFormula(alg));
    expect(initial).not.toBe(solved);
    // 播放完 alg 后回到复原态
    const last = await patternAtStep('3x3x3', alg, 4, invertFormula(alg));
    expect(last).toBe(solved);
  });

  it('solved 模式下第 0 步就是复原态', async () => {
    const solved = (await patternSignature('3x3x3', '')).json;
    expect(await patternAtStep('3x3x3', "R U R' U'", 0)).toBe(solved);
  });

  it('不同魔方的同一文本会得到不同的合法性结论', async () => {
    const onThree = await parseFormula('M E S', '3x3x3');
    expect(onThree.ok).toBe(true);
    const onTwo = await parseFormula('M', '2x2x2');
    expect(onTwo.ok).toBe(false);
    expect(onTwo.error).toContain('不支持动作');
  });

  it('非法动作不会静默通过', async () => {
    const parsed = await parseFormula('R U X', '3x3x3');
    expect(parsed.ok).toBe(false);
  });

  it('高阶宽层记号合法', async () => {
    const parsed = await parseFormula("3Rw U2 3Rw'", '7x7x7');
    expect(parsed.ok).toBe(true);
    expect(parsed.tokens).toHaveLength(3);
  });

  it('Square-1 使用独立语法 (a,b)/ 而不是三阶面转', async () => {
    const parsed = await parseFormula('(1,0) / (3,0)', 'square1');
    expect(parsed.ok).toBe(true);
    const wrong = await parseFormula("R U R' U'", 'square1');
    expect(wrong.ok).toBe(false);
  });
});
