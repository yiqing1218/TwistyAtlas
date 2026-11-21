<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ImportDialog from '@/presentation/components/ImportDialog.vue';
import ErrorBoundary from '@/presentation/components/ErrorBoundary.vue';
import PuzzlePicker from '@/presentation/components/PuzzlePicker.vue';
import { useSettingsStore } from '@/presentation/stores/settingsStore';
import { useFormulaStore } from '@/presentation/stores/formulaStore';
import { SPEED_OPTIONS, type ThemeMode } from '@/domain/model/settings';
import { PUZZLE_DESCRIPTORS } from '@/infrastructure/cubing/puzzleRegistry';
import { useI18n, type LocalePreference, type MessageKey } from '@/presentation/i18n';
import { puzzleName, puzzleNote, statusLabel } from '@/presentation/i18n/labels';
import { db } from '@/infrastructure/persistence/database';
import { clearFormulas } from '@/infrastructure/persistence/formulaRepository';
import { seedDatabase } from '@/infrastructure/persistence/seed';

const settings = useSettingsStore();
const store = useFormulaStore();
const { t, preference, setLocale, locales, nativeName } = useI18n();
const importOpen = ref(false);
const message = ref<string | null>(null);
const counts = ref({ formulas: 0, categories: 0 });

const themes = computed<{ value: ThemeMode; label: string }[]>(() => [
  { value: 'light', label: t('settings.themeLight') },
  { value: 'dark', label: t('settings.themeDark') },
  { value: 'system', label: t('settings.themeSystem') },
]);

const faceLegend = computed(() => {
  const keys: Record<string, MessageKey> = {
    U: 'settings.faceU', D: 'settings.faceD', F: 'settings.faceF',
    B: 'settings.faceB', R: 'settings.faceR', L: 'settings.faceL',
  };
  return (['U', 'D', 'F', 'B', 'R', 'L'] as const).map((key) => ({
    key,
    label: t(keys[key]),
    color: settings.settings.faceColors[key],
  }));
});

function changeLanguage(event: Event) {
  setLocale((event.target as HTMLSelectElement).value as LocalePreference);
}

async function refreshCounts() {
  counts.value = {
    formulas: await db.formulas.count(),
    categories: await db.categories.count(),
  };
}

onMounted(refreshCounts);

async function setTheme(theme: ThemeMode) {
  await settings.update({ theme });
}

async function setSpeed(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value);
  await settings.update({ playbackSpeed: value });
}

async function setDefaultPuzzle(id: string) {
  await settings.update({ defaultPuzzleId: id });
}

async function toggleHintFacelets(event: Event) {
  await settings.update({ showHintFacelets: (event.target as HTMLInputElement).checked });
}

async function toggleLockCamera(event: Event) {
  await settings.update({ lockCamera: (event.target as HTMLInputElement).checked });
}

async function clearAll() {
  const first = window.confirm(t('settings.confirmClear1'));
  if (!first) return;
  const second = window.confirm(t('settings.confirmClear2'));
  if (!second) return;
  try {
    await clearFormulas();
    await store.refresh();
    await refreshCounts();
    message.value = t('settings.cleared');
  } catch (err) {
    message.value = t('settings.clearFailed', { message: (err as Error).message });
  }
}

async function reseed() {
  try {
    await seedDatabase(true);
    await store.refresh();
    await refreshCounts();
    message.value = t('settings.reseeded');
  } catch (err) {
    message.value = t('settings.reseedFailed', { message: (err as Error).message });
  }
}
</script>

