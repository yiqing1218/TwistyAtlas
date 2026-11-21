# Twisty Atlas 架构说明

> 目标：把「引擎能力」「业务规则」「界面」彻底分开，让核心逻辑可在无浏览器、
> 无框架的环境下被单元测试覆盖，并让"技术债"以静态检查的方式暴露出来。

---

## 1. 分层与依赖方向

```
presentation ──▶ application ──▶ domain ◀── infrastructure
     │                │                          │
     └────────────────┴──────────────────────────┘
                 （presentation 可依赖全部下层）
```

| 层 | 目录 | 职责 | 允许依赖 |
|---|---|---|---|
| domain | `src/domain` | 纯业务模型与规则：公式、魔方描述、成绩、计时器状态机、统计、格式化、演示朝向 | **无**（不得出现 vue / pinia / dexie / cubing） |
| application | `src/application` | 用例编排：内置公式集的加载与查询、成绩导出格式化 | `domain`、`data` |
| infrastructure | `src/infrastructure` | 与外部世界打交道：cubing.js 引擎、IndexedDB 持久化 | `domain`、`data` |
| presentation | `src/presentation` | Vue 组件、视图、Pinia store、路由 | 全部 |
| data | `src/data` | 构建期生成的静态数据（内置公式集 JSON） | 无 |

依赖方向由 `scripts/check-arch.mjs` 静态守护，违反即构建失败：

```bash
npm run check:arch
# 架构检查通过：58 个文件，未发现违规依赖。
```

规则细节：

1. `domain` 里出现 `import ... from 'vue'`、`pinia`、`dexie`、`cubing` 一律报错。
   —— 保证计时器状态机、统计、格式化能以毫秒级跑完 108 个单测。
2. `infrastructure` 不得依赖 `application` / `presentation`，避免"仓储反过来调 UI"。
3. `cubing/*` **只允许**出现在 `src/infrastructure/cubing` 内。
   —— 引擎升级（例如 cubing.js 0.66 → 0.7）只需改一处，而不是全仓库搜替换。

---

## 2. 关键模块

### 2.1 domain

| 文件 | 内容 |
|---|---|
| `domain/model/formula.ts` | `Formula`、`FormulaCategory`、`Difficulty` 等实体与不变量 |
| `domain/model/puzzle.ts` | 魔方描述（id、中文名、阶数、是否支持三维） |
| `domain/model/solve.ts` | `SolveRecord`、`Penalty`、会话 id 派生规则 |
| `domain/model/settings.ts` | 用户设置与默认值 |
| `domain/model/orientation.ts` | 演示底面（黄/白/蓝/绿/红/橙）→ 共轭旋转 `rotationForBottom` / `withBottom` |
| `domain/timer/stateMachine.ts` | 计时器状态机：`reduce(state, event) → state`，含 WCA 观察 15s/+2/DNF |
| `domain/timer/statistics.ts` | `effectiveMs`、去头尾均值、`ao5/ao12/ao50/ao100/mo3`、最佳滚动窗口 |
| `domain/timer/format.ts` | `12.345` / `3:40.079` / 观察倒计时格式化 |

计时器状态机是**纯函数**，没有任何 `setTimeout` / `performance.now()`：

```ts
export type TimerPhase = 'idle' | 'inspecting' | 'holding' | 'running' | 'stopped';
export function reduce(state: TimerState, event: TimerEvent): TimerState;
export function displayMs(state: TimerState, at: number): number;
export function solveOutcome(state: TimerState, inspectionEnabled: boolean): { elapsedMs: number; penalty: Penalty };
```

时间由调用方以 `at` 参数注入，所以「按住 300ms 变绿」「观察超 15s 判 +2」
这类边界可以在单测里精确复现，不需要真的等 15 秒。

**演示底面不是转镜头，而是共轭变换**（`domain/model/orientation.ts`）：

```
选择的底面 → 整体旋转 R（yellow:'' / white:'x2' / blue:'x' / green:"x'" / red:'z' / orange:"z'"）
公式 A 的展示形式：A' = R · A · R⁻¹，初始态同样变换
```

这样终态仍然是复原态，只是整体朝向不同——所以「换底面后播放到终点必须还是复原」
可以当成硬断言写进 e2e（`e2e/orientation.spec.ts`），而不是靠肉眼判断。

### 2.2 infrastructure/cubing

