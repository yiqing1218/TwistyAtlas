import { describe, expect, it } from 'vitest';
import {
  BOTTOM_COLOR_ORDER,
  rotationForBottom,
  withBottom,
  type BottomColor,
} from '@/domain/model/orientation';

describe('演示底面（共轭旋转）', () => {
  it('默认黄底不改变公式', () => {
    expect(rotationForBottom('yellow')).toBe('');
    expect(withBottom("R U R' U'", 'yellow')).toBe("R U R' U'");
  });

  it('每种颜色都映射到"把该色转到 D 面"的旋转', () => {
    expect(rotationForBottom('white')).toBe('x2');
    expect(rotationForBottom('blue')).toBe('x');
    expect(rotationForBottom('green')).toBe("x'");
    expect(rotationForBottom('red')).toBe('z');
    expect(rotationForBottom('orange')).toBe("z'");
    // 六种颜色都要有映射，且非默认颜色都不是空
    for (const color of BOTTOM_COLOR_ORDER) {
      const rotation = rotationForBottom(color as BottomColor);
      expect(color === 'yellow' ? rotation === '' : rotation !== '').toBe(true);
    }
  });

  it('非默认底面使用共轭 A\' = R A R⁻¹（前后旋转必须互逆）', () => {
    expect(withBottom("R U R' U'", 'white')).toBe("x2 R U R' U' x2");
    expect(withBottom('R U', 'blue')).toBe("x R U x'");
    expect(withBottom('R U', 'green')).toBe("x' R U x");
    expect(withBottom('R U', 'red')).toBe("z R U z'");
    expect(withBottom('R U', 'orange')).toBe("z' R U z");
  });

  it('空公式不会被塞进多余的旋转', () => {
    expect(withBottom('', 'white')).toBe('');
    expect(withBottom('   ', 'blue')).toBe('');
  });

  it('旋转与逆旋转成对出现（保证终态回到复原而不是被转乱）', () => {
    const text = withBottom('F R U', 'blue');
    const tokens = text.split(' ');
    expect(tokens[0]).toBe('x');
    expect(tokens[tokens.length - 1]).toBe("x'");
  });
});
