import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '@/presentation/views/HomeView.vue';

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

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '魔方公式图谱';
  document.title = `${title} · Twisty Atlas`;
});

export default router;
