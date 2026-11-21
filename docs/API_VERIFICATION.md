# cubing.js API 核对记录（阶段 A / B 交付证据）

本文件记录的是**对着已安装版本的真实类型声明与运行时输出**逐项核对的结果，不是从文档或记忆里抄的接口说明。

- 核对对象：`cubing@0.66.1`（`node_modules/cubing/package.json`）
- 类型声明入口：`node_modules/cubing/dist/lib/cubing/index-nWspzjVK.d.ts`
- 运行时验证：`node --input-type=module -e "…"`（命令见文末「复现方式」）
- 所有对 `cubing/*` 的引用集中在本项目唯一出入口 `src/engine/cubingBridge.ts` 与 `src/types/`，业务代码不直接依赖引擎。

---

## 1. 版本与依赖

```
$ node -e "console.log(require('./node_modules/cubing/package.json').version)"
0.66.1
```

`package.json` 中依赖声明为 `"cubing": "^0.66.1"`，并通过 `package-lock.json` 锁定实际安装版本。

同一命令还确认了引擎自带的魔方清单（**不是本项目手写的列表**）：

```
$ node --input-type=module -e "import { puzzles } from 'cubing/puzzles'; console.log(Object.keys(puzzles))"
21 个：3x3x3, 2x2x2, 4x4x4, 5x5x5, 6x6x6, 7x7x7, 40x40x40, clock, megaminx,
     pyraminx, skewb, square1, fto, gigaminx, master_tetraminx, kilominx,
     redi_cube, melindas2x2x2x2, loopover, tri_quad, baby_fto
```

本项目只注册其中 10 种（见 `src/engine/puzzleRegistry.ts`），其余按阶段 F 的边界说明不做支持，而不是"注册了但打不开"。

---

## 2. 逐项 API 核对表

| # | API | 声明位置（行号） | 本项目用途 | 验证方式 | 结论 |
|---|---|---|---|---|---|
| 1 | `new Alg(text)` | `cubing/alg` | 公式解析 | 运行时构造 `new Alg("R U R' U'")` | 可用 |
| 2 | `alg.experimentalExpand()` | `cubing/alg` | 把括号/重复/交换子展开成叶子序列 | 见下 §3 实测 | 可用（迭代器，非数组） |
| 3 | `Move` / `Pause` / `Newline` 叶子类型 | `cubing/alg` | 区分"会改变状态的动作"与"停顿" | `leaf instanceof Move` 判定，遍历 16 个叶子全部为 `Move` | 可用 |
| 4 | `alg.invert()` | `cubing/alg` | "以逆公式为初始态"模式 | `new Alg("R U").invert()` → `U' R'` | 可用 |
| 5 | `puzzles[id].kpuzzle()` | `cubing/puzzles` | 载入真实状态模型 | 10 个魔方全部返回 KPuzzle | 可用 |
| 6 | `kpuzzle.algToTransformation(alg)` | 第 939 行 | 公式合法性校验、状态真值 | 非法动作抛错，合法动作返回 KTransformation | 可用 |
| 7 | `kpuzzle.defaultPattern()` | 第 942 行 | 复原态基准 | 返回 KPattern | 可用 |
| 8 | `pattern.applyMove(move)` | 第 956 行 | 逐步状态签名 | 单元测试/fixture 均基于它 | 可用 |
| 9 | `pattern.applyTransformation(t)` | 第 955 行 | setup + 公式组合 | 用于 `patternAtStep` | 可用 |
| 10 | `transformation.isIdentityTransformation()` | 第 912 行 | 判断公式是否等于复原 | `"R R'"` → `true` | 可用 |
| 11 | `new KPattern(kpuzzle, patternData)` | `cubing/kpuzzle` | 从 JSON 还原状态 | 端到端测试读取播放器状态后回灌 | 可用 |
| 12 | `new TwistyPlayer(config)` | `cubing/twisty` | 创建播放器 | 动态 import 后构造 | 可用 |
| 13 | `player.alg` | 属性 | 设置待播放公式 | 端到端断言步数 | 可用 |
| 14 | `player.experimentalSetupAlg` | 属性 | 设置初始态 | 三种初始态模式都依赖它 | 可用 |
| 15 | `experimentalSetupAnchor: 'start'` | 构造配置 | setup 在公式之前执行 | 修掉"setup 与公式顺序错乱" | 可用 |
| 16 | `player.tempoScale` | 属性 | 播放速度（0.5×–2×） | 切速后终态不变（E07 断言） | 可用 |
| 17 | `player.hintFacelets` | 属性 | 背面提示贴纸 | 设置页开关 | 可用（值域为 `'none' \| 'floating' \| '3d'`） |
| 18 | `player.cameraLatitude / cameraLongitude / cameraDistance` | 属性 | 镜头控制 | E05：改镜头不改状态签名 | 可用 |
| 19 | `player.indexer` | 属性 | 取步骤时间轴 | 设 `'simple'` 后与 `timestampRequest` 对齐 | 可用 |
| 20 | `indexer.numAnimatedLeaves()` | 第 1098/1118/1136 行 | 步数 N | 与 `animatedLeaves()` 长度一致 | 可用 |
| 21 | `indexer.indexToMoveStartTimestamp(i)` | 第 1095/1113/1129 行 | 第 i 步起点时间 | 见 §4 | 可用 |
| 22 | `indexer.moveDuration(i)` | 第 1101/1119/1137 行 | 第 i 步动画时长 | 见 §4 | 可用 |
| 23 | `experimentalModel.timestampRequest.set(ms)` | 模型属性 | 精确定位到某一步 | 与 `numAnimatedLeaves` 交叉验证 | 可用 |
| 24 | `experimentalModel.currentPattern.get()` | 模型属性 | 读取**引擎真实状态** | 端到端测试所有状态断言都走这条 | 可用 |
| 25 | `experimentalModel.visualizationStrategy.get()` | 第 1936 行 | 判断引擎实际用 3D 还是 2D | square1 返回 `2D`（关键结论） | 可用 |
| 26 | `experimentalModel.detailedTimelineInfo / coarseTimelineInfo` | 模型属性 | 播放进度回调 | 驱动步数标签与 chip 高亮 | 可用 |

