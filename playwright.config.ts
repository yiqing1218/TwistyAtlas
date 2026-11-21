import { defineConfig, devices } from '@playwright/test';

const PORT = 5178;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // 使用完整 Chromium（新版无头模式）而不是 headless shell，WebGL 更可靠
        channel: 'chromium',
        // 既有用例按中文界面断言；语言切换能力由 i18n.spec.ts 单独覆盖
        locale: 'zh-CN',
        viewport: { width: 1366, height: 768 },
        launchOptions: {
          // 无头环境需要 SwiftShader 软件渲染 WebGL
          args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
        },
      },
    },
    {
      name: 'mobile-chromium',
      // 移动项目只跑移动端专用用例：桌面三栏布局的断言在窄屏下不适用
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        channel: 'chromium',
        locale: 'zh-CN',
        launchOptions: {
          args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
