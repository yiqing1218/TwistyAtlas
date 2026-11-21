<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FormulaList from '../components/FormulaList.vue';
import FormulaDetailPanel from '../components/FormulaDetailPanel.vue';
import FormulaEditor from '../components/FormulaEditor.vue';
import ImportDialog from '../components/ImportDialog.vue';
import PlaybackToolbar from '../components/PlaybackToolbar.vue';
import PuzzlePicker from '../components/PuzzlePicker.vue';
import PuzzleViewport from '../components/PuzzleViewport.vue';
import AlgorithmTokens from '../components/AlgorithmTokens.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';
import { useFormulaStore } from '../stores/formulaStore';
import { usePlayerStore } from '../stores/playerStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { FormulaRecord } from '../types/formula';
import { getPuzzleDescriptor } from '../engine/puzzleRegistry';

const router = useRouter();
const store = useFormulaStore();
const player = usePlayerStore();
const settings = useSettingsStore();

const puzzleId = ref(settings.settings.defaultPuzzleId);
const editorOpen = ref(false);
const editingRecord = ref<FormulaRecord | null>(null);
const importOpen = ref(false);
const mobileTab = ref<'library' | 'detail'>('library');
const notice = ref<string | null>(null);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

const selected = computed(() => store.selected ?? null);
const descriptor = computed(() => getPuzzleDescriptor(puzzleId.value));
const pageReady = computed(() => store.initialized);

function flashNotice(message: string, timeout = 6000) {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  if (timeout > 0) noticeTimer = setTimeout(() => (notice.value = null), timeout);
}

async function loadFormulaIntoPlayer(record: FormulaRecord) {
  await player.loadFormula({
    formulaId: record.id,
    puzzleId: record.puzzleId,
    title: record.title,
    alg: record.alg,
    setupMode: record.setupMode,
    setupAlg: record.setupAlg,
  });
}

async function selectFormula(id: string) {
  await store.select(id);
  const record = store.selected;
  if (record) {
    mobileTab.value = 'detail';
    await loadFormulaIntoPlayer(record);
  }
}

async function syncSelectionToPlayer() {
  const record = store.selected;
  if (record && player.target?.formulaId !== record.id) {
    await loadFormulaIntoPlayer(record);
  }
}

async function changePuzzle(id: string) {
  puzzleId.value = id;
  player.pause();
  await store.setFilter({ puzzleId: id });
  await syncSelectionToPlayer();
}

watch(
  () => store.selectedId,
  async () => {
    await syncSelectionToPlayer();
  },
);

onMounted(async () => {
  await settings.load();
  puzzleId.value = settings.settings.defaultPuzzleId;
  await store.setFilter({ puzzleId: puzzleId.value });
  store.initialized = true;
  await syncSelectionToPlayer();
  window.addEventListener('keydown', onKeydown, { passive: false });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  if (noticeTimer) clearTimeout(noticeTimer);
});

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function onKeydown(event: KeyboardEvent) {
  if (editorOpen.value || importOpen.value) return;
  if (isTypingTarget(event.target)) return;
  switch (event.key) {
    case ' ':
    case 'Spacebar':
      event.preventDefault();
      player.togglePlay();
      break;
    case 'ArrowRight':
      event.preventDefault();
      player.nextStep();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      player.previousStep();
      break;
    case 'Home':
      event.preventDefault();
      player.seekToStart();
      break;
    case 'End':
      event.preventDefault();
      player.seekToEnd();
      break;
    default:
      break;
  }
}

function openCreate() {
  editingRecord.value = null;
  editorOpen.value = true;
}

function openEdit() {
  if (!selected.value) return;
  editingRecord.value = selected.value;
  editorOpen.value = true;
}

async function onSaved(record: FormulaRecord) {
  await store.setFilter({ puzzleId: record.puzzleId });
  puzzleId.value = record.puzzleId;
  store.selectedId = record.id;
  await loadFormulaIntoPlayer(record);
  flashNotice(`已保存「${record.title}」`);
}

async function duplicateSelected() {
  if (!selected.value) return;
  try {
    const copy = await store.duplicate(selected.value.id);
    await loadFormulaIntoPlayer(copy);
    flashNotice(`已创建副本「${copy.title}」`);
  } catch (err) {
    flashNotice(`复制失败：${(err as Error).message}`, 8000);
  }
}

async function removeSelected() {
  const record = selected.value;
  if (!record) return;
  const confirmed = window.confirm(`确定删除「${record.title}」吗？删除后可以在提示条中撤销。`);
  if (!confirmed) return;
  player.pause();
  await store.remove(record.id);
  await syncSelectionToPlayer();
  flashNotice(`已删除「${record.title}」`, 10000);
}

async function undoDelete() {
  await store.undoDelete();
  notice.value = null;
  await syncSelectionToPlayer();
}

async function toggleFavoriteSelected() {
  if (!selected.value) return;
  await store.toggleFavorite(selected.value.id);
}

function openStandalonePage() {
  if (!selected.value) return;
  void router.push({ name: 'formula', params: { id: selected.value.id } });
}
</script>

