# Twisty Atlas 魔方公式图谱

多类型魔方的公式库 + **真实三维**动作播放器。公式、步骤高亮与三维画面严格同步，
数据全部存在本机浏览器里，可离线使用。

不是效果图，也不是视频：立方体/四面体/十二面体由 WebGL 实时渲染，每一层转动都由
`cubing.js` 的状态模型计算，测试用状态签名而非截图来验证对错。

---

## 功能

- **真实三维播放**：三阶、二~七阶、金字塔、斜转、五魔方共 9 种为真实三维；
  Square-1 为二维渲染（引擎限制，如实标注，见下方「已知限制」）。
- **公式逐步播放**：0 / N 步计数、可拖拽进度条、上一步/下一步、跳到首尾、0.5×–2× 变速。
  点第 k 步一定停在第 k 步结束的画面（定位依据是引擎时间轴，不是定时器）。
- **步骤 chip 同步高亮**：当前步高亮并自动滚动；点击任意 chip 直接跳转。
- **三种初始态**：从复原态开始 / 以逆公式为初始态（演示"如何解回"）/ 自定义 setup（用于 OLL、PLL、F2L 等情形）。
- **公式库管理**：搜索（标题/公式/标签）、按分类筛选、按标签筛选、收藏、排序（更新时间/标题/难度）、
  新建 / 编辑 / 复制 / 删除 / 撤销删除。
- **导入导出**：JSON 与 CSV 双格式；导入前预览表格并标注重复项，可选跳过 / 覆盖 / 作为新记录；
  整体事务，失败全部回滚。
- **镜头与视角**：拖动旋转镜头、滚轮缩放、一键复位。**镜头移动不改变魔方状态**（有专门用例保证）。
- **桌面与手机**：≥1280px 三栏；窄屏改为「公式库 / 详情」两个 tab，360px 宽无横向溢出。
- **明暗主题**、可调默认播放速度、默认魔方类型、背面提示贴纸开关。
- **PWA 离线**：首次访问后全部静态资源进入缓存，断网仍可使用。

### 键盘快捷键

| 键 | 作用 |
|---|---|
| `Space` | 播放 / 暂停 |
| `←` / `→` | 上一步 / 下一步 |
| `Home` / `End` | 跳到起点 / 终点 |
| `Esc` | 关闭对话框 |

在输入框、文本域内不拦截按键。

---

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
```

首次进入会自动写入 13 条内置演示公式（每类魔方至少一条，全部经 KPuzzle 校验）与 23 个分类。
可在「设置 → 数据」里用「重新写入演示公式」恢复。

### 全部命令

```bash
npm run dev          # 开发服务器
npm run build        # 类型检查 + 生产构建（vue-tsc --noEmit && vite build）
npm run preview      # 预览构建产物
npm run typecheck    # 只做类型检查
npm test             # Vitest 单元测试（74 个）
npm run test:e2e     # Playwright 端到端（20 个用例，两个项目共执行 23 次）
```

### 证据脚本

```bash
# 逐魔方实测渲染与状态（会重写 docs/capability-raw.md 与 docs/screenshots/puzzle-*.png）
node scripts/verify-puzzles.mjs      # 需先启动开发服务器（默认 5178 端口）

# 界面截图存档（1366×768 / 390×844 / 360×800）
node scripts/shots.mjs

