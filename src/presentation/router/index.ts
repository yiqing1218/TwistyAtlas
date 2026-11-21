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
      meta: { title: '工作台' },
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/presentation/views/LibraryView.vue'),
      meta: { title: '公式库' },
    },
    {
      path: '/formula/:id',
      name: 'formula',
      component: () => import('@/presentation/views/FormulaDetailView.vue'),
      // 详情页用 props 接收 id（原先没开 props 时 id 恒为 undefined，页面会一直停在"正在读取"）
      props: true,
      meta: { title: '公式详情' },
    },
    {
      path: '/timer',
      name: 'timer',
      component: () => import('@/presentation/views/TimerView.vue'),
      meta: { title: '计时器' },
    },
    {
      path: '/sets',
      name: 'sets',
      component: () => import('@/presentation/views/SetsView.vue'),
      meta: { title: '公式集' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/presentation/views/SettingsView.vue'),
      meta: { title: '设置' },
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

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '魔方公式图谱';
  document.title = `${title} · Twisty Atlas`;
});

export default router;
