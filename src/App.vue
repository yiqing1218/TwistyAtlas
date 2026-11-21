<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useSettingsStore } from '@/presentation/stores/settingsStore';
import { useI18n, type MessageKey } from '@/presentation/i18n';

const route = useRoute();
const settings = useSettingsStore();
const { t, locale } = useI18n();

interface NavItem {
  name: string;
  labelKey: MessageKey;
  to: string;
  icon: string;
  desktopOnly: boolean;
}

const navItems: NavItem[] = [
  { name: 'home', labelKey: 'nav.home', to: '/', icon: 'cube', desktopOnly: true },
  { name: 'timer', labelKey: 'nav.timer', to: '/timer', icon: 'timer', desktopOnly: false },
  { name: 'sets', labelKey: 'nav.sets', to: '/sets', icon: 'book', desktopOnly: false },
  { name: 'library', labelKey: 'nav.library', to: '/library', icon: 'list', desktopOnly: false },
  { name: 'settings', labelKey: 'nav.settings', to: '/settings', icon: 'gear', desktopOnly: false },
];

/** 手机上只保留 4 个核心页签，工作台（桌面三栏视图）不占底部空间 */
const mobileNavItems = navItems.filter((item) => !item.desktopOnly);

const currentTitle = computed(() => {
  if (route.name === 'formula') return t('nav.formulaDetail');
  const hit = navItems.find((item) => item.name === route.name);
  return hit ? t(hit.labelKey) : 'Twisty Atlas';
});

const isDark = computed(() => settings.effectiveTheme === 'dark');

const themeToggleLabel = computed(() =>
  isDark.value ? t('app.themeToLight') : t('app.themeToDark'),
);

/** 标题随语言与路由变化（依赖 locale 以便切换语言后立即重算） */
watchEffect(() => {
  void locale.value;
  document.title = route.name === 'home' || !currentTitle.value
    ? 'Twisty Atlas'
    : `${currentTitle.value} · Twisty Atlas`;
});

async function toggleTheme() {
  await settings.update({ theme: isDark.value ? 'light' : 'dark' });
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink to="/" class="brand" :aria-label="t('app.brandHome')">
        <span class="brand__mark" aria-hidden="true">
          <span class="brand__dot brand__dot--u"></span>
          <span class="brand__dot brand__dot--r"></span>
          <span class="brand__dot brand__dot--f"></span>
        </span>
        <span class="brand__text">Twisty Atlas</span>
      </RouterLink>

      <nav class="app-nav" :aria-label="t('nav.main')">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="app-nav__link"
          :class="{ 'app-nav__link--active': route.name === item.name }"
        >
          {{ t(item.labelKey) }}
        </RouterLink>
      </nav>

      <div class="app-actions">
        <span class="app-header__title">{{ currentTitle }}</span>
        <button
          type="button"
          class="btn btn--ghost btn--icon"
          :title="themeToggleLabel"
          :aria-label="themeToggleLabel"
          @click="toggleTheme"
        >
          <svg v-if="!isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </header>

    <main class="app-main">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>

    <!-- 手机端：底部页签（拇指可达），顶部只留标题与主题切换 -->
    <nav class="app-tabbar" :aria-label="t('nav.main')">
      <RouterLink
        v-for="item in mobileNavItems"
        :key="item.name"
        :to="item.to"
        class="app-tabbar__item"
        :class="{ 'app-tabbar__item--active': route.name === item.name }"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <template v-if="item.icon === 'timer'">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9 2h6" stroke-linecap="round" />
          </template>
          <template v-else-if="item.icon === 'book'">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" stroke-linejoin="round" />
            <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H19" stroke-linecap="round" />
          </template>
          <template v-else-if="item.icon === 'list'">
            <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke-linecap="round" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke-linecap="round" />
          </template>
        </svg>
        <span>{{ t(item.labelKey) }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  height: var(--header-height);
  padding: 0 var(--space-4);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-weight: 700;
  letter-spacing: -0.02em;
  text-decoration: none;
  flex-shrink: 0;
}

.brand:hover {
  text-decoration: none;
}

.brand__mark {
  display: grid;
  grid-template-columns: repeat(2, 8px);
  grid-template-rows: repeat(2, 8px);
  gap: 2px;
}

.brand__dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.brand__dot--u {
  background: #f7c948;
  grid-column: 1;
  grid-row: 1;
}

.brand__dot--r {
  background: #d63b3b;
  grid-column: 2;
  grid-row: 1;
}

.brand__dot--f {
  background: #2f9e63;
  grid-column: 1 / span 2;
  grid-row: 2;
}

.brand__text {
  font-size: 15px;
}

.app-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.app-nav::-webkit-scrollbar {
  display: none;
}

.app-nav__link {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.app-nav__link:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.app-nav__link--active {
  background: var(--accent-soft);
  color: var(--accent);
}

.app-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.app-header__title {
  display: none;
  font-size: 14px;
  font-weight: 600;
}

.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 桌面端不显示底部页签 */
.app-tabbar {
  display: none;
}

@media (max-width: 760px) {
  /* 手机端：整屏固定，页面内部各自滚动，避免"整页上下滑" */
  .app-shell {
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .app-header {
    position: relative;
    height: 48px;
    padding-top: max(0px, env(safe-area-inset-top));
    padding-left: max(12px, env(safe-area-inset-left));
    padding-right: max(12px, env(safe-area-inset-right));
    box-sizing: content-box;
    gap: 8px;
  }

  .brand__text {
    display: none;
  }

  /* 顶部不再放导航：只保留品牌、当前页名与主题按钮 */
  .app-nav {
    display: none;
  }

  .app-header__title {
    display: inline;
    margin-left: 2px;
    color: var(--text-secondary);
  }

  .app-main {
    overflow: hidden;
  }

  /* 底部页签：拇指可达 + 全面屏安全区 */
  .app-tabbar {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    align-items: stretch;
    gap: 2px;
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
    backdrop-filter: blur(10px);
    z-index: 40;
  }

  .app-tabbar__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
    text-decoration: none;
  }

  .app-tabbar__item:hover {
    text-decoration: none;
  }

  .app-tabbar__item--active {
    color: var(--accent);
    background: var(--accent-soft);
  }
}
</style>
