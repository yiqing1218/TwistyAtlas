> 语言 / Language: [简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md)

# Twisty Atlas 魔方公式图谱

多类型魔方的公式库 + **真实三维**动作播放器 + **csTimer 风格计时器**。
公式、步骤高亮与三维画面严格同步；内置 **37 套公式集（2433 案例 / 13667 条公式）**；
数据存在本机，可离线使用。桌面端与安卓端各有独立的交互形态（不是同一个页面缩放）。

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
- **可选演示底面**：黄（默认）/ 白 / 蓝 / 绿 / 红 / 橙。做法不是"转一下镜头"，
  而是把公式与初始态一起做共轭 `R·A·R⁻¹`，终态仍是复原态，只是整体朝向不同；
  选择了会被持久化，切换后立即重载当前公式。
- **镜头与视角**：拖动旋转、滚轮缩放、一键复位。**镜头移动不改变魔方状态**（有专门用例）。

### 内置公式集（37 套 / 2433 案例 / 13667 条）
| 分类 | 内容 |
|---|---|
| 三阶 · CFOP 主线 | OLL 57、PLL 21、2-Look OLL 10、2-Look PLL 6、F2L 41 |
| 三阶 · 进阶体系 | COLL 40、WV 26、ZBLL/1LLL 472、**VLS 189**、ZBLS 291、OLLCP 342、CLS 97、SBLS 65、SV 27、CMLL 42、ELL 25、Advanced F2L 54、Pseudo F2L 33 |
| 二阶 | CLL 42、EG-1 40、EG-2 40、Ortega OLL 7、Ortega PBL 9 |
| 四阶 / 五阶 | 4×4 OLL Parity 9、4×4 PLL Parity 52、5×5 L2E 31 |
| 金字塔 / 五魔方 / SQ-1 | 金字塔 L4E 49；五魔方 CO/CP/EO/EP/PLL 16/15/3/5/151；SQ-1 CO/CP/EO/EP/Parity 7/8/7/99/5 |

每条公式都用真实 KPuzzle 做过结构校验（9357 条通过完整状态校验，4310 条通过语法+可解析校验），
详情面板显示来源与校验级别；被剔除的 399 条记录在 `data/verified/rejected.json`。
明细见 [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)。

### 计时器（csTimer 风格）
- 顶部打乱条（真实 WCA 随机状态）+ 换一条（`N`）；打乱文字在手机上完整折行显示，不截断。
- 按住空格（或按住大数字区域）≥ 300 ms 变绿 → 松开开始；再按一次停表。
- WCA 观察：15 s 内开始、15–17 s 判 `+2`、超 17 s 判 `DNF`（可开关）。
- 统计：当前 / 最佳 / 最差 / 平均 / mo3 / ao5 / ao12 / **ao50 / ao100** / 最佳 ao5 / ao12 / ao50，
  去头尾均值、DNF 规则正确。
- **成绩可逐条编辑**：单击 `+2` / `DNF` 切换判罚，单击删除单条；`Delete` 键删除最后一条；清空会话。
- **导出**：CSV（Excel 可直接打开，含判罚、打乱、时间戳）/ JSON（完整字段）/ 纯文本（对齐表格）。
- 右栏：真实 `TwistyPlayer` 预览"这条打乱长什么样"（不是图片）。
- 七段数码显示为纯 SVG 多边形（斜切笔画 + `skewX(-6)`），无字体依赖；宽度自适应，
  计时到 `1:23.456` 这种长数字时自动缩小，窄屏不会被裁掉。

### 公式库管理
- 搜索（标题/公式/标签）、分类与标签筛选、收藏、排序、新建/编辑/复制/删除/撤销删除。
- JSON 与 CSV 双格式导入导出；导入前预览并标注重复项；整体事务，失败全部回滚。
- 桌面三栏；手机上不再并排「列表 + 详情」，点一条直接进单条详情页（带播放器）。

