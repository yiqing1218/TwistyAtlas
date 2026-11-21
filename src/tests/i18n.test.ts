import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCALES,
  LOCALE_TAG,
  detectLocale,
  resetLocaleForTests,
  setLocale,
  t,
  type Locale,
  type MessageKey,
} from '@/presentation/i18n';
import { zhCN } from '@/presentation/i18n/messages/zh-CN';
import { en } from '@/presentation/i18n/messages/en';
import { ja } from '@/presentation/i18n/messages/ja';
import { ru } from '@/presentation/i18n/messages/ru';
import { es } from '@/presentation/i18n/messages/es';
import { ptBR } from '@/presentation/i18n/messages/pt-BR';

const TABLES: Record<Locale, Record<MessageKey, string>> = {
  'zh-CN': zhCN,
  en,
  ja,
  ru,
  es,
  'pt-BR': ptBR,
};

const ORIGINAL_LANGUAGES = [...navigator.languages];

function setNavigatorLanguages(languages: string[]): void {
  Object.defineProperty(navigator, 'languages', {
    value: languages,
    configurable: true,
  });
}

afterEach(() => {
  setNavigatorLanguages(ORIGINAL_LANGUAGES);
  resetLocaleForTests('auto');
  localStorage.removeItem('twisty-atlas:locale');
});

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe('六语字典', () => {
  it('恰好支持 zh-CN / en / ja / ru / es / pt-BR', () => {
    expect([...LOCALES]).toEqual(['zh-CN', 'en', 'ja', 'ru', 'es', 'pt-BR']);
    expect(Object.keys(TABLES).sort()).toEqual([...LOCALES].sort());
  });

  it('每种语言的键集合与基准字典完全一致', () => {
    const baseline = Object.keys(zhCN).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(TABLES[locale]).sort(), `${locale} 键集合`).toEqual(baseline);
    }
  });

  it('每种语言的文案非空，且插值占位符与基准一致', () => {
    for (const locale of LOCALES) {
      for (const key of Object.keys(zhCN) as MessageKey[]) {
        const value = TABLES[locale][key];
        expect(value?.trim(), `${locale}.${key}`).toBeTruthy();
        expect(placeholders(value), `${locale}.${key} 占位符`).toEqual(
          placeholders(zhCN[key]),
        );
      }
    }
  });
});

describe('语言检测与切换', () => {
  it('按 BCP 47 标签落到支持的语言，未命中时回退英文', () => {
    expect(detectLocale(['zh-Hant-TW'])).toBe('zh-CN');
    expect(detectLocale(['ja-JP'])).toBe('ja');
    expect(detectLocale(['ru-RU'])).toBe('ru');
    expect(detectLocale(['es-MX', 'en-US'])).toBe('es');
    expect(detectLocale(['pt-PT'])).toBe('pt-BR');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['fr-FR', 'de-DE'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it('切换后立即生效、写入 localStorage 并同步 html lang', () => {
    for (const locale of LOCALES) {
      setLocale(locale);
      expect(localStorage.getItem('twisty-atlas:locale')).toBe(locale);
      expect(document.documentElement.lang).toBe(LOCALE_TAG[locale]);
      expect(t('nav.settings')).toBe(TABLES[locale]['nav.settings']);
    }
  });

  it('跟随系统时按 navigator.languages 解析', () => {
    setNavigatorLanguages(['ru-RU', 'en-US']);
    resetLocaleForTests('auto');
    expect(t('nav.settings')).toBe(ru['nav.settings']);
    expect(document.documentElement.lang).toBe('ru');
  });

  it('插值替换占位符；缺失键回退为键名', () => {
    setLocale('zh-CN');
    expect(t('common.items', { n: 7 })).toBe('7 条');
    expect(t('__missing' as MessageKey)).toBe('__missing');
  });
});
