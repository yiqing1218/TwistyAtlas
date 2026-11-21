/**
 * 解析 speedcubedb.com 的公式页（服务端渲染 HTML）。
 *
 * 已验证的页面特征：
 * - 每条公式包在 `<div class="formatted-alg">…</div>`
 * - F2L 页每个案例形如 `F2L 12 … setup:</div>F R' F' R</div> … 公式们`
 * - 4x4/5x5 页面没有 setup，公式按页面顺序排列
 */

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
  '&Prime;': '"',
  '&prime;': "'",
};

export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|#39|#x27|nbsp|Prime|prime);/g, (m) => ENTITIES[m] ?? m);
}

function cleanAlg(raw) {
  const text = decodeEntities(raw.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  // scdb 有些单元格把标签词和公式渲染在同一个 div 里，例如 "Parity Rw U2 ..."
  return text.replace(/^(?:Parity|OLL|PLL|ZBLL|COLL|Case\s*\d+)\s*[:：]?\s*/i, '').trim();
}

function collectAlgs(segment) {
  const out = [];
  const re = /class="formatted-alg"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(segment)) !== null) {
    const alg = cleanAlg(m[1]);
    if (alg) out.push(alg);
  }
  return out;
}

/** 解析带 setup 的用例页（F2L） */
export function parseScdbCasesWithSetup(html, { puzzleId, setId, displayName }) {
  const setupRe = /setup:<\/div>([\s\S]{0,80}?)<\/div>/g;
  const setups = [];
  let m;
  while ((m = setupRe.exec(html)) !== null) {
    setups.push({ setup: cleanAlg(m[1]), start: m.index, end: m.index + m[0].length });
  }

  const cases = [];
  for (let i = 0; i < setups.length; i += 1) {
    const segStart = setups[i].end;
    const segEnd = i + 1 < setups.length ? setups[i + 1].start : html.length;
    const before = html.slice(Math.max(0, setups[i].start - 4000), setups[i].start);
    const titleMatches = [...before.matchAll(/\b(?:F2L|VLS|ZBLS|OLL|PLL|COLL|WV|CLS)\s*\d+\b/g)];
    const title = titleMatches.length > 0 ? titleMatches[titleMatches.length - 1][0].replace(/\s+/g, ' ') : `Case ${i + 1}`;
    const algs = collectAlgs(html.slice(segStart, segEnd));
    if (algs.length === 0) continue;
    cases.push({ caseName: title, group: '', setupAlg: setups[i].setup, algs });
  }

  return { setId, puzzleId, displayName, setupMode: 'explicit', cases };
}

/** 解析只有公式列表的页面（4x4 奇偶、5x5 L2E） */
export function parseScdbFlatList(html, { puzzleId, setId, displayName, casePrefix }) {
  const algs = collectAlgs(html);
  return {
    setId,
    puzzleId,
    displayName,
    setupMode: 'inverse',
    cases: algs.map((alg, index) => ({
      caseName: `${casePrefix} ${index + 1}`,
      group: '',
      setupAlg: '',
      algs: [alg],
    })),
  };
}
