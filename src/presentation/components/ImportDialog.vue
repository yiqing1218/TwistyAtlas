<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFormulaStore } from '@/presentation/stores/formulaStore';
import {
  MAX_IMPORT_BYTES,
  applyImport,
  exportCsv,
  exportJson,
  parseImportText,
  type ImportStrategy,
} from '@/infrastructure/persistence/importExport';
import type { ImportPreview } from '@/domain/model/formula';
import { useI18n } from '@/presentation/i18n';

const { t } = useI18n();
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (event: 'close'): void }>();

const store = useFormulaStore();
const tab = ref<'import' | 'export'>('export');
const preview = ref<ImportPreview | null>(null);
const strategy = ref<ImportStrategy>('skip');
const busy = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const fileName = ref<string>('');

const counts = computed(() => {
  const items = preview.value?.items ?? [];
  return {
    total: items.length,
    newCount: items.filter((i) => i.kind === 'new').length,
    duplicate: items.filter((i) => i.kind === 'duplicate').length,
    invalid: items.filter((i) => i.kind === 'invalid').length,
  };
});

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    tab.value = 'export';
    preview.value = null;
    errorMessage.value = null;
    successMessage.value = null;
    strategy.value = 'skip';
    fileName.value = '';
  },
);

function close() {
  if (busy.value) return;
  emit('close');
}

async function doExport(kind: 'json' | 'csv', includeSettings = true) {
  busy.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    if (kind === 'json') await exportJson(includeSettings);
    else await exportCsv();
    successMessage.value = kind === 'json' ? t('import.exportedJson') : t('import.exportedCsv');
  } catch (err) {
    errorMessage.value = t('import.exportFailed', { message: (err as Error).message });
  } finally {
    busy.value = false;
  }
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  await readFile(file);
}

async function readFile(file: File) {
  errorMessage.value = null;
  successMessage.value = null;
  preview.value = null;
  fileName.value = file.name;
  if (file.size > MAX_IMPORT_BYTES) {
    errorMessage.value = t('import.tooLarge', { size: (file.size / 1024 / 1024).toFixed(2) });
    return;
  }
  const lower = file.name.toLowerCase();
  const format: 'json' | 'csv' | null = lower.endsWith('.json')
    ? 'json'
    : lower.endsWith('.csv')
      ? 'csv'
      : null;
  if (!format) {
    errorMessage.value = t('import.badType');
    return;
  }
  busy.value = true;
  try {
    const text = await file.text();
    preview.value = await parseImportText(text, format, { fileName: file.name });
  } catch (err) {
    errorMessage.value = (err as Error).message;
  } finally {
    busy.value = false;
  }
}

async function applyNow() {
  if (!preview.value) return;
  busy.value = true;
  errorMessage.value = null;
  try {
    const result = await applyImport(preview.value, strategy.value);
    await store.refresh();
    successMessage.value = t('import.done', {
      added: result.added,
      overwritten: result.overwritten,
      skipped: result.skipped,
      failed: result.failed,
    });
    preview.value = null;
  } catch (err) {
    errorMessage.value = t('import.failed', { message: (err as Error).message });
  } finally {
    busy.value = false;
  }
}

