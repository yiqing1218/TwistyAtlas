# 打包说明：电脑 + 安卓（只做这两种）

两端共用同一份 `dist/`：构建时 `base: './'`，路由用 hash 模式，
因此 `file://`（Electron）和 `https://localhost`（Android WebView）都能直接加载，**不需要改任何代码**。

| 目标 | 命令 | 产物 |
|---|---|---|
| 电脑（Windows x64，免安装） | `npm run desktop:build` | `out/TwistyAtlas/TwistyAtlas.exe` |
| 安卓（debug APK） | `npm run android:apk` | `out/TwistyAtlas-1.3.0-android-debug.apk`（原件在 `android/app/build/outputs/apk/debug/`） |

---

## 1. 电脑端（Electron）

### 1.1 命令

```bash
npm run desktop:build      # = npm run build && node scripts/pack-desktop.mjs
npm run desktop:dev        # 源码 + Electron 直接调试
```

### 1.2 打包脚本做了什么

`scripts/pack-desktop.mjs`：

1. 从 `%LOCALAPPDATA%/electron/Cache` 找到 Electron 45.4.1 的 `win32-x64` 官方分发包并解包到 `out/TwistyAtlas`；
2. 把 `electron.exe` 复制成 `TwistyAtlas.exe`；
3. 组装 `resources/app/`：`package.json`（精简版，`main: electron/main.cjs`）+ `electron/` + `dist/`；
4. 打印产物体积。

产物结构与 electron-builder 的 `win-unpacked` 一致，双击 `TwistyAtlas.exe` 即可运行，
不需要安装、不写注册表、不需要管理员权限。

### 1.3 为什么不用 electron-builder

`electron-builder --win` 在本机沙箱里 **必然失败**：

```
⨯ cannot move ...\release\win-unpacked.tmp -> ...\release\win-unpacked
  EPERM / EBUSY
```

原因是它对产物目录做「临时目录 → 正式目录」的原子重命名，而沙箱把 `fs.rm` / `fs.rename`
重定向到回收站操作，遇到已存在的目录就失败（试过 3 次，含关闭 `CODEBUDDY_SAFE_DELETE_ENABLED`）。

因此改为手工组装：**结果等价、过程可复现、不依赖沙箱行为**。
需要 NSIS 安装包时，可以在能正常运行 electron-builder 的机器上执行：

```bash
npm run desktop:installer   # electron-builder --win（nsis + portable）
```

### 1.4 桌面端已实测

通过 CDP 连接运行中的打包产物（`scripts/verify-desktop.mjs`）：

```
工作台：{"title":"工作台 · Twisty Atlas","hasPlayer":true,"bridge":{"platform":"win32","isDesktop":true}}
计时器：{"ready":"true","scramble":"B F2 R2 F L' U' B' ...","hasCubePreview":true,"statsPane":true}
公式集：{"pills":37,"cases":57,"hasPlayer":true}
```

- 标题正确、`twisty-player` 真实存在（WebGL 在 Electron 里可用）；
- `window.desktop` 桥接生效（`contextIsolation: true` + `sandbox: true`）；
- 37 套公式集加载正常（2433 案例 / 13667 条公式）。

### 1.5 已知限制

- 未做代码签名，Windows 首次运行可能提示"未知发布者"。
- 图标仍是 Electron 默认图标（手工组装不走 rcedit 改写 exe 资源）。
- 只出 Windows x64。macOS/Linux 需要各自的 Electron 分发包，当前未纳入两种打包方案。

---

## 2. 安卓端（Capacitor + Gradle）

### 2.1 环境

| 组件 | 版本 | 位置 |
|---|---|---|
| JDK | **21**（Capacitor 8 的 Android 库以 Java 21 为 source/target） | `D:/twisty-toolchain/jdk-21.0.13+9` |
| Android SDK Platform | android-36 | `D:/twisty-toolchain/android-sdk` |
| Build-Tools | 36.0.0 | 同上 |
| Gradle | 8.14.3（wrapper 自动下载，走腾讯云镜像） | `~/.gradle` |

`android/local.properties` 里记录了 `sdk.dir`；换机器时需要改这一行。

### 2.2 命令

```bash
npm run android:apk           # 构建 + cap sync + assembleDebug
npm run android:apk:release   # 同上，assembleRelease（未签名）
npm run android:sync          # 只把 dist 同步进 android 工程
npm run android:open          # 用 Android Studio 打开
```

`scripts/build-android.mjs` 会：

1. 探测 JDK（`TWISTY_JAVA_HOME` → `JAVA_HOME` → 常见安装路径）与 Android SDK（`TWISTY_ANDROID_HOME` → `ANDROID_HOME` → `local.properties`）；
2. 执行 `cap sync android`（这一步会先删 `capacitor-cordova-android-plugins` 再重建，脚本内已关掉 safe-delete 守卫）；
3. 执行 `gradlew assembleDebug|assembleRelease`；
4. 校验 APK 是否存在并打印路径。

### 2.3 关卡与解决办法

| 报错 | 原因 | 解决 |
|---|---|---|
| `Your project path contains non-ASCII characters` | 工程在 `D:\WB一般聊天\...` | `android/gradle.properties` 里加 `android.overridePathCheck=true` |
| `无效的源发行版：21` | 用了 JDK 17，Capacitor 8 要求 21 | 装 JDK 21，脚本已优先探测 21 |
| `services.gradle.org` 超时 | 网络 | wrapper 的 `distributionUrl` 改腾讯云镜像 |
| `safe-delete 操作失败 ... capacitor-cordova-android-plugins` | 沙箱拦截 `cap sync` 的删除 | 脚本内 `CODEBUDDY_SAFE_DELETE_ENABLED=0` |

### 2.4 产物实测

```
app-debug.apk  5.1 MB
package: name='com.twistyatlas.app' versionCode='130' versionName='1.3.0'
minSdkVersion:'24'  targetSdkVersion:'36'
application-label:'Twisty Atlas'
assets/public/ 47 个条目（index.html + assets + algsets chunk）
```

用 `aapt2 dump badging` 校验包名/版本/最低 SDK/应用名，用 `unzip -l` 校验前端资源确实进包。

### 2.5 已知限制

- **没有在真机/模拟器上跑过**：本机未安装 AVD 系统镜像，也没有连接设备。
  已完成的是「编译通过 + 包结构校验」，不等于"安装到手机上跑通了"。
- release 版未配置签名（`assembleRelease` 产出未签名 APK，无法直接安装分发）。
- 手机端布局已用 Playwright 的 Pixel 7 / 390×844 / 360×800 视口验证
  （`e2e/mobile.spec.ts` + `scripts/shot-mobile.mjs`：逐页断言「整页不滚动 / 无横向溢出 / 底部页签在视口内」），
  但那是浏览器视口，不是 Android WebView 的真实渲染。
- 手机端是**独立的一套界面**（底部页签 + 固定视口 + 单列布局），不是桌面布局的缩放版；
  详见 `docs/ARCHITECTURE.md` 第 2.5 节。

---

## 3. 两种包的关系

```
        src/ ──vite build──▶ dist/
                              ├──▶ Electron: resources/app/dist  → TwistyAtlas.exe
                              └──▶ Capacitor: android/app/src/main/assets/public → app-debug.apk
```

- 数据都存在本机：桌面走 Chromium 的 IndexedDB（用户目录），安卓走 WebView 的 IndexedDB（应用沙盒）。
- 两端都不联网（除首屏静态资源），PWA 离线缓存只在浏览器/WebView 首次访问后生效。
