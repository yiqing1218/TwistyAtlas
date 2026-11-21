/** 下载 cuberoot 的公式集 JSON（api.cuberoot.me/v1/alg/sets/<puzzle>/<set>） */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = resolve(root, 'data/raw/cuberoot');
mkdirSync(outDir, { recursive: true });

const WANTED = [
  ['3x3', 'vls'], ['3x3', 'zbls'], ['3x3', 'ollcp'], ['3x3', 'cls'],
  ['3x3', 'sbls'], ['3x3', 'sv'], ['3x3', 'cmll'], ['3x3', 'ell'],
  ['3x3', 'adv-f2l'], ['3x3', 'psf2l'],
  ['2x2', 'eg1'], ['2x2', 'eg2'], ['2x2', 'ortega-oll'], ['2x2', 'ortega-pbl'],
  ['pyraminx', 'l4e'], ['skewb', 'sarahs-advanced'],
  ['megaminx', 'co'], ['megaminx', 'cp'], ['megaminx', 'eo'], ['megaminx', 'ep'], ['megaminx', 'full-pll'],
  ['sq1', 'co'], ['sq1', 'cp'], ['sq1', 'eo'], ['sq1', 'ep'], ['sq1', 'parity'],
];

for (const [puzzle, set] of WANTED) {
  const file = resolve(outDir, `${puzzle}__${set}.json`);
  if (existsSync(file)) {
    console.log(`跳过（已存在）${puzzle}/${set}`);
    continue;
  }
  const url = `https://api.cuberoot.me/v1/alg/sets/${puzzle}/${set}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (TwistyAtlas data build)' } });
  if (!res.ok) {
    console.log(`失败 ${res.status} ${puzzle}/${set}`);
    continue;
  }
  const text = await res.text();
  writeFileSync(file, text, 'utf-8');
  const cases = JSON.parse(text).cases?.length ?? 0;
  console.log(`OK ${puzzle}/${set} cases=${cases} ${(text.length / 1024).toFixed(0)}KB`);
}
