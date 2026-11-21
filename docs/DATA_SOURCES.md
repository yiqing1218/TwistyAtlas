# 内置公式集：来源、校验与已知缺口

数据不是手工抄的，也不是模型生成的：由 `scripts/data/*` 从可公开访问的来源抓取 →
解析 → **用 cubing.js 的真实 KPuzzle 逐条校验** → 产出 `src/data/algsets.json`。
被剔除的条目全部记录在 `data/verified/rejected.json`，可审计。

重新生成：

```bash
npm run data:build
# 输出：data/verified/{algsets.json,rejected.json,report.json} + src/data/algsets.json
```

---

## 1. 总量

| 指标 | 数值 |
|---|---|
| 公式集 | **37 套** |
| 案例 | **2433** |
| 公式（去重前） | **13667 条** |
| 通过引擎结构校验 | **9357 条**（68.5%） |
| 仅通过解析（公式合法但未能证明结构性质） | **4310 条** |
| 被剔除 | **399 条**（全部有原因记录） |

按分类：

| 分类 | 套数 | 内容 |
|---|---|---|
| 三阶 · CFOP 主线 | 5 | OLL 57、PLL 21、2-Look OLL 10、2-Look PLL 6、F2L 41 |
| 三阶 · 进阶体系 | 13 | COLL 40、WV 26、ZBLL/1LLL 472、VLS 189、ZBLS 291、OLLCP 342、CLS 97、SBLS 65、SV 27、CMLL 42、ELL 25、Advanced F2L 54、Pseudo F2L 33 |
| 二阶 | 5 | CLL 42、EG-1 40、EG-2 40、Ortega OLL 7、Ortega PBL 9 |
| 四阶 / 五阶 | 3 | 4×4 OLL Parity 9、4×4 PLL Parity 52、5×5 L2E 31 |
| 金字塔 / 五魔方 / SQ-1 | 11 | 金字塔 L4E 49；五魔方 CO/CP/EO/EP/PLL；SQ-1 CO/CP/EO/EP/Parity |

明细：

| 集合 id | 魔方 | 案例 | 公式 | 校验级别 | 来源 | 初始态 |
|---|---|---|---|---|---|---|
| `cfop-oll` | 3x3x3 | 57 | 98 | structural 98 | J Perm | inverse |
| `cfop-pll` | 3x3x3 | 21 | 55 | structural 55 | J Perm | inverse |
| `cfop-2look-oll` | 3x3x3 | 10 | 17 | structural 17 | J Perm | inverse |
| `cfop-2look-pll` | 3x3x3 | 6 | 11 | structural 11 | J Perm | inverse |
| `f2l` | 3x3x3 | 41 | 585 | structural 585 | SpeedCubeDB | explicit |
| `coll` | 3x3x3 | 40 | 50 | structural 50 | J Perm | inverse |
| `wv` | 3x3x3 | 26 | 28 | parsed 28 | J Perm | inverse |
| `zbll` | 3x3x3 | 472 | 6481 | structural 6481 | Roman Strakhov · zbll-trainer | inverse |
| `vls` | 3x3x3 | 189 | 587 | structural 254 / parsed 333 | CubeRoot | explicit |
| `zbls` | 3x3x3 | 291 | 1684 | structural 298 / parsed 1386 | CubeRoot | explicit |
| `ollcp` | 3x3x3 | 342 | 1111 | structural 199 / parsed 912 | CubeRoot | explicit |
| `cls` | 3x3x3 | 97 | 184 | parsed 120 / structural 64 | CubeRoot | explicit |
| `sbls` | 3x3x3 | 65 | 223 | structural 65 / parsed 158 | CubeRoot | explicit |
| `sv` | 3x3x3 | 27 | 58 | parsed 25 / structural 33 | CubeRoot | explicit |
| `cmll` | 3x3x3 | 42 | 178 | structural 63 / parsed 115 | CubeRoot | explicit |
| `ell` | 3x3x3 | 25 | 115 | structural 115 | CubeRoot | explicit |
| `adv-f2l` | 3x3x3 | 54 | 598 | structural 46 / parsed 552 | CubeRoot | explicit |
| `psf2l` | 3x3x3 | 33 | 33 | structural 33 | CubeRoot | explicit |
| `cll-2x2` | 2x2x2 | 42 | 51 | structural 51 | J Perm | inverse |
| `eg1-2x2` | 2x2x2 | 40 | 308 | parsed 112 / structural 196 | CubeRoot | explicit |
| `eg2-2x2` | 2x2x2 | 40 | 263 | structural 133 / parsed 130 | CubeRoot | explicit |
| `ortega-oll` | 2x2x2 | 7 | 27 | structural 11 / parsed 16 | CubeRoot | explicit |
| `ortega-pbl` | 2x2x2 | 9 | 82 | structural 49 / parsed 33 | CubeRoot | explicit |
| `parity-4x4-oll` | 4x4x4 | 9 | 9 | parsed 9 | SpeedCubeDB | inverse |
| `parity-4x4-pll` | 4x4x4 | 52 | 52 | parsed 52 | SpeedCubeDB | inverse |
| `l2e-5x5` | 5x5x5 | 31 | 31 | parsed 31 | SpeedCubeDB | inverse |
| `pyra-l4e` | pyraminx | 49 | 200 | structural 116 / parsed 84 | CubeRoot | explicit |
| `mega-co` | megaminx | 16 | 32 | structural 16 / parsed 16 | CubeRoot | explicit |
| `mega-cp` | megaminx | 15 | 15 | structural 15 | CubeRoot | explicit |
| `mega-eo` | megaminx | 3 | 3 | structural 3 | CubeRoot | explicit |
| `mega-ep` | megaminx | 5 | 5 | structural 5 | CubeRoot | explicit |
| `mega-pll` | megaminx | 151 | 273 | parsed 119 / structural 154 | CubeRoot | explicit |
| `sq1-co` | square1 | 7 | 13 | structural 7 / parsed 6 | CubeRoot | explicit |
| `sq1-cp` | square1 | 8 | 19 | parsed 9 / structural 10 | CubeRoot | explicit |
| `sq1-eo` | square1 | 7 | 15 | structural 8 / parsed 7 | CubeRoot | explicit |
| `sq1-ep` | square1 | 99 | 168 | structural 111 / parsed 57 | CubeRoot | explicit |
| `sq1-parity` | square1 | 5 | 5 | structural 5 | CubeRoot | explicit |