| 文件 | 内容 |
|---|---|
| `cubingBridge.ts` | 唯一运行时出入口：`Alg` / `KPuzzle` / `TwistyPlayer` / 状态签名 |
| `playbackController.ts` | 播放控制 + 纯函数 `locateStepFromTimeline`（用引擎时间轴定位第 k 步） |
| `algService.ts` | 公式规范化、合法性校验、逆公式、前缀剥离 |
| `setupResolver.ts` | 三种初始态 → `(setupAlg, playAlg)` |
| `puzzleRegistry.ts` | 10 种魔方的描述与能力标记（真实三维 / 二维） |
| `scrambleService.ts` | 优先 `randomScrambleForEvent`（WCA 随机状态），失败降级为随机走子 |
| `adapters/` | `cubeNxN` / `geometry` 两类适配器，实现 `PuzzleAdapter` 协议 |

**步骤定位的真值来源**是引擎而不是定时器：

```
indexer.indexToMoveStartTimestamp(k) + indexer.moveDuration(k)
  → experimentalModel.timestampRequest.set(ms)
```

因此「点第 7 步」和「动画播到第 7 步结束」是同一个画面，不会因为掉帧而错位。

### 2.3 infrastructure/persistence

| 文件 | 内容 |
|---|---|
| `database.ts` | Dexie 表结构与索引（`formulas` / `solves` / `categories` / `settings`），库名 `TwistyAtlasDB` |
| `formulaRepository.ts` | 校验 + CRUD + 纯对象转换（修过 `DataCloneError`） |
| `solveRepository.ts` | 成绩读写、按会话查询、改判罚、清空会话 |
| `importExport.ts` | JSON/CSV 双向、白名单归一化、重复检测、整体事务 |

> 所有写库前都要把 Pinia 的响应式 Proxy 转成普通对象：结构化克隆无法克隆 Proxy，
> 直接 `put(reactiveObj)` 会抛 `DataCloneError`，而且异常发生在异步写里容易被忽略。
> `writeSettingsRow` 就踩过这个坑（表现为「切换底面后刷新又回到默认值」）。

### 2.4 presentation

- `stores/playerStore.ts`、`stores/formulaStore.ts`、`stores/settingsStore.ts`、`stores/timerStore.ts`
- `views/`：`HomeView`（桌面三栏工作台）、`LibraryView`、`FormulaDetailView`、`SetsView`（内置公式集）、`TimerView`（计时器）、`SettingsView`
- `components/timer/SevenSegmentDisplay.vue`：纯 SVG 七段数码（斜切笔画 + `skewX(-6)`），无字体依赖；
  `fluid` 模式按容器宽度等比缩放，长数字（`1:23.456`）在小屏上自动变小而不是被裁掉
- `components/timer/MiniCubePreview.vue`：真实 `TwistyPlayer`，把打乱作为 setup 显示"打乱后的样子"
- `composables/useViewport.ts`：`MOBILE_MAX_WIDTH = 760`、`isMobileViewport()`（路由守卫用，同步）、
  `useIsMobile()`（组件用，响应式）

`timerStore` 只做三件事：rAF 时钟、把键盘/触摸事件翻译成状态机事件、把停表结果落库。
判定逻辑全在 domain。`application/timer/exportSolves.ts` 是纯函数，把成绩渲染成
CSV / JSON / 纯文本，下载动作留给视图——这样导出格式可以被单测逐字段断言。

### 2.5 移动端形态（两套界面，不是缩放同一套）

断点为 `760 px`，三处保持一致：`App.vue` 的底部页签、`global.css` 的固定视口、
各视图的移动端样式、以及 `useViewport.ts` 的路由判断。**四处必须同源**，否则会出现
「导航按手机渲染、页面按桌面渲染」的错位。

```
导航：≤760px 隐藏顶部 .app-nav，显示底部 .app-tabbar（4 个页签 + env(safe-area-inset-bottom)）
视口：html/body/#app 在手机上 height:100% + overflow:hidden，整页不滚动
滚动：只有「列表类」区域内部滚动（.library__list / .cases-pane / .settings）
入口：#/ 在手机上重定向到 #/sets（工作台是桌面专属的三栏合体视图）
```

页面结构差异：

