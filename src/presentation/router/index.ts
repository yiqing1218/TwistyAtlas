import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '@/presentation/views/HomeView.vue';
import { isMobileViewport } from '@/presentation/composables/useViewport';

/**
 * 采用 hash 路由：静态托管（含子路径、本地直接打开 dist）都不需要服务端 rewrite，
 * 深链接不会 404。任务书允许在没有 fallback 配置时使用 hash 路由。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { titleKey: 'nav.home' },
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/presentation/views/LibraryView.vue'),
      meta: { titleKey: 'nav.library' },
    },
    {
      path: '/formula/:id',
      name: 'formula',
      component: () => import('@/presentation/views/FormulaDetailView.vue'),
      // 详情页用 props 接收 id（原先没开 props 时 id 恒为 undefined，页面会一直停在"正在读取"）
      props: true,
      meta: { titleKey: 'nav.formulaDetail' },
    },
    {
      path: '/timer',
      name: 'timer',
      component: () => import('@/presentation/views/TimerView.vue'),
      meta: { titleKey: 'nav.timer' },
    },
    {
      path: '/sets',
      name: 'sets',
      component: () => import('@/presentation/views/SetsView.vue'),
      meta: { titleKey: 'nav.sets' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/presentation/views/SettingsView.vue'),
      meta: { titleKey: 'nav.settings' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

/**
 * 手机端没有「工作台」这个三栏合一视图：它被拆成「公式集」（看公式）
 * 与「公式库」（管公式）两个底部页签。这里做一次落地重定向，避免手机用户
 * 进来撞上一个只能横向铺开的桌面版三栏页面。
 */
router.beforeEach((to) => {
  if (to.name === 'home' && isMobileViewport()) {
    return { name: 'sets', replace: true };
  }
  return true;
});

/**
 * 文档标题统一由 App.vue 维护：它同时依赖路由与当前语言，
 * 切换语言时标题会立刻跟着变。路由这里只保留 meta.titleKey 作为页名来源，
 * 不再单独设置 document.title，避免两处打架。
 */

export default router;