`structural` = 除"能被引擎解析"外，还满足该集合的结构判据（见下一节）。
`parsed` = 引擎能解析、动作在该魔方上合法，但没有更强的结构结论——**页面会如实标注**，
不会把 `parsed` 显示成"已校验"。

CubeRoot 来源的集合在构建期**已经做过完整判据**（`preVerified: true`：`solved · setup · alg · [AUF] == solved`，
AUF ∈ `U / U2 / U'`），因此不再套用三阶专属的 F2L 判据，只保留"引擎能否解析 + 动作是否合法"这一层。

---

## 2. 判据（每条公式都要过）

判定对象是「对复原态施加该公式后的**状态**」，而不是"公式解的那个情况"。

| 集合 | 判据 | 为什么 |
|---|---|---|
| OLL / 2-Look OLL | `requireF2l` | OLL 本来就要改顶层朝向，不能要求"结果顶层已定向"；只要"只动顶层" |
| PLL / 2-Look PLL | `requireF2l` + `requireOriented` | PLL 在顶层已定向的前提下只换位置 |
| COLL | `requireF2l` + `requireEdgeOriented`，并**标记** `llEdgesIdentity` | COLL 会重排角块朝向（这是它的工作），但不应改棱块朝向；某些来源混入 CMLL 公式会改棱块排列 → 打上"会改动棱块排列"标签，不隐藏 |
| ZBLL | `requireF2l` + `requireEdgeOriented` | 逐条实测显示这批公式保持棱块定向、却不保持角块定向 → 按可证明的性质设判据，名称标注为「ZBLL · 1LLL 家族（棱块已定向）」 |
| CLL(2×2) | `requireF2l` | 二阶没有棱块，只要求第一层不动 |
| F2L | `requireF2lAfterSetup` | 先摆出 case 的 setup，再执行公式，要求前两层还原；四个朝向（原样、`y`、`y'`、`y2` 共轭）逐个尝试，命中即采纳 |
| VLS / ZBLS / OLLCP / CLS / SBLS / SV / CMLL / ELL / Advanced F2L / Pseudo F2L | 闭合判据：`solved · setup · alg · AUF == solved` | 这些集合的"正确性"是相对自己声明的 setup 而言，比任何三阶子目标判据都更严格 |
| 二阶 EG-1 / EG-2 / Ortega | 同上（闭合判据） | 二阶没有棱块，且 EG 的每个 case 有明确的底面朝向 |
| 金字塔 L4E / 五魔方 CO,CP,EO,EP,PLL / SQ-1 CO,CP,EO,EP,Parity | 同上（闭合判据） | 异形魔方的层结构不同，用三阶判据必然误判 |
| 4×4 Parity / 5×5 L2E | 仅解析合法 | 这两类公式依赖高阶魔方的中棱/翼棱结构，用三阶 F2L 判据不成立 |

### 2.1 整体旋转不再误杀公式（v1.2 修复）

`x / y / z` 是整体旋转，在 KPuzzle 里会把**每个块**搬到别的槽位，
于是"前两层是否还原"的判定会把 `x R' U R' D2 R U' R' D2 R2`（A-perm）这类写法全部误杀。

修正方式不是简单删掉旋转，而是**净旋转归零**：

```
A' = A · R⁻¹      （R = 公式中按顺序出现的所有旋转记号串联）
```

对 `A'` 做块级判定，等价于"忽略观察方向后，这条公式是否只动顶层"。
展示给用户的仍是原始公式。

