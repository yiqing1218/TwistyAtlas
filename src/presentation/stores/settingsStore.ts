import { defineStore } from 'pinia';
import { DEFAULT_SETTINGS, STANDARD_COLORS, type AppSettings, type ThemeMode } from '@/domain/model/settings';
import { readSettingsRow, writeSettingsRow } from '@/infrastructure/persistence/database';
import { t } from '@/presentation/i18n';

function mergeSettings(stored: Partial<AppSettings> | null): AppSettings {
  if (!stored) return { ...DEFAULT_SETTINGS, faceColors: { ...STANDARD_COLORS } };
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    faceColors: { ...STANDARD_COLORS, ...(stored.faceColors ?? {}) },
    preferredCamera: stored.preferredCamera ?? undefined,
  };
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return theme;
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS, faceColors: { ...STANDARD_COLORS } } as AppSettings,
    loaded: false,
    saveError: null as string | null,
  }),
  getters: {
    effectiveTheme(state): 'light' | 'dark' {
      return resolveTheme(state.settings.theme);
    },
  },
  actions: {
    async load() {
      if (this.loaded) return;
      try {
        const stored = await readSettingsRow();
        this.settings = mergeSettings(stored);
      } catch (err) {
        this.saveError = t('store.loadSettingsFailed', { message: (err as Error).message });
        this.settings = mergeSettings(null);
      }
      this.loaded = true;
      this.applyTheme();
    },
    applyTheme() {
      if (typeof document === 'undefined') return;
      document.documentElement.dataset.theme = this.effectiveTheme;
      document.documentElement.style.colorScheme = this.effectiveTheme;
    },
    async update(patch: Partial<AppSettings>) {
      this.settings = mergeSettings({ ...this.settings, ...patch });
      this.applyTheme();
      try {
        await writeSettingsRow(this.settings);
        this.saveError = null;
      } catch (err) {
        this.saveError = t('store.saveSettingsFailed', { message: (err as Error).message });
      }
    },
    async reset() {
      this.settings = mergeSettings(null);
      this.applyTheme();
      try {
        await writeSettingsRow(this.settings);
        this.saveError = null;
      } catch (err) {
        this.saveError = t('store.saveSettingsFailedShort', { message: (err as Error).message });
      }
    },
  },
});
