import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * 手机断点。与 `App.vue` 里底部页签的媒体查询、各视图的移动端样式保持一致，
 * 避免出现「导航按手机渲染、页面按桌面渲染」的错位。
 */
export const MOBILE_MAX_WIDTH = 760;

const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

/** 同步判断当前是否处于手机视口（路由守卫里用，不需要响应式）。 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** 响应式版本：视口跨过断点时自动更新，用于切换页面结构。 */
export function useIsMobile(): Ref<boolean> {
  const isMobile = ref(isMobileViewport());

  if (typeof window === 'undefined' || !window.matchMedia) return isMobile;

  const mql = window.matchMedia(MOBILE_QUERY);
  const update = (event: MediaQueryListEvent | MediaQueryList) => {
    isMobile.value = event.matches;
  };

  onMounted(() => {
    isMobile.value = mql.matches;
    if (mql.addEventListener) mql.addEventListener('change', update);
    else mql.addListener(update);
  });

  onBeforeUnmount(() => {
    if (mql.removeEventListener) mql.removeEventListener('change', update);
    else mql.removeListener(update);
  });

  return isMobile;
}
