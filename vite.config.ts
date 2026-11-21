/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

// 说明：base 使用相对路径，便于把 dist/ 直接放到任意静态目录（含子路径）打开。
// 路由采用 hash 模式，因此不需要服务端 rewrite 兜底。
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Twisty Atlas 魔方公式图谱',
        short_name: 'Twisty Atlas',
        description: '多类型魔方公式库与真实三维动作图谱，可离线使用。',
        lang: 'zh-CN',
        theme_color: '#f7f8fa',
        background_color: '#f7f8fa',
        display: 'standalone',
        start_url: './',
        scope: './',
        orientation: 'any',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 3D 引擎（cubing.js）体积较大，全部静态资源在首次访问后进入缓存。
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2048,
  },
  optimizeDeps: {
    exclude: ['cubing'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 30000,
    // cubing.js 的 kpuzzle 分块懒加载在并行 worker 下容易抢占资源，这里限制并发。
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
