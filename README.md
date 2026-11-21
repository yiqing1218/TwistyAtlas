# Twisty Atlas 魔方公式图谱

多类型魔方的公式库 + **真实三维**动作播放器 + **csTimer 风格计时器**。
公式、步骤高亮与三维画面严格同步；内置 12 套公式集（807 案例 / 7468 条公式）；
数据存在本机，可离线使用。

不是效果图，也不是视频：立方体/四面体/十二面体由 WebGL 实时渲染，每一层转动都由
`cubing.js` 的状态模型计算，测试用引擎状态而非截图来验证对错。

---

## 功能

### 三维播放器
- **真实三维播放**：三阶、二~七阶、金字塔、斜转、五魔方共 9 种为真实三维；
  Square-1 为二维渲染（引擎限制，如实标注）。
- **公式逐步播放**：0 / N 步计数、可拖拽进度条、上一步/下一步、跳到首尾、0.5×–2× 变速。
  点第 k 步一定停在第 k 步结束的画面（定位依据是引擎时间轴，不是定时器）。
- **三种初始态**：从复原态开始 / 以逆公式为初始态 / 自定义 setup（用于 OLL、PLL、F2L 等情形）。
- **镜头与视角**：拖动旋转、滚轮缩放、一键复位。**镜头移动不改变魔方状态**（有专门用例）。

### 内置公式集（12 套）
| 主线 | 内容 |
|---|---|
| CFOP | OLL 57 例、PLL 21 例（完整）、2-Look OLL 10 例、2-Look PLL 6 例 |
| 前两层 | F2L 41 例（585 条公式，含四个朝向） |
| 进阶 | COLL 40 例、WV 26 例、ZBLL 472 例（1LLL 家族，棱块已定向）、二阶 CLL 42 例 |
| 高阶 | 4×4 OLL Parity 9 例、4×4 PLL Parity 52 例、5×5 L2E 31 例 |

每条公式都用真实 KPuzzle 做过结构校验，详情面板显示来源与校验级别；
被剔除的条目记录在 `data/verified/rejected.json`。明细见 [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)。

### 计时器（csTimer 风格）
- 顶部打乱条（真实 WCA 随机状态）+ 换一条（`N`）。
- 按住空格 ≥ 300 ms 变绿 → 松开开始；再按一次停表。
- WCA 观察：15 s 内开始、15–17 s 判 `+2`、超 17 s 判 `DNF`（可开关）。
- 左栏统计：当前 / 最佳 / ao5 / ao12 / mo3 / 次数，去头尾均值、DNF 规则正确。
- 历史列表可改判罚（`+2` / `DNF` / 取消）、删除、清空会话；按项目分会话。
- 右栏：真实 `TwistyPlayer` 预览"这条打乱长什么样"（不是图片）。
- 七段数码显示为纯 SVG 多边形（斜切笔画 + `skewX(-6)`），无字体依赖。

### 公式库管理
- 搜索（标题/公式/标签）、分类与标签筛选、收藏、排序、新建/编辑/复制/删除/撤销删除。
- JSON 与 CSV 双格式导入导出；导入前预览并标注重复项；整体事务，失败全部回滚。
- 桌面三栏；窄屏改「公式库 / 详情」两个 tab，360 px 宽无横向溢出。

### 键盘快捷键（播放器）
| 键 | 作用 |
|---|---|
| `Space` | 播放 / 暂停（计时器页为计时） |
| `←` / `→` | 上一步 / 下一步 |
| `Home` / `End` | 跳到起点 / 终点 |
| `Esc` | 关闭对话框 / 取消计时 |

