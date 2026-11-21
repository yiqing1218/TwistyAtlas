# 魔方能力矩阵（阶段 F 交付证据）

本文件的每一行都来自**真实运行脚本的实测输出**，不是按魔方名字猜的。
原始输出：`docs/capability-raw.md`（由脚本直接写出，未经手工修改）。
截图：`docs/screenshots/puzzle-*.png`（每张都是真实 WebGL canvas 的截屏）。

---

## 1. 判定标准

一个魔方被标为 `ready-3d`，必须同时满足四条，缺一不可：

1. **有真实三维画面**：在 `twisty-player`（closed shadow DOM）内递归找到尺寸 > 50×50 的 `<canvas>`，
   且引擎的 `visualizationStrategy` 为三维策略（`Cube3D` 或 `PG3D`）。
2. **层转真实正确**：点"下一步"后，读取 `experimentalModel.currentPattern`，
   状态签名必须改变（证明不是静态图，也不是假动画）。
3. **公式能逐步定位**：`0 / N` 起点、`N / N` 终点都精确命中（定位公式见 `docs/API_VERIFICATION.md` §4）。
4. **单播放器实例**：切换魔方类型、旋转屏幕后页面中仍只有一个 `twisty-player`，不重复创建 canvas。

只满足 1–3 但可视化策略是二维的，只能标 `ready-2d`。

### `Cube3D` 与 `PG3D` 的区别

`cubing@0.66.1` 的 `VisualizationStrategy` 类型定义（`index-nWspzjVK.d.ts:1429`）：

```ts
type VisualizationStrategy = "Cube3D" | "2D" | "experimental-2D-LL" | "experimental-2D-LL-face" | "PG3D";
```

- `Cube3D`：三阶专用渲染器（性能最好）。
- `PG3D`：PuzzleGeometry 通用三维渲染器，**同样是真实三维**，只是走通用几何管线。
  二阶、四~七阶、金字塔、斜转、五魔方全部落在这一档。
- `2D`：二维展开图，**没有真实形变三维模型**。

因此 `PG3D` 不算降级，`2D` 才是。

---

## 2. 实测结果

| 魔方 | 显示名 | 家族 | 可视化策略 | 画布尺寸 | 播放器实例 | 动作数 | 单步改变状态 | 终点定位 | 状态 |
|---|---|---|---|---|---|---|---|---|---|
| `3x3x3` | 三阶魔方 | cube | `Cube3D` | 684×493 | 1 | 3 | yes | yes | `ready-3d` |
| `2x2x2` | 二阶魔方 | cube | `PG3D` | 684×493 | 1 | 4 | yes | yes | `ready-3d` |
| `4x4x4` | 四阶魔方 | cube | `PG3D` | 684×493 | 1 | 3 | yes | yes | `ready-3d` |
| `5x5x5` | 五阶魔方 | cube | `PG3D` | 684×493 | 1 | 3 | yes | yes | `ready-3d` |
| `6x6x6` | 六阶魔方 | cube | `PG3D` | 684×493 | 1 | 3 | yes | yes | `ready-3d` |
| `7x7x7` | 七阶魔方 | cube | `PG3D` | 684×493 | 1 | 3 | yes | yes | `ready-3d` |
| `pyraminx` | 金字塔魔方 | polyhedron | `PG3D` | 684×493 | 1 | 4 | yes | yes | `ready-3d` |
| `skewb` | 斜转魔方 | polyhedron | `PG3D` | 684×493 | 1 | 4 | yes | yes | `ready-3d` |
| `megaminx` | 五魔方 | polyhedron | `PG3D` | 684×493 | 1 | 4 | yes | yes | `ready-3d` |
| `square1` | SQ1 扇形魔方 | shape-shifting | **`2D`** | **missing** | 1 | 5 | yes | yes | **`ready-2d`** |

截图索引（均为真实画布截屏）：

| 魔方 | 截图 |
|---|---|
| 3x3x3 | `docs/screenshots/puzzle-3x3x3.png` |
| 2x2x2 | `docs/screenshots/puzzle-2x2x2.png` |
| 4x4x4 | `docs/screenshots/puzzle-4x4x4.png` |
| 5x5x5 | `docs/screenshots/puzzle-5x5x5.png` |
| 6x6x6 | `docs/screenshots/puzzle-6x6x6.png` |
| 7x7x7 | `docs/screenshots/puzzle-7x7x7.png` |
| pyraminx | `docs/screenshots/puzzle-pyraminx.png` |
| skewb | `docs/screenshots/puzzle-skewb.png` |
| megaminx | `docs/screenshots/puzzle-megaminx.png` |
| square1 | `docs/screenshots/puzzle-square1.png` |

---

## 3. 九个真实三维的魔方

