<script setup lang="ts">
/**
 * 七段数码显示（SVG）。
 *
 * csTimer 的大计时数字是分段式字形，这里用纯 SVG 画出来：
 * 好处是任意分辨率都锐利、体积为零、可以按主题换色。
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 形如 "3:40.079" / "12.345" / "DNF" / "+2" */
    value: string;
    height?: number;
    color?: string;
  }>(),
  { height: 148, color: 'var(--timer-digit, #12161c)' },
);

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

const T = 13; // 笔画厚度
const LEFT = 14;
const RIGHT = 86;
const TOP = 12;
const MID = 90;
const BOTTOM = 168;

/** 水平段：两端 45° 斜切 */
function hseg(x0: number, x1: number, y: number): string {
  const h = T / 2;
  return [
    [x0 + h, y - h],
    [x1 - h, y - h],
    [x1, y],
    [x1 - h, y + h],
    [x0 + h, y + h],
    [x0, y],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

/** 垂直段：两端 45° 斜切 */
function vseg(x: number, y0: number, y1: number): string {
  const h = T / 2;
  return [
    [x, y0],
    [x + h, y0 + h],
    [x + h, y1 - h],
    [x, y1],
    [x - h, y1 - h],
    [x - h, y0 + h],
  ]
    .map((p) => p.join(','))
    .join(' ');
}

const SEGMENTS: Record<Seg, string> = {
  a: hseg(LEFT, RIGHT, TOP),
  g: hseg(LEFT, RIGHT, MID),
  d: hseg(LEFT, RIGHT, BOTTOM),
  f: vseg(LEFT, TOP, MID),
  b: vseg(RIGHT, TOP, MID),
  e: vseg(LEFT, MID, BOTTOM),
  c: vseg(RIGHT, MID, BOTTOM),
};

const DIGIT_MAP: Record<string, Seg[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

interface Glyph {
  kind: 'digit' | 'colon' | 'dot' | 'dash' | 'letter';
  char: string;
  segs: Seg[];
  width: number;
}

const COLON_WIDTH = 46;
const DOT_WIDTH = 46;

const glyphs = computed<Glyph[]>(() => {
  const chars = [...props.value];
  const list: Glyph[] = [];
  for (const char of chars) {
    if (char === ':') {
      list.push({ kind: 'colon', char, segs: [], width: COLON_WIDTH });
    } else if (char === '.' || char === ',') {
      list.push({ kind: 'dot', char, segs: [], width: DOT_WIDTH });
    } else if (char === '-') {
      list.push({ kind: 'dash', char, segs: ['g'], width: 100 });
    } else if (DIGIT_MAP[char]) {
      list.push({ kind: 'digit', char, segs: DIGIT_MAP[char], width: 100 });
    } else {
      list.push({ kind: 'letter', char, segs: [], width: 70 });
    }
  }
  return list;
});

const totalWidth = computed(() => glyphs.value.reduce((sum, g) => sum + g.width, 0) + Math.max(0, glyphs.value.length - 1) * 8);
const scale = computed(() => props.height / 180);
</script>

<template>
  <svg
    class="seg"
    :viewBox="`0 0 ${Math.max(1, totalWidth)} 180`"
    :style="{ height: `${height}px`, width: 'auto' }"
    role="img"
    :aria-label="value"
    preserveAspectRatio="xMidYMid meet"
  >
    <g :fill="color" transform="skewX(-6) translate(6, 0)">
      <template v-for="(glyph, index) in glyphs" :key="`${glyph.char}-${index}`">
        <g :transform="`translate(${glyphs.slice(0, index).reduce((s, g) => s + g.width + 8, 0)}, 0)`">
          <template v-if="glyph.kind === 'digit' || glyph.kind === 'dash'">
            <polygon v-for="seg in glyph.segs" :key="seg" :points="SEGMENTS[seg]" />
          </template>
          <template v-else-if="glyph.kind === 'colon'">
            <rect x="42" y="58" width="15" height="15" />
            <rect x="42" y="118" width="15" height="15" />
          </template>
          <template v-else-if="glyph.kind === 'dot'">
            <rect x="42" y="160" width="15" height="15" />
          </template>
          <template v-else>
            <text x="4" y="132" :font-size="scale > 0 ? 96 : 96" font-family="ui-monospace, monospace" font-weight="700">
              {{ glyph.char }}
            </text>
          </template>
        </g>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.seg {
  display: block;
  overflow: visible;
  /* 轻微右倾，接近 csTimer 的字形观感 */
  font-variant-numeric: tabular-nums;
}
</style>