> 表中"第 N 行"均指 `node_modules/cubing/dist/lib/cubing/index-nWspzjVK.d.ts` 的实际行号，可直接 `sed -n 'Np'` 复核。

---

## 3. 算法展开的实测行为

```
$ node --input-type=module -e "
import { Alg, Move } from 'cubing/alg';
const alg = new Alg(\"R U R' U'\");
let n = 0; for (const leaf of alg.experimentalExpand()) n++;
console.log(n);
"
4
```

嵌套写法（带括号重复与交换子）的实测：

```
$ node --input-type=module -e "
import { Alg, Move } from 'cubing/alg';
const alg = new Alg(\"R U R' U' (R U R' U')2 [R, U]\");
let m = 0; for (const leaf of alg.experimentalExpand()) if (leaf instanceof Move) m++;
console.log(m);
"
16
```

校验：4 + 8 + 4 = 16，`[R, U]` 被正确展开为 `R U R' U'`。

**这条实测直接决定了步数的定义**：本项目的"步数"= 展开后 `Move` 叶子数量，
`Pause` / `Newline` 不计入（`src/engine/cubingBridge.ts` 的 `animatedLeaves()`），
因此 `R U R' U'` 在任何魔方上都稳定显示 `0 / 4`，与实际动画次数一致。

---

## 4. 步骤定位的真值公式

任务书要求"点击第 3 步必须真的停在第 3 步结束的画面"。本项目没有用定时器估算，而是取引擎自己给出的时间轴：

```
stepTimes[k] = indexer.indexToMoveStartTimestamp(k) + indexer.moveDuration(k)
```

与 cubing.js 官方 `<twisty-alg-viewer>` 组件内部的做法一致。

