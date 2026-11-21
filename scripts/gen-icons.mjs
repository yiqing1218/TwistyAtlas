/**
 * 生成 PWA 图标（纯 Node，无第三方依赖）。
 * 用法：node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n += 1) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelAt) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const i = y * stride + 1 + x * 4;
      const p = pixelAt(x, y);
      raw[i] = p[0];
      raw[i + 1] = p[1];
      raw[i + 2] = p[2];
      raw[i + 3] = p[3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  255,
];

const BG = hex('#161a22');
const TOP = hex('#ffd500');
const LEFT = hex('#2f9e63');
const RIGHT = hex('#d63b3b');

function makeIcon(size) {
  const u = size / 512;
  const cx = 256 * u;
  const cy = 256 * u;
  const W = 158 * u;
  const H = W * 0.577;
  const top = [
    [cx, cy - 2 * H],
    [cx + W, cy - H],
    [cx, cy],
    [cx - W, cy - H],
  ];
  const left = [
    [cx - W, cy - H],
    [cx, cy],
    [cx, cy + 2 * H],
    [cx - W, cy + H],
  ];
  const right = [
    [cx + W, cy - H],
    [cx + W, cy + H],
    [cx, cy + 2 * H],
    [cx, cy],
  ];
  const radius = size * 0.2;
  return (x, y) => {
    const dx = Math.max(radius - x, 0, x - (size - radius));
    const dy = Math.max(radius - y, 0, y - (size - radius));
    if (dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];
    if (inPoly(x, y, top)) return TOP;
    if (inPoly(x, y, left)) return LEFT;
    if (inPoly(x, y, right)) return RIGHT;
    return BG;
  };
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), png(size, makeIcon(size)));
}
console.log(`icons written to ${outDir}`);
