/**
 * 演示朝向（"以什么当底"）。
 *
 * 速拧圈里同一条公式常按不同配色书写：有人习惯白底、有人黄底、也有人蓝底。
 * 公式里的 `R/U/F` 指的是**立方体自己的面**，所以"换底"本质上是换观察视角：
 * 同一串动作，只是整体转了个方向。
 *
 * 数学上要保证"播放到终点依然是复原态"，必须做**共轭**而不是简单加前缀：
 *
 *   A' = R · A · R⁻¹        （R 为整体旋转，A 为原公式）
 *
 * 这样 R 与 A 的旋转部分互相抵消，结果只是整体被转了一次：
 * 视觉上仍然是"六面同色"，但朝下的面变成了所选颜色。
 *
 * 直接写 `R · A` 会让旋转累积到终态，看起来像"转乱了"，所以不能那样做。
 */

export type BottomColor = 'white' | 'yellow' | 'blue' | 'green' | 'red' | 'orange';

export const BOTTOM_COLOR_ORDER: BottomColor[] = ['yellow', 'white', 'blue', 'green', 'red', 'orange'];

export const BOTTOM_COLOR_LABEL: Record<BottomColor, string> = {
  yellow: '黄底（默认）',
  white: '白底',
  blue: '蓝底',
  green: '绿底',
  red: '红底',
  orange: '橙底',
};

export const BOTTOM_COLOR_SWATCH: Record<BottomColor, string> = {
  yellow: '#ffd500',
  white: '#ffffff',
  blue: '#0046ad',
  green: '#009b48',
  red: '#b71234',
  orange: '#ff5800',
};

/**
 * 标准配色：U 白 / D 黄 / F 绿 / B 蓝 / R 红 / L 橙。
 * 返回值是把该颜色转到 D 面所需的整体旋转（"" 表示不用转）。
 *
 * 推导：
 *   x  → F 到 U、U 到 B、B 到 D、D 到 F  → 蓝落到 D
 *   x' → 绿落到 D
 *   x2 → 白落到 D
 *   z  → R 到 D、U 到 R、D 到 L、L 到 U → 红落到 D
 *   z' → 橙落到 D
 */
export function rotationForBottom(bottom: BottomColor): string {
  switch (bottom) {
    case 'yellow':
      return '';
    case 'white':
      return 'x2';
    case 'blue':
      return 'x';
    case 'green':
      return "x'";
    case 'red':
      return 'z';
    case 'orange':
      return "z'";
    default:
      return '';
  }
}

const INVERSE_ROTATION: Record<string, string> = {
  x: "x'",
  "x'": 'x',
  x2: 'x2',
  y: "y'",
  "y'": 'y',
  y2: 'y2',
  z: "z'",
  "z'": 'z',
  z2: 'z2',
};

/** 把公式按所选底面做共轭；空公式原样返回 */
export function withBottom(alg: string, bottom: BottomColor): string {
  const text = alg.trim();
  if (!text) return text;
  const rotation = rotationForBottom(bottom);
  if (!rotation) return text;
  const inverse = INVERSE_ROTATION[rotation] ?? rotation;
  return `${rotation} ${text} ${inverse}`;
}