- `stepTimes` 长度为 `N + 1`，`stepTimes[0] = 0`（复原态），`stepTimes[N]` 为终态时间。
- 定位：`player.experimentalModel.timestampRequest.set(stepTimes[k])`。
- 状态判定是**纯函数** `locateStepFromTimeline(stepTimes, totalSteps, timestamp)`（`src/engine/playbackController.ts`），
  因此可以在 jsdom 里用 12 个单元测试覆盖 0 / N 边界、相邻步中点、超出范围等情况，不需要 WebGL。
- 播放结束时引擎给出的 `timestamp` 可能比 `stepTimes[N]` 略小（最后一帧取整误差），
  所以 `atEnd` 分支直接上报 `N / N`，避免出现 `4 / 5` 这类"少一步"的假象（这是 Square-1 实测中真实踩到并修掉的 bug）。

逆向交叉验证：端到端测试在每次定位后读取 `experimentalModel.currentPattern`，与
`patternAtStep(puzzleId, alg, k, setup)` 计算出的 KPuzzle 签名逐字符比较，必须完全相等。
即"画面停在哪儿"由**引擎状态模型**证明，而不是由截图证明。

---

## 5. 开发中被推翻的纸面假设（真实踩坑记录）

这些是"按文档想当然写"必然出错、只能靠真实运行发现的点，一并留档：

| 现象 | 原因 | 正确做法 |
|---|---|---|
| 画布完全不出现，容器高度为 0 | `TwistyPlayer` 的 `:host { display: grid }` 是内部 `.wrapper` 撑高的前提，外部把 `style.display` 设成 `block` 会破坏它 | 只设 `width/height: 100%`，**不碰 `display`** |
| 查不到内部 `canvas` | TwistyPlayer 使用 **closed shadow DOM**，但 `el.shadow` 是公开字段 | 从 `player.shadow` 开始递归遍历，找有尺寸的 `canvas` |
| 首屏 cube 不渲染 | 引擎用 `IntersectionObserver` 延迟挂载 canvas | 等真实可交互后再截图/断言，不能 `waitForTimeout` 硬等 |
| `t.isIdentity is not a function` | 该方法在 0.66.1 已更名 | 用 `isIdentityTransformation()`，比较两个状态用 `isIdentical()` |
| `kp.definition.moves` 不存在 | 新版不再暴露该字段 | 动作合法性统一交给 `kpuzzle.algToTransformation()` |
| `alg.childAlgNodes()` 不存在 | 迭代接口改名 | `for (const leaf of alg.experimentalExpand())` |
| 在 jsdom 里 import `cubing/twisty` 直接崩 | 3D 模块在模块顶层访问 CSS/WebGL | `import type` + `loadTwistyModule()` 动态 import，单元测试不加载 WebGL 代码 |
| 保存公式报 `DataCloneError` | Vue 的响应式 Proxy 不能被结构化克隆进 IndexedDB | 落库前逐字段重建纯对象（`toPlainFormulaRecord`） |

---

## 6. 结论

- 引擎版本、API 名称、参数含义均**已对照真实声明与运行时输出核对**，未使用记忆中的接口。
- 状态真值来自 KPuzzle（`experimentalModel.currentPattern` 与 `patternAtStep` 双向比对），不是截图判断，也不是靠动画时长推算。
- 步骤时间轴来自引擎 `indexer`，不是定时器。
- Square-1 的可视化方式由 `visualizationStrategy` 实测为 `2D`，本项目据此标为 `ready-2d`，**不冒充三维**（详见 `docs/CUBING_CAPABILITY_MATRIX.md`）。

---

## 复现方式

```bash
# 1) 版本
node -e "console.log(require('./node_modules/cubing/package.json').version)"

# 2) 引擎自带魔方清单
node --input-type=module -e "import { puzzles } from 'cubing/puzzles'; console.log(Object.keys(puzzles))"

# 3) 括号/交换子展开
node --input-type=module -e "import { Alg, Move } from 'cubing/alg'; const a=new Alg(\"R U R' U' (R U R' U')2 [R, U]\"); let m=0; for (const l of a.experimentalExpand()) if (l instanceof Move) m++; console.log(m)"

# 4) 类型声明原文（核对签名用）
sed -n '1095p;1101p;1118p' node_modules/cubing/dist/lib/cubing/index-nWspzjVK.d.ts
```