---

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
```

### 全部命令

```bash
npm run dev            # 开发服务器
npm run build          # 类型检查 + 生产构建（vue-tsc --noEmit && vite build）
npm run preview        # 预览构建产物
npm run check          # typecheck + 架构检查 + 96 个单测
npm run test           # 只跑 Vitest
npm run test:e2e       # Playwright（28 次执行：桌面 25 + 移动 3）
npm run data:build     # 重新生成内置公式集（抓取结果已在 data/raw/）
npm run desktop:build  # 打包桌面端 → out/TwistyAtlas/TwistyAtlas.exe
npm run android:apk    # 打包安卓 → out/TwistyAtlas-1.2.0-android-debug.apk
```

---

## 两种打包方案

| 目标 | 技术 | 产物 |
|---|---|---|
| 电脑（Windows x64） | Electron 45（`contextIsolation` + `sandbox`） | `out/TwistyAtlas/TwistyAtlas.exe`（362 MB，免安装） |
| 安卓手机 | Capacitor 8 + Gradle（minSdk 24 / targetSdk 36） | `out/TwistyAtlas-1.2.0-android-debug.apk`（5.2 MB） |

步骤、环境要求、踩过的坑与实测结论见 [`docs/PACKAGING.md`](docs/PACKAGING.md)。

---

## 架构

分层（`domain / application / infrastructure / presentation / data`），依赖方向由
`scripts/check-arch.mjs` 静态守护，`cubing/*` 只允许出现在 `infrastructure/cubing`：

```
src/
  domain/                  # 纯逻辑，零框架依赖
    model/                 #   公式、魔方、成绩、设置
    timer/                 #   计时器状态机（纯函数）、统计、格式化
  application/sets/        # 用例：内置公式集加载
  infrastructure/
    cubing/                # 唯一与 cubing.js 打交道的地方（含 adapters/）
    persistence/           # Dexie：公式、成绩
  presentation/            # Vue 组件 / 视图 / Pinia store / 路由
  data/algsets.json        # 构建期生成的公式集（独立 chunk，首屏不加载）
e2e/                       # Playwright（桌面 + 移动）
scripts/                   # 数据流水线、架构检查、打包、验证与截图
docs/                      # 架构、数据、打包、验收证据
```

细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

---

## 测试与证据

```
单元测试    96 个（Vitest）   —— 计时器边界/统计/公式校验/导入导出/播放定位
端到端      28 次执行（Playwright）—— 真实 WebGL、状态一致、持久化、移动端布局
架构检查    53 个文件
数据校验    807 案例 / 7468 条公式逐条过引擎
```

```bash
# 逐魔方实测渲染与状态（会重写 docs/capability-raw.md 与 docs/screenshots/puzzle-*.png）
node scripts/verify-puzzles.mjs

# 桌面产物逐页验证（先启动 out/TwistyAtlas/TwistyAtlas.exe --remote-debugging-port=9222）
node scripts/verify-desktop.mjs

# 界面截图存档
node scripts/shots.mjs
```

---

## 文档

| 文件 | 内容 |
|---|---|
| `docs/ARCHITECTURE.md` | 分层、依赖规则、关键模块、数据流、扩展点 |
| `docs/PACKAGING.md` | 两种打包方案的命令、环境、踩坑与实测结论 |
| `docs/DATA_SOURCES.md` | 12 套公式集的来源、结构判据、被拒条目、已知缺口（含 VLS） |
| `docs/API_VERIFICATION.md` | cubing.js API 逐项核对（版本、签名、运行时输出、被推翻的假设） |
| `docs/CUBING_CAPABILITY_MATRIX.md` | 10 种魔方逐项实测结论（含 Square-1 为何只能二维） |
| `docs/TECH_DECISIONS.md` | 技术决策：选择、放弃的方案、理由、代价 |
| `docs/ACCEPTANCE_REPORT.md` | 阶段 A–H 验收报告 + v1.2 增补 |
| `docs/screenshots/` | 桌面、手机、每种魔方、计时器、公式集的真实截屏 |

---

## 数据与隐私

- 全部数据在浏览器 IndexedDB（库名 `twisty-atlas`），**不上传、无账号、无后端**。
- 清站点数据会丢公式/成绩，建议定期「导出 JSON」备份。
- 导入只接受白名单字段，HTML 按纯文本渲染（有专门用例验证不执行脚本）。

---

## 已知限制

1. **Square-1 只有二维渲染**：`cubing@0.66.1` 对 Square-1 的 `visualizationStrategy` 实测为 `2D`，
   没有真实三维形变模型。播放区显示「二维渲染」徽标，**不冒充三维**。
2. **可播放魔方限定 10 种**：引擎自带 21 种，未做逐状态验收的不出现在选择器里。
3. **VLS / HLS 未收录**：公开来源没有可校验的结构化数据（尝试过 J Perm、SpeedCubeDB、
   speedcube.quest，均不可用），详见 `docs/DATA_SOURCES.md` 第 4 节。
4. **安卓包未上真机**：编译通过 + 包结构校验通过，但本机无 AVD/设备，未做安装运行验证。
5. **桌面端未签名、未换图标**：首次运行可能提示"未知发布者"。
6. **PWA 自动更新可能打断编辑**：`registerType: 'autoUpdate'`，未实现"有未保存改动时延迟更新"。
7. **不做云同步**：跨设备请用导出 / 导入。

---

## 浏览器要求

WebGL2 + IndexedDB + ES2022。已在 Chromium（Playwright 自带 `chromium` 通道，
SwiftShader 软件渲染）与 Electron 45 下完成验证。