# 重新生成 PWA 图标（纯 Node 手写 PNG，无第三方依赖）
node scripts/gen-icons.mjs
```

---

## 目录结构

```
src/
  engine/                  # 引擎层：唯一与 cubing.js 打交道的地方
    cubingBridge.ts        #   ★ 唯一运行时出入口（Alg/KPuzzle/TwistyPlayer/状态签名）
    playbackController.ts  #   播放控制器 + 纯函数 locateStepFromTimeline
    algService.ts          #   公式规范化、解析校验、逆公式、前缀
    setupResolver.ts       #   三种初始态 → (setupAlg, playAlg)
    puzzleRegistry.ts      #   10 种魔方描述与能力状态
    adapters/              #   cubeNxN / geometry 两类适配器（PuzzleAdapter 协议）
  db/
    database.ts            # Dexie 表结构与索引
    formulaRepository.ts   # 校验 + CRUD + 纯对象转换（修 DataCloneError）
    importExport.ts        # JSON/CSV 导入导出、白名单归一化、重复检测、事务
    seed.ts                # 13 条内置公式 + 分类
  stores/                  # Pinia：settings / player / formula
  components/              # 播放器、工具栏、步骤 chip、列表、详情、编辑器、导入对话框
  views/                   # 工作台 / 公式库 / 公式详情 / 设置
  styles/                  # tokens.css（明暗变量）+ global.css
  tests/                   # Vitest：74 个
e2e/                       # Playwright：20 个用例（含 mobile.spec.ts）
scripts/                   # 验证、截图、图标生成
docs/                      # 验收证据与决策记录
```

---

## 文档

| 文件 | 内容 |
|---|---|
| `docs/API_VERIFICATION.md` | cubing.js API 逐项核对（版本、签名行号、运行时输出、被推翻的假设） |
| `docs/CUBING_CAPABILITY_MATRIX.md` | 10 种魔方逐项实测结论，含 Square-1 为何只能是二维 |
| `docs/capability-raw.md` | 脚本直接写出的原始实测表（未经手工修改） |
| `docs/TECH_DECISIONS.md` | 14 条技术决策：选择、放弃的方案、理由、代价 |
| `docs/screenshots/` | 桌面与手机界面截屏 + 每种魔方的真实画布截屏 |

---

## 数据与隐私

- 所有公式存在浏览器 IndexedDB（库名 `twisty-atlas`），**不上传任何数据**，无账号、无网络请求（除首屏静态资源）。
- 清浏览器站点数据会删除公式。建议定期用「导入 / 导出 → 导出 JSON」备份。
- 导入文件只接受白名单字段，HTML 会被当作纯文本渲染（有专门用例验证不执行脚本）。

---

## 部署

产物是纯静态文件，`base: './'` + hash 路由，放到任意静态目录即可（支持子路径）：

```bash
npm run build
# 把 dist/ 整个目录拷到目标位置
```

本地验证构建产物：

```bash
npm run preview
```

PWA 需要 HTTPS（或 localhost）才能注册 Service Worker。

---

## 已知限制

1. **Square-1 只有二维渲染**。`cubing@0.66.1` 对 Square-1 的 `visualizationStrategy` 实测为 `2D`，
   没有真实三维形变模型。本项目标为「二维可播放」并在播放区显示「二维渲染」徽标，**不冒充三维**。
   公式解析、状态计算、步骤定位均正常。真正的三维形变需要独立实现（阶段 H），尚未完成。
2. **可播放魔方限定 10 种**。引擎自带 21 种，未注册的（`clock`、`fto`、`gigaminx`、`40x40x40` 等）
   未做逐状态验收，按"未验证不得标可用"的原则不出现在选择器里。
3. **贴纸配色不可自定义**。颜色由渲染引擎决定，设置页提供的是「标准配色对照」说明，
   不是改色开关（不做假的开关）。
4. **PWA 自动更新可能打断编辑**。`registerType: 'autoUpdate'`，新版发布后会自动刷新页面；
   当前未实现"有未保存改动时延迟更新"。
5. **高阶魔方首次加载较慢**。七阶首帧需要下载较多块数据，脚本给的上限是 90 秒。
6. **不做云同步**。数据仅在本机浏览器；跨设备请用导出 / 导入。

---

## 浏览器要求

WebGL2 + IndexedDB + ES2022。已在 Chromium（Playwright 自带 `chromium` 通道，
SwiftShader 软件渲染）下完成全部端到端验证。