这九个的 `visualizationStrategy` 都是三维，且逐项验证通过。差异化事实记录如下
（对应 `src/engine/puzzleRegistry.ts` 的 `verificationNote`）：

| 魔方 | 与三阶的差异（实测确认） |
|---|---|
| 2x2x2 | 只有角块，无中心块/棱块；无 `M/E/S` 中层动作 |
| 4x4x4 | 有宽层 `Rw`（两层）与内层 `2R`，两者都会真实带动不同的块 |
| 5x5x5 | `Rw` 与 `2R` 中间还多一层，转动层数不同 |
| 6x6x6 | 块数增加，首次加载明显变慢；`Rw` 仍为两层语义 |
| 7x7x7 | 同上，首帧等待最久（脚本对每种魔方给 90s 上限） |
| pyraminx | 四面体，`R/U` 是面转而非立方体层转，轴系完全不同 |
| skewb | 转轴为对角切面，不是面法线；同名字母 `R` 含义与三阶不同 |
| megaminx | 十二面体，`R++` 为双格转动（两格 = 144°） |
| square1 | 见下节 |

> 这里特意没有用"三阶换皮"充数：金字塔/斜转/五魔方的几何体、转轴、记号和
> 块结构都由各自 KPuzzle 定义决定，截图里能直接看出形状不同（四面体、立方体切角、十二面体）。
> 若用三阶假装异形，`visualizationStrategy` 会一致、块数会一致，但截图与状态签名都会暴露。

---

## 4. Square-1：为什么只能是二维

**实测事实**（不是推测）：

- `experimentalModel.visualizationStrategy.get()` 返回 `"2D"`；
- 在 shadow 树里递归遍历，**找不到**任何尺寸 > 50×50 的 `<canvas>`（表格里记为 `missing`）；
- 但 `numAnimatedLeaves()` = 5，`currentPattern` 随每一步真实改变，`atEnd` 精确到 `5 / 5`。

即：**状态模型与公式解析是完整可用的，缺的是真实三维形变渲染**。
Square-1 会变形（中层切转后不再是立方体），cubing.js 0.66.1 没有为它提供三维形变模型。

本项目的处理：

1. `puzzleRegistry.ts` 中 `STATUS.square1 = 'ready-2d'`，同文件注释写明原因；
2. 界面上该魔方显示 `二维可播放` 标签，播放区右上角显示 **「二维渲染」徽标**
   （`data-testid="render-mode"`），用户不会误以为是三维；
3. 设置页的能力矩阵表里同样标为二维，并附一句限制说明；
4. 相关端到端用例只断言"二维渲染 + 状态正确 + 步数正确"，**不断言三维画布存在**，
   避免测试通过而事实不成立。

任务书阶段 H 要求"Square-1 专项必须独立验证，不得冒充"。当前状态是：
**冒充已排除（如实标注），真实三维形变尚未实现**。若要在阶段 H 补齐，需要自行实现
Square-1 的几何形变（切片角度 → 多边形顶点 → 三维网格），工作量独立，不在本次交付范围内，
已在 `README.md` 的「已知限制」与验收报告的「未完成项」中明确列出。

---

## 5. 未注册的引擎魔方

`cubing/puzzles` 实际提供 21 种，本项目只注册 10 种。未注册的部分及原因：

| 引擎 ID | 不注册原因 |
|---|---|
| `40x40x40` | 体积与算力不可接受，无实际使用场景 |
| `clock` | 是旋钮类魔方，动作为指针拨动，与"层转"公式模型不同 |
| `fto` / `baby_fto` / `master_tetraminx` / `redi_cube` / `kilominx` / `gigaminx` | 属异形扩展，未做逐状态验收，按任务书"未验证不得标可用"的要求不注册 |
| `melindas2x2x2x2` / `loopover` / `tri_quad` | 非标准魔方玩法（四维/滑块类），与本产品公式库模型不匹配 |

原则：**没做过真实渲染与状态验收的，就不出现在选择器里**，而不是先放上去再写"可能不可用"。

---

## 复现方式

```bash
# 终端 1：启动开发服务器
npx vite --port 5178 --strictPort

# 终端 2：逐魔方实测（约 3–5 分钟，七阶首次加载较慢）
node scripts/verify-puzzles.mjs
# → 终端逐行打印 JSON，同时重写 docs/capability-raw.md 与 docs/screenshots/puzzle-*.png
```

单条输出样例（真实）：

```json
{"id":"3x3x3","canvas":"684×493","strategy":"Cube3D","canvasCount":1,"steps":"3","moveChanged":"yes","endOk":"yes"}
{"id":"square1","canvas":"missing","strategy":"2D","canvasCount":1,"steps":"5","moveChanged":"yes","endOk":"yes"}
```