| 页面 | 桌面 | 手机 |
|---|---|---|
| 工作台 `#/` | 三栏（库 / 播放器 / 详情） | 不暴露，重定向到公式集 |
| 公式集 | 左列表 + 右播放器 | 播放器固定 25vh 在上，案例列表在下内部滚动；公式集 pill 压成一行横滑 |
| 公式库 | 列表 + 详情并排 | 只有列表，点一条进 `#/formula/:id` |
| 公式详情 | 播放器 + 侧栏 | 播放器固定 30vh，说明区内部滚动 |
| 计时器 | 三栏（统计 / 大计时 / 预览） | 大计时固定 30vh，统计与历史在下方内部滚动 |
| 设置 | 单列长页 | 单列长页，在容器内滚动（属于"小页面"） |

验收不靠截图，靠数值（`e2e/mobile.spec.ts` + `scripts/shot-mobile.mjs`）：

```ts
const v = doc.scrollHeight - doc.clientHeight;  // 必须 ≤ 1：整页不能上下滑
const h = doc.scrollWidth  - doc.clientWidth;   // 必须 ≤ 1：不能横向溢出
tabbar.getBoundingClientRect().bottom            // 必须落在视口内：页签点得到
```

---

## 3. 数据流

```
① 播放公式
   SetsView / DetailView
      → algService（规范化 + 校验）
      → setupResolver（初始态 → setup + playAlg）
      → cubingBridge（KPuzzle 计算终态 + TwistyPlayer 渲染）
      → playbackController（indexer 时间轴定位第 k 步）

② 计时
   键盘/触摸 → timerStore.press/release
      → domain/timer/stateMachine.reduce（纯函数）
      → solveOutcome（用时 + 判罚）
      → solveRepository.add（IndexedDB）
      → statistics.summarize（当前 / ao5 / ao12 / mo3）

③ 内置公式集
   构建期：scripts/data/*（抓取 → 解析 → KPuzzle 结构校验 → 审计）
      → src/data/algsets.json（打包成独立 chunk，首屏不加载）
   运行期：application/sets/formulaSets.ts（loadDataset 动态 import）
      → SetsView
```

---

## 4. 测试策略

| 层次 | 工具 | 规模 | 关注点 |
|---|---|---|---|
| 单元 | Vitest | 108 个 | 计时器边界、统计、公式校验、导入导出、播放定位 |
| 端到端 | Playwright | 42 次执行（桌面项目 36 + 移动项目 6） | 真实 WebGL 渲染、状态一致、持久化、移动端页签可达与「整页不滚动」 |
| 架构 | `check-arch.mjs` | 58 个文件 | 依赖方向、引擎单点收口 |
| 数据 | `data:build` + `rejected.json` | 2433 案例 / 13667 条公式（拒绝 399） | 每条公式的引擎结构判定与被拒原因 |

端到端测试**不用截图比对**判对错，而是直接向播放器要真实状态（`e2e/helpers.ts`）：

```ts
// 播放器当前状态（KPuzzle pattern 序列化）
const pattern = await page.evaluate(async () => {
  const player = document.querySelector('twisty-player')!;
  return JSON.stringify(await player.experimentalModel.currentPattern.get());
});
expect(pattern).toBe(await readSolvedPattern(page)); // 复原态对照
```

截图只作为证据存档（`docs/screenshots/`），不参与断言，避免"像素差不多的错误"被放过。

---

## 5. 打包（两种目标）

| 目标 | 技术 | 入口 | 产物 |
|---|---|---|---|
| 电脑（Windows x64） | Electron 45 + 手工组装 `resources/app` | `electron/main.cjs` | `out/TwistyAtlas/TwistyAtlas.exe` |
| 安卓手机 | Capacitor 8 + Gradle | `android/` | `out/TwistyAtlas-1.3.0-android-debug.apk` |

详见 [`PACKAGING.md`](./PACKAGING.md)。

两端共用同一份 `dist/`：`base: './'` + hash 路由，因此 `file://`（Electron）与
`https://localhost`（Capacitor WebView）都能直接加载，无需改代码。

---

## 6. 扩展点

| 需求 | 改哪里 | 不需要改 |
|---|---|---|
| 新增一种魔方 | `puzzleRegistry.ts` + `domain/model/puzzle.ts`（并跑 `verify-puzzles.mjs` 实证） | 播放器、公式库、计时器 |
| 新增一套公式集 | `scripts/data/build-dataset.mjs` 的 `SETS` + `RULES`，然后 `npm run data:build` | 界面（自动出现在公式集页） |
| 换存储后端 | 新增 `infrastructure/persistence/*Repository` 实现 | domain / presentation |
| 升级 cubing.js | `infrastructure/cubing/cubingBridge.ts` | 其余全部 |