效果：PLL 从 18 例 36 条 → **21 例 55 条（完整 PLL）**；F2L 从 562 → 585 条；
被拒条目从 114 → 68 条。

### 2.2 中心块不算"未还原"

`M / E / S` 这类中层转会置换中心块。标准配色下中心块换位肉眼不可见，
若把它算进"前两层还原"会让大量正确公式（如 `M2 U M2 U2 M2 U M2`，H-perm）被误判。
因此判定只考察 `CORNERS` / `EDGES` 轨道。

### 2.3 Square-1 记号归一化

CubeRoot 的 SQ-1 公式写作 `1,0/3,0`，cubing.js 要求 `(1,0) / (3,0)`。
解析器统一补括号、补空格后再交给引擎；归一化失败即记入 `rejected.json`，不做"猜"。

---

## 3. 来源与署名

| id | 站点/仓库 | 用途 | 说明 |
|---|---|---|---|
| `SRC-JPERM` | [J Perm](https://jperm.net/) | OLL、PLL、2-Look OLL/PLL、COLL、WV、2×2 CLL | 取其 `/lib/*.js` 数据集，在 Node `vm` 中求值取结构化字段；仅保存公式文本与署名 |
| `SRC-SCDB` | [SpeedCubeDB](https://speedcubedb.com/) | F2L（含 setup）、4×4 OLL/PLL Parity、5×5 L2E | 解析 HTML 中 `class="formatted-alg"` 与 `setup:` 字段 |
| `SRC-ZBLL-TRAINER` | [Roman Strakhov / zbll-trainer](https://github.com/Roman-/zbll-trainer) | ZBLL 472 例 | 公开仓库的 `zbllMap` |
| `SRC-CUBEROOT` | [CubeRoot](https://cuberoot.me/)（`api.cuberoot.me/v1`） | VLS、ZBLS、OLLCP、CLS、SBLS、SV、CMLL、ELL、Advanced/Pseudo F2L、二阶 EG/Ortega、金字塔 L4E、五魔方、SQ-1 | 官方 JSON 接口 `GET /v1/alg/sets/<puzzle>/<set>`，脚本 `scripts/data/fetch-cuberoot.mjs` 落盘到 `data/raw/cuberoot/` 后离线解析 |

所有条目在详情面板显示「来源」与访问日期（`accessedAt` 由构建脚本写入）。
本项目**未搬运**任何站点的图片、排版或视频，只保存公式文本 + 归属信息。

---

## 4. 已知缺口（如实记录）

| 缺口 | 现状 | 尝试过什么 |
|---|---|---|
| **VLS（Valk Last Slot）** | **已收录 189 例 / 587 条** | v1.2 时确认 J Perm 404、SpeedCubeDB 无结构化数据、speedcube.quest 是 React Flight payload；v1.3 改用 CubeRoot 的 JSON 接口后拿到并逐条校验 |
| HLS（Hessler Last Slot） | 未收录 | CubeRoot 也没有对应集合；公开来源只有视频/PDF，无结构化数据 |
| 4×4 OLL Parity | 12 例中收录 9 例 | 被拒的 3 条含 `M` 类中层记号或来源标注混杂（`Parity`/`OLL` 前缀已剥离，仍无法通过解析） |
| 4×4 PLL Parity | 79 例中收录 52 例 | 被拒 27 条：来源里混入 `Bad grip in move M` 等抓取残渣，剥离前缀后仍不合法 |
| F2L | 41 例 585 条，被拒 37 条 | 被拒原因是"setup + 公式后前两层未还原（四个朝向均未命中）"，多为来源里带 `y` 转身的变体，实际是同一 case 的另一种握法 |
| 进阶集合里 `parsed` 占比偏高 | ZBLS 1386 / OLLCP 912 / adv-f2l 552 条只到 `parsed` | 这些公式的闭合判据依赖 AUF 搜索（`U / U2 / U'`），部分 case 的 AUF 超出四种，未纳入强判据；页面如实标注，不冒充已验证 |

被拒条目不是"悄悄丢掉"：`data/verified/rejected.json` 里逐条记录了
`{ setId, caseId, alg, reason }`，可以随时复查判据是否过严。

---

## 5. 页面上的呈现

- 公式集页按分类分组列出 37 个集合 pill（桌面按类换行；手机压成一行可横滑）；
- 案例按 `group`（如 OLL 的"点/线/十字"）分组列出，点任意案例 → 真实 `TwistyPlayer` 播放，
  初始态由 case 反推（`inverse` 或显式 setup）；
- 每条公式旁标注校验级别：`引擎已校验`（structural）或 `仅语法校验`（parsed）；
- `coll` 集合里若某条公式会改动棱块排列，会显示「会改动棱块排列」标签；
- 演示底面（黄/白/蓝/绿/红/橙）对全部集合生效，切换后公式与初始态一起做共轭变换。
