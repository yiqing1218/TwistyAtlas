/**
 * 架构守护：静态检查分层依赖方向。
 *
 * 规则（违反即退出码 1）：
 *   domain          不得依赖任何其它层，也不得依赖 vue / pinia / dexie / cubing
 *   application     只能依赖 domain（以及 data 资源）
 *   infrastructure  只能依赖 domain（不得依赖 presentation / application）
 *   presentation    可以依赖所有层
 *
 * 另外：`cubing/*` 只能出现在 infrastructure/cubing 内，保证引擎单点收口。
 *
 * 用法：node scripts/check-arch.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = 'src';
const LAYERS = ['domain', 'application', 'infrastructure', 'presentation', 'data'];

const ALLOWED = {
  domain: ['domain'],
  application: ['domain', 'application', 'data'],
  infrastructure: ['domain', 'infrastructure', 'data'],
  presentation: ['domain', 'application', 'infrastructure', 'presentation', 'data'],
};

const FORBIDDEN_IN_DOMAIN = ['vue', 'pinia', 'dexie', 'cubing'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|vue)$/.test(entry)) out.push(full);
  }
  return out;
}

function layerOf(file) {
  const parts = relative(SRC, file).split(sep);
  return LAYERS.includes(parts[0]) ? parts[0] : 'root';
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)(['"])([^'"]+)\1/g;

const violations = [];
let checked = 0;

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf-8');
  const layer = layerOf(file);
  checked += 1;
  let match;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    const spec = match[2];

    // 1) cubing 直接引用只能出现在 infrastructure/cubing
    if (spec.startsWith('cubing/') || spec === 'cubing') {
      const inCubingAdapter = file.split(sep).join('/').includes('infrastructure/cubing/');
      if (!inCubingAdapter) {
        violations.push({ file, spec, reason: 'cubing/* 只能在 infrastructure/cubing 内引用' });
      }
      continue;
    }

    // 2) domain 不得依赖框架
    if (layer === 'domain' && FORBIDDEN_IN_DOMAIN.some((p) => spec === p || spec.startsWith(`${p}/`))) {
      violations.push({ file, spec, reason: 'domain 层不得依赖框架库' });
      continue;
    }

    // 3) 层间依赖方向
    if (spec.startsWith('@/')) {
      const target = spec.slice(2);
      const targetLayer = LAYERS.find((l) => target === l || target.startsWith(`${l}/`));
      if (!targetLayer) continue;
      const allowed = ALLOWED[layer];
      if (allowed && !allowed.includes(targetLayer)) {
        violations.push({
          file: file.split(sep).join('/'),
          spec,
          reason: `${layer} 层不允许依赖 ${targetLayer} 层`,
        });
      }
    }
  }
}

if (violations.length === 0) {
  console.log(`架构检查通过：${checked} 个文件，未发现违规依赖。`);
  process.exit(0);
}

console.error(`架构检查失败：${violations.length} 处违规`);
for (const v of violations) {
  console.error(`  ${v.file}\n    → ${v.spec}  （${v.reason}）`);
}
process.exit(1);