<template>
  <ErrorBoundary>
    <div class="settings">
      <header class="settings__header">
        <h1 class="settings__title">{{ t('settings.title') }}</h1>
        <p class="muted small">{{ t('settings.subtitle') }}</p>
      </header>

      <p v-if="message" class="alert alert--success">{{ message }}</p>
      <p v-if="settings.saveError" class="alert alert--error">{{ settings.saveError }}</p>

      <section class="panel">
        <div class="panel__header"><span class="panel__title">{{ t('settings.appearance') }}</span></div>
        <div class="panel__body stack">
          <div class="field">
            <span class="field__label">{{ t('settings.theme') }}</span>
            <div class="segmented" role="group" :aria-label="t('settings.theme')">
              <button
                v-for="theme in themes"
                :key="theme.value"
                type="button"
                class="segmented__item"
                :class="{ 'segmented__item--active': settings.settings.theme === theme.value }"
                @click="setTheme(theme.value)"
              >
                {{ theme.label }}
              </button>
            </div>
          </div>
          <div class="field">
            <span class="field__label">{{ t('settings.language') }}</span>
            <select
              class="select"
              data-testid="locale-select"
              :aria-label="t('settings.language')"
              :value="preference"
              @change="changeLanguage"
            >
              <option value="auto">{{ t('settings.languageAuto') }}</option>
              <option v-for="lang in locales" :key="lang" :value="lang">{{ nativeName[lang] }}</option>
            </select>
            <p class="field__hint">{{ t('settings.languageHint') }}</p>
          </div>
          <div class="field">
            <span class="field__label">{{ t('settings.colorReference') }}</span>
            <div class="faces">
              <span v-for="face in faceLegend" :key="face.key" class="face">
                <span class="face__swatch" :style="{ background: face.color }"></span>
                {{ face.label }}
              </span>
            </div>
            <p class="field__hint">{{ t('settings.colorHint') }}</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header"><span class="panel__title">{{ t('settings.playback') }}</span></div>
        <div class="panel__body stack">
          <div class="grid-2">
            <label class="field">
              <span class="field__label">{{ t('settings.defaultSpeed') }}</span>
              <select class="select" :value="settings.settings.playbackSpeed" @change="setSpeed">
                <option v-for="speed in SPEED_OPTIONS" :key="speed" :value="speed">{{ speed }}×</option>
              </select>
            </label>
            <div class="field">
              <span class="field__label">{{ t('settings.defaultPuzzle') }}</span>
              <PuzzlePicker :model-value="settings.settings.defaultPuzzleId" @update:model-value="setDefaultPuzzle" />
            </div>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" :checked="settings.settings.showHintFacelets" @change="toggleHintFacelets" />
            {{ t('settings.hintFacelets') }}
          </label>
          <label class="checkbox-row">
            <input type="checkbox" :checked="settings.settings.lockCamera" @change="toggleLockCamera" />
            {{ t('settings.lockCamera') }}
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header">
          <span class="panel__title">{{ t('settings.data') }}</span>
          <span class="badge">{{ t('settings.dataCount', { formulas: counts.formulas, categories: counts.categories }) }}</span>
        </div>
        <div class="panel__body stack">
          <div class="row">
            <button type="button" class="btn" @click="importOpen = true">{{ t('settings.importExport') }}</button>
            <button type="button" class="btn" @click="reseed">{{ t('settings.reseed') }}</button>
            <button type="button" class="btn btn--danger" @click="clearAll">{{ t('settings.clearAll') }}</button>
          </div>
          <p class="field__hint">{{ t('settings.dataHint1') }} {{ t('settings.dataHint2') }}</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header">
          <span class="panel__title">{{ t('settings.matrix') }}</span>
          <span class="small muted">{{ t('settings.matrixHint') }}</span>
        </div>
        <div class="panel__body">
          <table class="matrix">
            <thead>
              <tr>
                <th>{{ t('settings.colPuzzle') }}</th>
                <th>{{ t('settings.colStatus') }}</th>
                <th>{{ t('settings.colAlg') }}</th>
                <th>{{ t('settings.colSeek') }}</th>
                <th>{{ t('settings.colNote') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="puzzle in PUZZLE_DESCRIPTORS" :key="puzzle.id">
                <td>
                  <strong>{{ puzzleName(puzzle.id) }}</strong>
                  <span class="mono small muted">{{ puzzle.id }}</span>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="puzzle.status === 'ready-3d' ? 'badge--success' : 'badge--warning'"
                  >{{ statusLabel(puzzle.status) }}</span>
                </td>
                <td>{{ puzzle.supportsAnimation ? t('common.supported') : t('common.unsupported') }}</td>
                <td>{{ puzzle.supportsStepSeek ? t('common.supported') : t('common.unsupported') }}</td>
                <td class="small muted">{{ puzzleNote(puzzle.id) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header"><span class="panel__title">{{ t('settings.about') }}</span></div>
        <div class="panel__body stack small muted">
          <p>{{ t('settings.aboutLine') }}</p>
          <ul class="limits">
            <li>{{ t('settings.limitSquare1') }}</li>
            <li>{{ t('settings.limitCustom') }}</li>
            <li>{{ t('settings.limitBigCube') }}</li>
            <li>{{ t('settings.limitInstall') }}</li>
          </ul>
        </div>
      </section>
    </div>

    <ImportDialog :open="importOpen" @close="importOpen = false" />
  </ErrorBoundary>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  max-width: 980px;
  /* 设置是"小页面"：允许在容器内上下滑动，不撑破整屏 */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
  margin: 0 auto;
}

.settings__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings__title {
  font-size: 20px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.segmented {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  background: var(--surface-3);
  border-radius: var(--radius-sm);
  width: fit-content;
}

.segmented__item {
  padding: 5px 12px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.segmented__item--active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.faces {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.face {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.face__swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--border-strong);
}

.matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.matrix th,
.matrix td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.matrix th {
  font-size: 12px;
  color: var(--muted);
  background: var(--surface-2);
}

.limits {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (max-width: 640px) {
  .settings {
    padding: 8px 10px 12px;
    gap: 10px;
  }

  /* 顶部栏已经显示了页名，正文里不再重复一遍标题 */
  .settings__title {
    display: none;
  }

  .grid-2 {
    grid-template-columns: 1fr;
  }

  .matrix {
    font-size: 12px;
  }

  /* 能力矩阵在窄屏只保留「魔方 / 状态 / 说明」，其余两列次要 */
  .matrix th:nth-child(3),
  .matrix td:nth-child(3),
  .matrix th:nth-child(4),
  .matrix td:nth-child(4) {
    display: none;
  }

  /* 配色只有对照说明，长解释在手机上收掉 */
  .faces + .field__hint {
    display: none;
  }

  /* 面板标题旁的补充说明在窄屏会把标题挤到换行，收掉 */
  .panel__header .small.muted {
    display: none;
  }
}
</style>