<template>
  <ErrorBoundary>
    <div class="studio">
      <header class="studio__bar">
        <PuzzlePicker :model-value="puzzleId" @update:model-value="changePuzzle" />
        <div class="studio__bar-actions">
          <button type="button" class="btn btn--sm" @click="importOpen = true">导入 / 导出</button>
          <button type="button" class="btn btn--sm btn--primary" @click="openCreate">新建公式</button>
        </div>
      </header>

      <p v-if="descriptor?.status === 'experimental'" class="alert alert--warning">
        {{ descriptor.displayNameZh }}的公式解析与状态计算已可用，但三维形变渲染尚未通过逐状态验收，播放结果仅供参考。
      </p>

      <div class="studio__grid">
        <aside class="studio__sidebar panel" :class="{ 'studio__sidebar--active': mobileTab === 'library' }">
          <div class="panel__header">
            <span class="panel__title">公式库</span>
            <RouterLink to="/library" class="btn btn--sm btn--ghost">管理</RouterLink>
          </div>
          <FormulaList compact @select="selectFormula" @create="openCreate" />
        </aside>

        <section class="studio__center">
          <PuzzleViewport />

          <PlaybackToolbar />

          <div class="tokens-panel panel">
            <AlgorithmTokens />
          </div>

          <div v-if="player.loadWarning" class="alert alert--warning">{{ player.loadWarning }}</div>
          <div v-if="player.loadError" class="alert alert--error" data-testid="player-error">{{ player.loadError }}</div>
          <div v-if="notice" class="alert alert--success" data-testid="notice">
            <span>{{ notice }}</span>
            <button v-if="store.lastDeleted" type="button" class="btn btn--sm" @click="undoDelete">撤销删除</button>
          </div>
          <p v-if="pageReady && store.formulas.length === 0" class="alert">
            当前魔方类型还没有公式。点击「新建公式」添加一条，或到
            <RouterLink to="/library">公式库</RouterLink> 导入 CSV / JSON。
          </p>
        </section>

        <aside class="studio__detail panel" :class="{ 'studio__detail--active': mobileTab === 'detail' }">
          <FormulaDetailPanel
            :record="selected"
            :category-name="selected ? store.categoryName(selected.categoryId) : ''"
            @edit="openEdit"
            @duplicate="duplicateSelected"
            @remove="removeSelected"
            @favorite="toggleFavoriteSelected"
            @open-page="openStandalonePage"
          />
        </aside>

        <div class="studio__tabs" role="tablist" aria-label="移动端面板切换">
          <button
            type="button"
            class="studio__tab"
            :class="{ 'studio__tab--active': mobileTab === 'library' }"
            role="tab"
            :aria-selected="mobileTab === 'library'"
            @click="mobileTab = 'library'"
          >
            公式库
          </button>
          <button
            type="button"
            class="studio__tab"
            :class="{ 'studio__tab--active': mobileTab === 'detail' }"
            role="tab"
            :aria-selected="mobileTab === 'detail'"
            @click="mobileTab = 'detail'"
          >
            详情与说明
          </button>
        </div>
      </div>
    </div>

    <FormulaEditor :open="editorOpen" :record="editingRecord" @close="editorOpen = false" @saved="onSaved" />
    <ImportDialog :open="importOpen" @close="importOpen = false" />
  </ErrorBoundary>
</template>

<style scoped>
.studio {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  min-height: 0;
  padding: var(--space-3) var(--space-3) var(--space-3);
}

.studio__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.studio__bar-actions {
  display: flex;
  gap: 6px;
}

.studio__grid {
  display: grid;
  gap: var(--space-2);
  flex: 1;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr);
}

.studio__sidebar,
.studio__detail {
  display: none;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.studio__sidebar--active,
.studio__detail--active {
  display: flex;
}

.studio__center {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  min-height: 0;
}

.tokens-panel {
  padding: 8px 10px;
}

.studio__tabs {
  display: flex;
  gap: 6px;
  padding: 2px;
  border-radius: var(--radius);
  background: var(--surface-3);
}

.studio__tab {
  flex: 1;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  min-height: var(--touch-target);
}

.studio__tab--active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.studio__detail {
  max-height: 70vh;
}

@media (min-width: 1280px) {
  .studio {
    height: calc(100dvh - var(--header-height));
    overflow: hidden;
  }

  .studio__grid {
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--detail-width);
  }

  .studio__sidebar,
  .studio__detail {
    display: flex !important;
    max-height: none;
  }

  .studio__tabs {
    display: none;
  }
}

@media (min-width: 768px) and (max-width: 1279px) {
  .studio__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .studio__center {
    order: 1;
  }

  .studio__tabs {
    order: 2;
  }

  .studio__sidebar,
  .studio__detail {
    order: 3;
    max-height: 60vh;
  }
}

@media (max-width: 767px) {
  .studio {
    padding: var(--space-2);
  }

  .studio__bar-actions .btn {
    min-height: 36px;
  }
}
</style>
