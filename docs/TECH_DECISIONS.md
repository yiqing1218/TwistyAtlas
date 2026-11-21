# 技术决策记录（TECH_DECISIONS）

每条决策写清：**问题 → 选择 → 放弃的方案 → 理由 → 代价**。
凡是"因为真实运行时踩坑才这么定"的，都标注了现象。

---

## D1. 用 cubing.js 做引擎，不自己写魔方数学

- **问题**：需要真实三维渲染 + 真实层转 + 公式解析 + 多阶与异形支持。
- **选择**：`cubing@0.66.1`，用它的 `TwistyPlayer`（渲染）与 `KPuzzle`（状态模型）。
- **放弃**：three.js 自研渲染 + 自己实现置换运算。
- **理由**：
  1. 自研置换运算需要为每种魔方写一套块定义，10 种魔方等于 10 套，且极易在奇偶/方向定义上出错；
  2. KPuzzle 的 `algToTransformation` 本身就是**公式合法性的权威判定**，自研无法复现；
  3. 任务书要求"层转真实正确"，用官方状态模型做真值比对是最省事也最可靠的路径。
- **代价**：被引擎的 API 稳定性绑住（见 `docs/API_VERIFICATION.md` §5 的改名与缺失字段），
  且 Square-1 的三维能力受引擎限制（见 D7）。

---

## D2. 所有 `cubing/*` 引用收口到一个模块

- **问题**：引擎 API 变来变去（0.66.1 里 `isIdentity` 改名、`definition.moves` 消失），散落引用会导致升级灾难。
- **选择**：`src/engine/cubingBridge.ts` 是唯一运行时入口，其余代码只 import 这个模块或 `src/types/`。
- **放弃**：哪里要用哪里直接 `import { Alg } from 'cubing/alg'`。
- **理由**：升级时只需改一个文件；单元测试可以只 mock 这一层。
- **代价**：多一层转发函数（`animatedLeaves` 等），需要维护。

---

## D3. 步骤定位用引擎时间轴，不用定时器

- **问题**：点第 3 步要真的停在第 3 步结束，且高亮 chip 与画面必须一致。用 `setTimeout(duration × k)` 猜位置，在变速、掉帧、后台标签页时必然漂移。
- **选择**：
  ```
  stepTimes[k] = indexer.indexToMoveStartTimestamp(k) + indexer.moveDuration(k)
  player.experimentalModel.timestampRequest.set(stepTimes[k])
  ```
  与官方 `<twisty-alg-viewer>` 同源。
- **放弃**：定时器推算、监听 DOM class 变化、按动画帧累计。
- **理由**：时间轴由引擎给出，切速时引擎自己重算，外部不需要知道动画曲线。
- **代价**：需要处理"播放结束时 timestamp 略小于 stepTimes[N]"的取整误差 →
  `atEnd` 分支直接上报 `N / N`（Square-1 实测中真的出现了 `4 / 5`，由此修掉）。

---

## D4. 状态真值用 KPuzzle 签名，不用截图

- **问题**：怎么证明"这一步真的转对了"？
- **选择**：端到端测试读取 `experimentalModel.currentPattern.get()`，序列化成 JSON 字符串，
  与 `patternAtStep(puzzleId, alg, k, setup)` 计算出的签名**逐字符比较**。
- **放弃**：像素比对截图（受相机角度、抗锯齿、GPU 差异影响，必然脆弱）、目测。
- **理由**：状态签名是确定的、可复现的、与渲染无关的；渲染错但状态对，说明是渲染 bug；
  状态错说明是层转 bug，两类问题能被区分开。
- **代价**：测试必须能访问 `twisty-player` 元素（closed shadow DOM 下靠 `el.shadow` 公开字段绕进去）。

---

## D5. 把定位逻辑抽成纯函数，让 WebGL 不进单元测试

- **问题**：jsdom 里 import `cubing/twisty` 会直接崩（模块顶层访问 CSS/WebGL）。
- **选择**：`locateStepFromTimeline(stepTimes, totalSteps, timestamp)` 是纯函数；
  播放器实例通过 `loadTwistyModule()` 动态 import 后才创建。
