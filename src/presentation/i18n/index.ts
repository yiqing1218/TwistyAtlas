/**
 * 轻量 i18n：零运行时依赖，键名类型安全。
 *
 * 为什么不用 vue-i18n：这里只需要「扁平键 + 插值 + 回退」，
 * 自写 60 行即可，省掉一个运行时依赖，也让 `t()` 在 Pinia store、
 * 纯函数里都能直接用（不依赖组件实例）。
 *
 * 复数：不实现。涉及数量的文案一律写成「标签 + 数值」或让译文
 * 自带量词，避免 "1 solves" 这类错误（俄语、阿拉伯语的复数规则
 * 硬套只会更糟）。
 */
import { computed, ref, type ComputedRef } from 'vue';
import { zhCN, type MessageKey } from './messages/zh-CN';
import { en } from './messages/en';
import { ja } from './messages/ja';
import { ru } from './messages/ru';
import { es } from './messages/es';
import { ptBR } from './messages/pt-BR';

export type { MessageKey };

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ru' | 'es' | 'pt-BR';

/** 用户选择：具体语言，或跟随系统 */
export type LocalePreference = Locale | 'auto';

export const LOCALES: readonly Locale[] = ['zh-CN', 'en', 'ja', 'ru', 'es', 'pt-BR'];

/** 语言自身名称（切换器里永远用母语写，不翻译） */
export const LOCALE_NATIVE_NAME: Record<Locale, string> = {
  'zh-CN': '简体中文',
  en: 'English',
  ja: '日本語',
  ru: 'Русский',
  es: 'Español',
  'pt-BR': 'Português (BR)',
};

/** html lang 属性用（BCP 47） */
export const LOCALE_TAG: Record<Locale, string> = {
  'zh-CN': 'zh-Hans',
  en: 'en',
  ja: 'ja',
  ru: 'ru',
  es: 'es',
  'pt-BR': 'pt-BR',
};

const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  'zh-CN': zhCN,
  en,
  ja,
  ru,
  es,
  'pt-BR': ptBR,
};

const STORAGE_KEY = 'twisty-atlas:locale';

function readNavigatorLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? [...navigator.languages] : [navigator.language];
}

/** 系统语言单独存成 ref：`auto` 模式才能真正响应式跟随 languagechange */
const systemLanguages = ref<readonly string[]>(readNavigatorLanguages());

/**
 * 把任意 BCP 47 标签落到支持的语言上。
 * 顺序即优先级：先精确语言，再同语种任何变体，最后英文兜底。
 */
export function detectLocale(languages?: readonly string[]): Locale {
  const list = languages ?? systemLanguages.value;

  for (const raw of list) {
    if (!raw) continue;
    const tag = raw.toLowerCase();
    if (tag.startsWith('zh')) return 'zh-CN';
    if (tag.startsWith('ja')) return 'ja';
    if (tag.startsWith('ru')) return 'ru';
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('pt')) return 'pt-BR';
    if (tag.startsWith('en')) return 'en';
  }
  // 没有匹配的母语用户也看得懂英文；中文用户已在上面命中 zh
  return 'en';
}

function readStoredPreference(): LocalePreference {
  if (typeof localStorage === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'auto';
    if (raw === 'auto') return 'auto';
    return (LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : 'auto';
  } catch {
    return 'auto';
  }
}

const preference = ref<LocalePreference>(readStoredPreference());

/** 实际生效的语言（`auto` 时按浏览器语言解析） */
const currentLocale = computed<Locale>(() =>
  preference.value === 'auto' ? detectLocale() : preference.value,
);

export type MessageParams = Record<string, string | number>;

function interpolate(text: string, params?: MessageParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

/**
 * 取译文。回退链：当前语言 → 英文 → 键名本身。
 * 键名兜底只在开发期出现（类型系统已保证六语键集合一致）。
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const table = MESSAGES[currentLocale.value];
  const text = table[key] ?? MESSAGES.en[key] ?? key;
  return interpolate(text, params);
}

function syncDocumentLang(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = LOCALE_TAG[currentLocale.value];
}

/** 切换语言（立即持久化，立即生效） */
export function setLocale(next: LocalePreference): void {
  preference.value = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 隐私模式下 localStorage 可能不可写：语言仍然在本次会话内生效
    }
  }
  syncDocumentLang();
}

export interface UseI18n {
  /** 当前实际语言 */
  locale: ComputedRef<Locale>;
  /** 用户的选择（含 auto） */
  preference: ComputedRef<LocalePreference>;
  t: typeof t;
  setLocale: typeof setLocale;
  locales: readonly Locale[];
  nativeName: Record<Locale, string>;
}

const preferenceReadonly = computed<LocalePreference>(() => preference.value);

export function useI18n(): UseI18n {
  return {
    locale: currentLocale,
    preference: preferenceReadonly,
    t,
    setLocale,
    locales: LOCALES,
    nativeName: LOCALE_NATIVE_NAME,
  };
}

/** 便于测试与非组件环境复位（同时刷新系统语言快照） */
export function resetLocaleForTests(pref: LocalePreference = 'auto'): void {
  systemLanguages.value = readNavigatorLanguages();
  preference.value = pref;
  syncDocumentLang();
}

// 系统语言变化时，`auto` 模式自动跟随
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('languagechange', () => {
    systemLanguages.value = readNavigatorLanguages();
    if (preference.value === 'auto') syncDocumentLang();
  });
}

syncDocumentLang();