async function onDrop(event: DragEvent) {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) await readFile(file);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @click.self="close">
      <div class="dialog" role="dialog" aria-modal="true" :aria-label="t('import.dialogLabel')">
        <header class="dialog__header">
          <h2 class="dialog__title">{{ t('import.title') }}</h2>
          <button type="button" class="btn btn--ghost btn--icon" :aria-label="t('common.close')" @click="close">✕</button>
        </header>

        <div class="tabs">
          <button type="button" class="tabs__item" :class="{ 'tabs__item--active': tab === 'export' }" @click="tab = 'export'">
            {{ t('import.tabExport') }}
          </button>
          <button type="button" class="tabs__item" :class="{ 'tabs__item--active': tab === 'import' }" @click="tab = 'import'">
            {{ t('import.tabImport') }}
          </button>
        </div>

        <div class="dialog__body">
          <template v-if="tab === 'export'">
            <p class="small muted">
              {{ t('import.storageHint') }}
            </p>
            <div class="export-grid">
              <div class="export-card">
                <h3>{{ t('import.jsonTitle') }}</h3>
                <p class="small muted">{{ t('import.jsonDesc') }}</p>
                <button type="button" class="btn btn--primary" :disabled="busy" data-testid="export-json" @click="doExport('json', true)">
                  {{ t('import.exportJson') }}
                </button>
              </div>
              <div class="export-card">
                <h3>{{ t('import.csvTitle') }}</h3>
                <p class="small muted">{{ t('import.csvDesc') }}</p>
                <button type="button" class="btn" :disabled="busy" data-testid="export-csv" @click="doExport('csv')">
                  {{ t('import.exportCsv') }}
                </button>
              </div>
            </div>
            <p class="small muted">{{ t('import.currentCount', { n: store.formulas.length }) }}</p>
          </template>

          <template v-else>
            <label
              class="dropzone"
              @dragover.prevent
              @drop="onDrop"
            >
              <input type="file" accept=".json,.csv,application/json,text/csv" class="visually-hidden" data-testid="import-file" @change="onFileChange" />
              <strong>{{ t('import.dropTitle') }}</strong>
              <span class="small muted">{{ t('import.dropHint') }}</span>
            </label>

            <p v-if="fileName" class="small muted">{{ t('import.selected', { name: fileName }) }}</p>

            <template v-if="preview">
              <div class="summary">
                <span class="badge">{{ t('import.countTotal', { n: counts.total }) }}</span>
                <span class="badge badge--success">{{ t('import.countNew', { n: counts.newCount }) }}</span>
                <span class="badge badge--warning">{{ t('import.countDuplicate', { n: counts.duplicate }) }}</span>
                <span class="badge badge--danger">{{ t('import.countInvalid', { n: counts.invalid }) }}</span>
              </div>

              <fieldset class="fieldset">
                <legend class="field__label">{{ t('import.dupStrategy') }}</legend>
                <label class="checkbox-row">
                  <input v-model="strategy" type="radio" value="skip" />
                  {{ t('import.skipDuplicate') }}
                </label>
                <label class="checkbox-row">
                  <input v-model="strategy" type="radio" value="overwrite" />
                  {{ t('import.overwrite') }}
                </label>
                <label class="checkbox-row">
                  <input v-model="strategy" type="radio" value="new" />
                  {{ t('import.importAsNew') }}
                </label>
              </fieldset>

              <div class="preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>{{ t('import.colStatus') }}</th>
                      <th>{{ t('import.colName') }}</th>
                      <th>{{ t('import.colPuzzle') }}</th>
                      <th>{{ t('import.colAlg') }}</th>
                      <th>{{ t('import.colNote') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, index) in preview.items.slice(0, 50)" :key="index">
                      <td>
                        <span
                          class="badge"
                          :class="{
                            'badge--success': item.kind === 'new',
                            'badge--warning': item.kind === 'duplicate',
                            'badge--danger': item.kind === 'invalid',
                          }"
                        >
                          {{ item.kind === 'new' ? t('import.kindNew') : item.kind === 'duplicate' ? t('import.kindDuplicate') : t('import.kindInvalid') }}
                        </span>
                      </td>
                      <td>{{ item.record.title }}</td>
                      <td class="mono small">{{ item.record.puzzleId }}</td>
                      <td class="mono small">{{ item.record.alg }}</td>
                      <td class="small muted">{{ item.reason ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="preview.items.length > 50" class="small muted">{{ t('import.onlyFirst50', { n: preview.items.length }) }}</p>
              </div>
            </template>

            <p v-if="errorMessage" class="alert alert--error" data-testid="import-error">{{ errorMessage }}</p>
            <p v-if="successMessage" class="alert alert--success" data-testid="import-success">{{ successMessage }}</p>
          </template>
        </div>

        <footer class="dialog__footer">
          <span class="spacer"></span>
          <button type="button" class="btn" @click="close">{{ t('common.close') }}</button>
          <button
            v-if="tab === 'import' && preview"
            type="button"
            class="btn btn--primary"
            :disabled="busy"
            data-testid="confirm-import"
            @click="applyNow"
          >
            {{ busy ? t('import.importing') : t('import.confirm', { n: counts.newCount + counts.duplicate }) }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  padding: 8px 18px 0;
  border-bottom: 1px solid var(--border);
}

.tabs__item {
  padding: 7px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.tabs__item--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.export-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.export-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
}

.export-card h3 {
  font-size: 13px;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--space-6);
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  text-align: center;
  cursor: pointer;
}

.dropzone:hover {
  border-color: var(--accent);
}

.summary {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.preview-table {
  max-height: 240px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.preview-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.preview-table th,
.preview-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.preview-table th {
  position: sticky;
  top: 0;
  background: var(--surface-3);
  font-weight: 600;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .export-grid {
    grid-template-columns: 1fr;
  }
}
</style>
