<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useSettingsStore } from '@/presentation/stores/settingsStore';

const route = useRoute();
const settings = useSettingsStore();

const navItems = [
  { name: 'home', label: '工作台', to: '/' },
  { name: 'timer', label: '计时器', to: '/timer' },
  { name: 'sets', label: '公式集', to: '/sets' },
  { name: 'library', label: '公式库', to: '/library' },
  { name: 'settings', label: '设置', to: '/settings' },
];

const isDark = computed(() => settings.effectiveTheme === 'dark');

async function toggleTheme() {
  await settings.update({ theme: isDark.value ? 'light' : 'dark' });
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink to="/" class="brand" aria-label="Twisty Atlas 首页">
        <span class="brand__mark" aria-hidden="true">
          <span class="brand__dot brand__dot--u"></span>
          <span class="brand__dot brand__dot--r"></span>
          <span class="brand__dot brand__dot--f"></span>
        </span>
        <span class="brand__text">Twisty Atlas</span>
      </RouterLink>

      <nav class="app-nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="app-nav__link"
          :class="{ 'app-nav__link--active': route.name === item.name }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="app-actions">
        <button
          type="button"
          class="btn btn--ghost btn--icon"
          :title="isDark ? '切换到浅色模式' : '切换到深色模式'"
          :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
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

.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 560px) {
  .app-header {
    gap: var(--space-2);
    padding: 0 var(--space-3);
  }

  .brand__text {
    display: none;
  }

  .app-nav__link {
    padding: 6px 8px;
  }
}
</style>
