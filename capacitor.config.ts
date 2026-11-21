import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 安卓壳配置。
 *
 * - webDir 指向 Vite 产物，`cap sync` 会把 dist 拷进 android/app/src/main/assets/public
 * - 使用 hash 路由，因此不需要任何服务端 rewrite
 * - allowMixedContent 保持关闭；应用完全离线可用
 */
const config: CapacitorConfig = {
  appId: 'com.twistyatlas.app',
  appName: 'Twisty Atlas',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#f7f8fa',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
