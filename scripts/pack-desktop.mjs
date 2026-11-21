#!/usr/bin/env node
/**
 * 桌面端打包（Windows x64，免安装目录形态）。
 *
 * 为什么不用 electron-builder：
 *   本机沙箱会对 `fs.rm` 做 safe-delete 拦截，electron-builder 在
 *   `release/win-unpacked.tmp → win-unpacked` 的原子重命名阶段必然失败
 *   （EPERM/EBUSY）。因此这里改为「从 Electron 官方分发 zip 解包 + 手工组装
 *   resources/app」，产物结构与 electron-builder 的 win-unpacked 一致，
 *   可直接运行，也可后续交给 NSIS 打包器再封装安装包。
 *
 * 用法：
 *   node scripts/pack-desktop.mjs            # 组装到 out/TwistyAtlas（覆盖旧产物）
 *
 * 产物：
 *   out/TwistyAtlas/TwistyAtlas.exe         主程序
 *   out/TwistyAtlas/resources/app/**        应用代码（dist + electron）
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const outDir = join(root, 'out', 'TwistyAtlas');
const distDir = join(root, 'dist');

function fail(message) {
  console.error(`\n[打包失败] ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(`[打包] ${message}`);
}

/** 目录尺寸（MB） */
function dirSizeMb(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) total += statSync(full).size;
    }
  }
  return total / 1024 / 1024;
}

if (!existsSync(join(distDir, 'index.html'))) {
  fail('缺少 dist/index.html，请先执行 `npm run build`。');
}

// 1. 定位 Electron 版本与官方分发 zip（electron 的 postinstall 会缓存到 %LOCALAPPDATA%）
const electronPkg = JSON.parse(readFileSync(join(root, 'node_modules', 'electron', 'package.json'), 'utf8'));
const electronVersion = electronPkg.version;
const cacheRoot = join(process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? '', 'AppData', 'Local'), 'electron', 'Cache');

function findElectronZip() {
  if (!existsSync(cacheRoot)) return null;
  const wanted = `electron-v${electronVersion}-win32-x64.zip`;
  for (const bucket of readdirSync(cacheRoot)) {
    const candidate = join(cacheRoot, bucket, wanted);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const zipPath = findElectronZip();
if (!zipPath) {
  fail(
    `未找到 Electron ${electronVersion} 的 win32-x64 分发包。\n` +
      `请先执行一次 \`npx electron --version\` 触发下载，或设置 ELECTRON_MIRROR 后重试。\n` +
      `缓存目录：${cacheRoot}`,
  );
}
log(`Electron ${electronVersion} 分发包：${zipPath}`);

/**
 * 删除文件/目录。沙箱环境会把 fs.rm / fs.rmdir 重定向到回收站，可能失败，
 * 这里一律降级为警告：产物只要能被覆盖生成就不影响结果。
 */
function softRemove(target, options = {}) {
  try {
    rmSync(target, { force: true, ...options });
  } catch (error) {
    console.warn(`[打包] 跳过删除 ${target}（${error.message}）`);
  }
}

// 2. 解包（覆盖式，避免依赖删除）
mkdirSync(outDir, { recursive: true });
log('解包 Electron 运行时…');
try {
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', outDir], { stdio: 'inherit' });
} catch (error) {
  // unzip 在覆盖 default_app.asar 时可能被 Windows（杀软/索引器）短暂占用而退出码 50。
  // resources/app 的优先级高于 default_app.asar，这个残留不影响启动，继续即可。
  const partialOk = existsSync(join(outDir, 'electron.exe'));
  if (!partialOk) fail(`解包 Electron 失败：${error.message}`);
  log('解包有文件被占用（通常是 default_app.asar），已忽略');
}

// 3. 生成主程序（复制而非重命名，Windows 下复制可直接覆盖同名文件）
const electronExe = join(outDir, 'electron.exe');
const appExe = join(outDir, 'TwistyAtlas.exe');
if (!existsSync(electronExe)) fail('解包结果里没有 electron.exe。');
// 用 copyFile（底层 CopyFile，直接覆盖）而不是 cpSync：后者会先 unlink 目标，
// 在沙箱/杀软占用时必然失败。
copyFileSync(electronExe, appExe);
softRemove(electronExe);
log('主程序 → TwistyAtlas.exe');

/**
 * 递归复制。用 copyFileSync（底层 CopyFile，可原地覆盖）而不是 fs.cpSync，
 * 因为 cpSync 覆盖已存在文件前会 unlink，在受限环境里会被拦截。
 */
function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}

// 4. 组装 resources/app
const appDir = join(outDir, 'resources', 'app');
mkdirSync(appDir, { recursive: true });
copyTree(distDir, join(appDir, 'dist'));
copyTree(join(root, 'electron'), join(appDir, 'electron'));

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const appPkg = {
  name: pkg.name,
  productName: 'Twisty Atlas',
  version: pkg.version,
  description: pkg.description,
  main: pkg.main,
  private: true,
  type: pkg.type,
};
writeFileSync(join(appDir, 'package.json'), `${JSON.stringify(appPkg, null, 2)}\n`, 'utf8');

// 5. 清掉 Electron 自带的默认应用，避免误启动
//    （resources/app 优先级高于 default_app.asar，删不掉也不影响启动）
const defaultAsar = join(outDir, 'resources', 'default_app.asar');
if (existsSync(defaultAsar)) softRemove(defaultAsar);

const sizeMb = dirSizeMb(outDir);
log(`完成：${appExe}`);
log(`目录体积：${sizeMb.toFixed(1)} MB`);
console.log(`\n运行：${appExe}`);