- **放弃**：给 jsdom 打一堆 WebGL/CSS polyfill。
- **理由**：边界逻辑（0/0、0/N、N/N、相邻步中点、越界）才是真正容易错的，
  这部分用 12 个单元测试覆盖，比在真浏览器里跑更稳更快。
- **代价**：需要维护"纯函数 → 快照字段"的映射，字段改名时两处都要改。

---

## D6. 持久化用 IndexedDB（Dexie），不用 localStorage

- **问题**：需要存几百条公式，且要按魔方、分类、标签、收藏多条件查询与排序。
- **选择**：Dexie 4，表 `formulas / categories / settings / meta`，带索引
  （`puzzleId, categoryId, favorite, updatedAt, *tags, title`）。
- **放弃**：localStorage（同步阻塞、无索引、5MB 上限、字符串序列化开销）。
- **理由**：多条件筛选在 IndexedDB 索引上是原生能力；单事务多表写入可回滚。
- **代价**：必须处理 **Vue 响应式 Proxy 不能被结构化克隆**的问题（`DataCloneError`）→
  落库前用 `toPlainFormulaRecord` 逐字段重建纯对象。这个问题在"导入"和"撤销删除"两处都真实出现过。

---

## D7. Square-1 如实标为二维，不拿三阶冒充

- **问题**：任务书要求异形魔方必须真实，且阶段 H 明确"不得冒充"。
- **选择**：`STATUS.square1 = 'ready-2d'`，UI 显示「二维渲染」徽标与 `二维可播放` 标签，
  能力矩阵与 README 都写明。
- **放弃**：用三阶魔方渲染器加载 Square-1 公式（画面会"看起来能转"，但形状与真机完全不同，属于冒充）。
- **理由**：实测 `visualizationStrategy === "2D"` 且 shadow 树里没有 canvas，
  引擎确实不提供三维形变模型。冒充的代价是用户按错误画面记忆手法。
- **代价**：Square-1 的三维形变是未完成项，需要独立实现（切片角度 → 顶点 → 网格），
  已在验收报告"未完成项"中单列。

---

## D8. 路由用 hash 模式，`base: './'`

- **问题**：产物要能放到任意静态目录（含子路径、甚至本地双击 `dist/index.html`）。
- **选择**：`createWebHashHistory()` + Vite `base: './'`。
- **放弃**：history 模式（需要服务端 rewrite 到 `index.html`，静态托管/子路径会 404）。
- **理由**：任务书允许在没有 fallback 配置时使用 hash 路由；交付形态更适合"拷走就能用"。
- **代价**：URL 带 `#/`，观感略差；SEO 不友好（本产品定位本地工具，可接受）。

---

## D9. 三维模块动态加载，单元测试不碰 WebGL

- **问题**：`cubing/twisty` 体积大，且首次渲染要等 `IntersectionObserver` 挂 canvas。
- **选择**：`loadTwistyModule()` 用 `import('cubing/twisty')` 懒加载，并用 `import type` 引类型；
  `optimizeDeps.exclude: ['cubing']`。
- **放弃**：静态 import（首屏白屏时间变长，且 jsdom 测试直接崩）。
- **理由**：主页真正需要 3D 时才加载；纯逻辑测试与公式解析测试完全不需要渲染代码。
- **代价**：首次进入工作台有一段"准备中"状态，需要专门的 loading 与降级提示
  （`isWebGLAvailable()` 检测 + `viewport-error` 覆盖层）。

---

## D10. PWA 用 generateSW 预缓存，缓存上限放宽到 8MB

- **问题**：需要离线可用（阶段 G），但 3D 引擎单个 chunk 较大，Workbox 默认 2MB 上限会漏掉它。
- **选择**：`vite-plugin-pwa` + `generateSW`，`globPatterns` 覆盖 js/css/html/svg/png/ico/woff2，
  `maximumFileSizeToCacheInBytes: 8 * 1024 * 1024`，`cleanupOutdatedCaches: true`。