### 桌面 / 手机两套界面
| | 桌面（> 760 px） | 手机（≤ 760 px） |
|---|---|---|
| 导航 | 顶部横向导航（含「工作台」三栏视图） | **底部 4 个页签**：计时器 / 公式集 / 公式库 / 设置（拇指可达，避开全面屏手势区） |
| 布局 | 三栏并排 | 单列，大区域（播放器 / 大计时）固定高度，列表在容器内滚动，**整页不上下滑** |
| 入口 | 工作台 `#/` | 自动落到 `#/sets`（工作台是桌面专属的三栏合体视图） |
| 信息密度 | 全量字段 | 去掉重复标题、重复计数、长解释，保留核心操作 |

### 六语界面
- 界面支持 简体中文 / English / 日本語 / Русский / Español / Português (BR)，在「设置 → 语言」即时切换并持久化；「跟随系统」按浏览器首选语言解析。
- 下层（`domain` / `application` / `infrastructure`）不含界面文案；翻译集中在表现层 `src/presentation/i18n/`。字典键由基准语言推导，缺键或多键都会类型报错，并有单测校验六语键集合与插值占位符一致。
- README 本身也提供六种语言，顶部一行即可切换。

### 键盘快捷键（播放器）
| 键 | 作用 |
|---|---|
| `Space` | 播放 / 暂停（计时器页为计时） |
| `←` / `→` | 上一步 / 下一步 |
| `Home` / `End` | 跳到起点 / 终点 |
| `Delete` | 计时器页删除最后一条成绩 |
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
npm run check          # typecheck + 架构检查 + 115 个单测
npm run test           # 只跑 Vitest
npm run test:e2e       # Playwright（44 次执行：桌面项目 38 + 移动项目 6）
npm run data:build     # 重新生成内置公式集（抓取结果已在 data/raw/）
npm run desktop:build  # 打包桌面端 → out/TwistyAtlas/TwistyAtlas.exe
npm run android:apk    # 打包安卓 → out/TwistyAtlas-1.3.0-android-debug.apk
```

---

## 两种打包方案

| 目标 | 技术 | 产物 |
|---|---|---|
| 电脑（Windows x64） | Electron 45（`contextIsolation` + `sandbox`） | `out/TwistyAtlas/TwistyAtlas.exe`（367 MB，免安装） |
| 安卓手机 | Capacitor 8 + Gradle（minSdk 24 / targetSdk 36，JDK 21） | `out/TwistyAtlas-1.3.0-android-debug.apk`（5.1 MB） |

步骤、环境要求、踩过的坑与实测结论见 [`docs/PACKAGING.md`](docs/PACKAGING.md)。

---

## 架构

分层（`domain / application / infrastructure / presentation / data`），依赖方向由
`scripts/check-arch.mjs` 静态守护（67 个文件），`cubing/*` 只允许出现在 `infrastructure/cubing`：

```
src/
  domain/                  # 纯逻辑，零框架依赖
    model/                 #   公式、魔方、成绩、设置、演示朝向(orientation)
    timer/                 #   计时器状态机（纯函数）、统计、格式化
  application/
    sets/                  #   内置公式集加载与分类
    timer/                 #   成绩导出（CSV / JSON / 文本，纯函数）
  infrastructure/
    cubing/                # 唯一与 cubing.js 打交道的地方（含 adapters/）
    persistence/           #   Dexie：公式、成绩、设置
  presentation/            # Vue 组件 / 视图 / Pinia store / 路由 / composables / i18n
  data/algsets.json        # 构建期生成的公式集（独立 chunk，首屏不加载）
e2e/                       # Playwright（桌面 + 移动）
scripts/                   # 数据流水线、架构检查、打包、验证与截图
docs/                      # 架构、数据、打包、验收证据
```

细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

---

## 测试与证据

```
单元测试   115 个（Vitest）  —— 计时器边界/统计/公式校验/导入导出/播放定位/导出格式化/底面共轭/六语字典
端到端     44 次执行（Playwright）—— 真实 WebGL、状态一致、持久化、移动端不整页滚动、页签可达、语言切换
架构检查   67 个文件，无越界依赖
数据校验   2433 案例 / 13667 条公式逐条过引擎（拒绝 399 条）
```

```bash
# 逐魔方实测渲染与状态（会重写 docs/capability-raw.md 与 docs/screenshots/puzzle-*.png）
node scripts/verify-puzzles.mjs

# 生产构建产物冒烟（先 npx vite preview --port 4173）
node scripts/verify-dist.mjs

# 桌面产物逐页验证（先启动 out/TwistyAtlas/TwistyAtlas.exe --remote-debugging-port=9222）
node scripts/verify-desktop.mjs

# 桌面截图存档；手机四页截图 + 「整页不滚动 / 无横向溢出 / 页签在视口内」量化巡检
node scripts/shots.mjs
node scripts/shot-mobile.mjs
```

---

## 文档

| 文件 | 内容 |
|---|---|
| `docs/ARCHITECTURE.md` | 分层、依赖规则、关键模块、数据流、扩展点、移动端路由策略 |
| `docs/PACKAGING.md` | 两种打包方案的命令、环境、踩坑与实测结论 |
| `docs/DATA_SOURCES.md` | 37 套公式集的来源、结构判据、被拒条目、已知缺口 |
| `docs/API_VERIFICATION.md` | cubing.js API 逐项核对（版本、签名、运行时输出、被推翻的假设） |
| `docs/CUBING_CAPABILITY_MATRIX.md` | 10 种魔方逐项实测结论（含 Square-1 为何只能二维） |
| `docs/TECH_DECISIONS.md` | 技术决策：选择、放弃的方案、理由、代价 |
| `docs/ACCEPTANCE_REPORT.md` | 阶段 A–H 验收报告 + v1.2 / v1.3 增补 |
| `docs/screenshots/` | 桌面、手机（390×844 / 360×800）、每种魔方、计时器、公式集的真实截屏 |
| `README.{en,ja,ru,es,pt-BR}.md` | 六种语言的 README，顶部一行互相切换 |

---

## 数据与隐私

- 全部数据在浏览器 IndexedDB（库名 `TwistyAtlasDB`），**不上传、无账号、无后端**。
- 清站点数据会丢公式/成绩，建议定期「导出 JSON」备份。
- 导入只接受白名单字段，HTML 按纯文本渲染（有专门用例验证不执行脚本）。

---

## 已知限制

1. **Square-1 只有二维渲染**：`cubing@0.66.1` 对 Square-1 的 `visualizationStrategy` 实测为 `2D`，
   没有真实三维形变模型。播放区显示「二维渲染」徽标，**不冒充三维**。
2. **可播放魔方限定 10 种**：引擎自带 21 种，未做逐状态验收的不出现在选择器里。
3. **安卓包未上真机**：编译通过 + 包结构校验通过，但本机无 AVD/设备，未做安装运行验证。
4. **桌面端未签名、未换图标**：首次运行可能提示"未知发布者"。
5. **PWA 自动更新可能打断编辑**：`registerType: 'autoUpdate'`，未实现"有未保存改动时延迟更新"。
6. **不做云同步**：跨设备请用导出 / 导入。
7. **手机端不支持横屏演奏级布局**：横屏仍可用，但播放器高度按 `vh` 计算，横屏下可视区域偏小。

---

## 浏览器要求

WebGL2 + IndexedDB + ES2022。已在 Chromium（Playwright 自带 `chromium` 通道，
SwiftShader 软件渲染）与 Electron 45 下完成验证。

---

## 许可证

[MIT](LICENSE) © 2026 yiqing1218

使用的第三方库（Vue、Vite、cubing.js、Dexie、Electron、Capacitor 等）各自保留原许可证，
完整清单见各依赖仓库。内置公式数据来自公开魔方站点，来源与逐套署名见
[`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)。
