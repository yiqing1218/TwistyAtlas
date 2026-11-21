import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';
import router from '@/presentation/router';
import '@/styles/global.css';
import { seedDatabase } from '@/infrastructure/persistence/seed';
import { useSettingsStore } from '@/presentation/stores/settingsStore';

async function bootstrap() {
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);

  const settings = useSettingsStore();
  // 先应用主题，避免首屏闪烁
  await settings.load().catch(() => undefined);

  // 首次运行写入演示数据。必须在挂载前完成，否则首屏会读到空库。
  // 失败不会阻塞界面，但会在控制台留下明确原因。
  try {
    await seedDatabase();
  } catch (err) {
    console.error('[TwistyAtlas] 初始化演示数据失败', err);
  }

  app.mount('#app');

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        registerSW({
          immediate: true,
          onRegisterError(error: unknown) {
            console.warn('[TwistyAtlas] Service Worker 注册失败', error);
          },
        });
      })
      .catch(() => undefined);
  }
}

void bootstrap();
