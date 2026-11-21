/**
 * 把 src 内所有相对导入改写为 `@/` 别名。
 *
 * 目的：分层重构后目录深度变化不再影响 import 路径，且一眼能看出依赖方向
 * （`@/domain/...` 被 `@/application/...` 引用是合法的，反向则不合法）。
 *
 * 用法：node scripts/refactor/to-alias.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';

const srcRoot = resolve(process.cwd(), 'src');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|vue)$/.test(entry)) out.push(full);
  }
  return out;
}

function resolveSpecifier(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const IMPORT_RE = /(from\s+|import\s*\(\s*|import\s+)(['"])(\.[^'"]*)\2/g;

let changed = 0;
for (const file of walk(srcRoot)) {
  const original = readFileSync(file, 'utf-8');
  let text = original;

  text = text.replace(IMPORT_RE, (match, prefix, quote, spec) => {
    const target = resolveSpecifier(file, spec);
    if (!target) return match;
    let alias = '@/' + relative(srcRoot, target).split(sep).join('/');
    const hadVueExt = spec.endsWith('.vue');
    if (!hadVueExt) alias = alias.replace(/\.ts$/, '');
    return `${prefix}${quote}${alias}${quote}`;
  });

  if (text !== original) {
    writeFileSync(file, text, 'utf-8');
    changed += 1;
  }
}

console.log(`改写 ${changed} 个文件的导入路径`);