- **放弃**：`injectManifest` 手写 Service Worker（对本项目无额外收益）。
- **理由**：构建产物 `PWA precache 27 entries (1331.79 KiB)`，全部在 8MB 内，一次访问即可离线。
- **代价**：首次访问要多下约 1.3MB；`registerType: 'autoUpdate'` 会在新版发布后自动刷新，
  若用户正在编辑公式，理论上存在被打断的可能（当前未做"有未保存改动时延迟更新"）。

---

## D11. 不用 UI 框架，用 CSS token + 原生组件

- **问题**：需要桌面三栏与手机单栏两套布局，且要求无横向溢出。
- **选择**：手写 `tokens.css`（明/暗两套 CSS 变量）+ `global.css`，组件用 `<script setup>` 单文件，
  响应式断点用媒体查询，移动端用 tab 切换侧栏/详情。
- **放弃**：Element Plus / Naive UI 等组件库。
- **理由**：本产品界面元素少（列表、工具栏、对话框、表单），组件库会带来几百 KB 与样式覆盖成本；
  自己写能保证 360px 宽度下不溢出。
- **代价**：对话框焦点陷阱、无障碍属性要自己写（已实现 `role="dialog"`、`aria-modal`、Esc 关闭）。

---

## D12. 导入导出做白名单归一化 + 事务

- **问题**：导入的文件可能来自旧版本、手改过的 CSV、甚至恶意构造的 JSON。
- **选择**：
  - JSON 校验格式头与版本号；CSV 用 Papa Parse（RFC 4180，处理 BOM 与引号内换行）；
  - `normalizeRecord` 只接受白名单字段，标签/URL/文本做净化，防原型污染（不合并任意 key）；
  - `applyImport` 在**单个 Dexie 事务**内完成，任一失败整体回滚；
  - 重复检测同时看 `id` 与内容键（标题+公式+魔方+初始态），支持 skip / overwrite / new 三种策略。
- **放弃**：直接把解析结果 `Object.assign` 进数据库。
- **理由**：导入是最容易把库搞坏的操作，必须要么全成功要么全不变。
- **代价**：字段增减时要同步改白名单（三处：类型、normalize、导出），漏改会导致字段丢失
  → 用 17 个导入导出单元测试锁住"往返逐字段一致"。

---

## D13. 能力矩阵由脚本实测生成，不由人写

- **问题**：任务书反复强调"不得声称未验证的能力"。
- **选择**：`scripts/verify-puzzles.mjs` 对每种魔方自动跑"切类型 → 等画布 → 记动作数 →
  走一步比状态 → 跳终点 → 截图"，并直接写出 `docs/capability-raw.md`。
- **放弃**：手写一张能力表。
- **理由**：手写的表会随引擎升级悄悄失效；脚本重跑即刷新，且能立刻发现"某种魔方不再渲染"。
- **代价**：跑一次约 3–5 分钟（七阶首次加载慢），只在阶段验收时跑。

---

## D14. 测试分两层：Vitest 管逻辑，Playwright 管真实渲染

| 层 | 覆盖内容 | 数量 | 为什么放这层 |
|---|---|---|---|
| Vitest（jsdom） | 公式解析/规范化、逆公式、分类与仓库 CRUD、导入导出往返、步骤定位边界 | 74 | 不需要 WebGL，跑得快，能精确断言边界 |
| Playwright（真 Chromium） | 三维画布存在、层转改变状态、镜头不改状态、逐步定位、持久化、导入导出、移动端无溢出 | 20 个用例（两项目共执行 23 次） | 必须真实 WebGL 与真实 IndexedDB |

- **放弃**：只写单元测试（无法证明渲染真的出现）；只写端到端（边界情况跑不动、定位困难）。
- **代价**：端到端需要 `--enable-unsafe-swiftshader` 等 GPU 参数，在无 GPU 的 CI 上要保留这些参数。
