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
    successMessage.value = kind === 'json' ? '完整备份已开始下载。' : 'CSV 已开始下载（含 UTF-8 BOM）。';
  } catch (err) {
    errorMessage.value = `导出失败：${(err as Error).message}`;
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
    errorMessage.value = `文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB 超过上限 5MB`;
    return;
  }
  const lower = file.name.toLowerCase();
  const format: 'json' | 'csv' | null = lower.endsWith('.json')
    ? 'json'
    : lower.endsWith('.csv')
      ? 'csv'
      : null;
  if (!format) {
    errorMessage.value = '只支持 .json 备份文件或 .csv 文件';
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
    successMessage.value = `导入完成：新增 ${result.added} 条，覆盖 ${result.overwritten} 条，跳过 ${result.skipped} 条，失败 ${result.failed} 条。`;
    preview.value = null;
  } catch (err) {
    errorMessage.value = `导入失败，已回滚：${(err as Error).message}`;
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
      <div class="dialog" role="dialog" aria-modal="true" aria-label="导入导出">
        <header class="dialog__header">
          <h2 class="dialog__title">导入 / 导出</h2>
          <button type="button" class="btn btn--ghost btn--icon" aria-label="关闭" @click="close">✕</button>
        </header>

        <div class="tabs">
          <button type="button" class="tabs__item" :class="{ 'tabs__item--active': tab === 'export' }" @click="tab = 'export'">
            导出备份
          </button>
          <button type="button" class="tabs__item" :class="{ 'tabs__item--active': tab === 'import' }" @click="tab = 'import'">
            导入数据
          </button>
        </div>

        <div class="dialog__body">
          <template v-if="tab === 'export'">
            <p class="small muted">
              数据保存在当前浏览器的 IndexedDB 中。<strong>清理浏览器数据会删除公式</strong>，建议定期导出备份。
            </p>
            <div class="export-grid">
              <div class="export-card">
                <h3>完整备份（JSON）</h3>
                <p class="small muted">包含公式、分类与设置，可完整恢复。</p>
                <button type="button" class="btn btn--primary" :disabled="busy" data-testid="export-json" @click="doExport('json', true)">
                  导出 JSON
                </button>
              </div>
              <div class="export-card">
                <h3>公式表格（CSV）</h3>
                <p class="small muted">便于在 Excel 中查看；标签以 JSON 数组存放。</p>
                <button type="button" class="btn" :disabled="busy" data-testid="export-csv" @click="doExport('csv')">
                  导出 CSV
                </button>
              </div>
            </div>
            <p class="small muted">当前公式数量：{{ store.formulas.length }} 条（当前筛选）。</p>
          </template>

          <template v-else>
            <label
              class="dropzone"
              @dragover.prevent
              @drop="onDrop"
            >
              <input type="file" accept=".json,.csv,application/json,text/csv" class="visually-hidden" data-testid="import-file" @change="onFileChange" />
              <strong>选择或拖入 .json / .csv 文件</strong>
              <span class="small muted">最大 5MB；导入前会先做校验与预览，不会直接写入。</span>
            </label>

            <p v-if="fileName" class="small muted">已选择：{{ fileName }}</p>

            <template v-if="preview">
              <div class="summary">
                <span class="badge">共 {{ counts.total }} 条</span>
                <span class="badge badge--success">新增 {{ counts.newCount }}</span>
                <span class="badge badge--warning">重复 {{ counts.duplicate }}</span>
                <span class="badge badge--danger">无效 {{ counts.invalid }}</span>
              </div>

              <fieldset class="fieldset">
                <legend class="field__label">重复记录处理方式</legend>
                <label class="checkbox-row">
                  <input v-model="strategy" type="radio" value="skip" />
                  跳过重复（保留现有数据）
                </label>
                <label class="checkbox-row">
                  <input v-model="strategy" type="radio" value="overwrite" />
                  覆盖现有记录
                </label>
                <label class="checkbox-row">
                  <input v-model="strategy" type="radio" value="new" />
                  作为新记录全部导入
                </label>
              </fieldset>

              <div class="preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>状态</th>
                      <th>名称</th>
                      <th>魔方</th>
                      <th>公式</th>
                      <th>说明</th>
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
                          {{ item.kind === 'new' ? '新增' : item.kind === 'duplicate' ? '重复' : '无效' }}
                        </span>
                      </td>
                      <td>{{ item.record.title }}</td>
                      <td class="mono small">{{ item.record.puzzleId }}</td>
                      <td class="mono small">{{ item.record.alg }}</td>
                      <td class="small muted">{{ item.reason ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-if="preview.items.length > 50" class="small muted">仅显示前 50 条，共 {{ preview.items.length }} 条。</p>
              </div>
            </template>

            <p v-if="errorMessage" class="alert alert--error" data-testid="import-error">{{ errorMessage }}</p>
            <p v-if="successMessage" class="alert alert--success" data-testid="import-success">{{ successMessage }}</p>
          </template>
        </div>

        <footer class="dialog__footer">
          <span class="spacer"></span>
          <button type="button" class="btn" @click="close">关闭</button>
          <button
            v-if="tab === 'import' && preview"
            type="button"
            class="btn btn--primary"
            :disabled="busy"
            data-testid="confirm-import"
            @click="applyNow"
          >
            {{ busy ? '导入中…' : `确认导入（${counts.newCount + counts.duplicate} 条可写入）` }}
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
