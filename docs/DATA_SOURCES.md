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
| 公式集 | **12 套** |
| 案例 | **807** |
| 公式（去重前） | **7468 条** |
| 通过引擎结构校验 | **7348 条**（98.4%） |
| 仅通过解析（公式合法但未能证明结构性质） | **120 条** |
| 被剔除 | **68 条**（全部有原因记录） |

明细：

| 集合 id | 魔方 | 案例 | 公式 | 校验级别 | 来源 | 初始态 |
|---|---|---|---|---|---|---|
| `cfop-oll` | 3×3×3 | 57 | 98 | structural 98 | J Perm | 逆公式 |
| `cfop-pll` | 3×3×3 | 21 | 55 | structural 55 | J Perm | 逆公式 |
| `cfop-2look-oll` | 3×3×3 | 10 | 17 | structural 17 | J Perm | 逆公式 |
| `cfop-2look-pll` | 3×3×3 | 6 | 11 | structural 11 | J Perm | 逆公式 |
| `f2l` | 3×3×3 | 41 | 585 | structural 585 | SpeedCubeDB | 显式 setup |
| `coll` | 3×3×3 | 40 | 50 | structural 50 | J Perm | 逆公式 |
| `wv` | 3×3×3 | 26 | 28 | parsed 28 | J Perm | 逆公式 |
| `zbll` | 3×3×3 | 472 | 6481 | structural 6481 | Roman Strakhov · zbll-trainer | 逆公式 |
| `cll-2x2` | 2×2×2 | 42 | 51 | structural 51 | J Perm | 逆公式 |
| `parity-4x4-oll` | 4×4×4 | 9 | 9 | parsed 9 | SpeedCubeDB | 逆公式 |
| `parity-4x4-pll` | 4×4×4 | 52 | 52 | parsed 52 | SpeedCubeDB | 逆公式 |
| `l2e-5x5` | 5×5×5 | 31 | 31 | parsed 31 | SpeedCubeDB | 逆公式 |

`structural` = 除"能被引擎解析"外，还满足该集合的结构判据（见下一节）。
`parsed` = 引擎能解析、动作在该魔方上合法，但没有更强的结构结论——**页面会如实标注**，
不会把 `parsed` 显示成"已校验"。

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

---

## 3. 来源与署名

| id | 站点/仓库 | 用途 | 说明 |
|---|---|---|---|
| `SRC-JPERM` | [J Perm](https://jperm.net/) | OLL、PLL、2-Look OLL/PLL、COLL、WV、2×2 CLL | 取其 `/lib/*.js` 数据集，在 Node `vm` 中求值取结构化字段；仅保存公式文本与署名 |
| `SRC-SCDB` | [SpeedCubeDB](https://speedcubedb.com/) | F2L（含 setup）、4×4 OLL/PLL Parity、5×5 L2E | 解析 HTML 中 `class="formatted-alg"` 与 `setup:` 字段 |
| `SRC-ZBLL-TRAINER` | [Roman Strakhov / zbll-trainer](https://github.com/Roman-/zbll-trainer) | ZBLL 472 例 | 公开仓库的 `zbllMap` |

所有条目在详情面板显示「来源」与访问日期（`accessedAt` 由构建脚本写入）。
本项目**未搬运**任何站点的图片、排版或视频，只保存公式文本 + 归属信息。

---

## 4. 已知缺口（如实记录）

| 缺口 | 现状 | 尝试过什么 |
|---|---|---|
| **VLS（Valk Last Slot，216 例）** | **未收录** | ① `jperm.net/lib/vls.js` → 404（返回的是 HTML 错误页，`data/raw/jperm/vls.js` 里能看到）；② `speedcubedb.com/a/3x3/VLS` → 返回的是搜索分类页，页内 0 个 `formatted-alg`；③ `speedcube.quest/algorithms/3x3/vls` → 页面数据是 React Flight 序列化 payload（字符串按索引去重），无法稳定还原 案例↔公式 的对应关系 |
| VLS 的近亲 WV | 已收录 26 例 | WV 是 VLS 的子集（冬季变体），可作为一个起步 |
| HLS（Hessler Last Slot，216 例） | 未收录 | 公开来源同样只有视频/PDF，无结构化数据 |
| 4×4 OLL Parity | 12 例中收录 9 例 | 被拒的 3 条含 `M` 类中层记号或来源标注混杂（`Parity`/`OLL` 前缀已剥离，仍无法通过解析） |
| 4×4 PLL Parity | 79 例中收录 52 例 | 被拒 27 条：来源里混入 `Bad grip in move M` 等抓取残渣，剥离前缀后仍不合法 |
| F2L | 41 例 585 条，被拒 37 条 | 被拒原因是"setup + 公式后前两层未还原（四个朝向均未命中）"，多为来源里带 `y` 转身的变体，实际是同一 case 的另一种握法 |

被拒条目不是"悄悄丢掉"：`data/verified/rejected.json` 里逐条记录了
`{ setId, caseId, alg, reason }`，可以随时复查判据是否过严。

---

## 5. 页面上的呈现

- 公式集页左侧是 12 个集合 pill，右侧按 `group`（如 OLL 的"点/线/十字"）分组列出案例；
- 每条公式旁标注校验级别：`引擎已校验`（structural）或 `仅解析`（parsed）；
- `coll` 集合里若某条公式会改动棱块排列，会显示「会改动棱块排列」标签；
- 点击案例 → 真实 `TwistyPlayer` 播放，初始态由 case 反推（`inverse` 或显式 setup）。
