<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FormulaList from '@/presentation/components/FormulaList.vue';
import FormulaDetailPanel from '@/presentation/components/FormulaDetailPanel.vue';
import FormulaEditor from '@/presentation/components/FormulaEditor.vue';
import ImportDialog from '@/presentation/components/ImportDialog.vue';
import PuzzlePicker from '@/presentation/components/PuzzlePicker.vue';
import ErrorBoundary from '@/presentation/components/ErrorBoundary.vue';
import { useFormulaStore } from '@/presentation/stores/formulaStore';
import { useSettingsStore } from '@/presentation/stores/settingsStore';
import { useIsMobile } from '@/presentation/composables/useViewport';
import type { FormulaRecord } from '@/domain/model/formula';

const router = useRouter();
const store = useFormulaStore();
const settings = useSettingsStore();
const isMobile = useIsMobile();

const puzzleId = ref(settings.settings.defaultPuzzleId);
const editorOpen = ref(false);
const editingRecord = ref<FormulaRecord | null>(null);
const importOpen = ref(false);
const message = ref<string | null>(null);

const selected = computed(() => store.selected ?? null);
const stats = computed(() => ({
  total: store.formulas.length,
  favorites: store.formulas.filter((f) => f.favorite).length,
  categories: store.categories.length,
}));

onMounted(async () => {
  await settings.load();
  puzzleId.value = settings.settings.defaultPuzzleId;
  await store.setFilter({ puzzleId: puzzleId.value });
});

watch(puzzleId, async (id) => {
  await store.setFilter({ puzzleId: id });
});

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
  puzzleId.value = record.puzzleId;
  store.selectedId = record.id;
  message.value = `已保存「${record.title}」`;
}

async function duplicateSelected() {
  if (!selected.value) return;
  try {
    await store.duplicate(selected.value.id);
    message.value = '已创建副本';
  } catch (err) {
    message.value = `复制失败：${(err as Error).message}`;
  }
}

async function removeSelected() {
  const record = selected.value;
  if (!record) return;
  if (!window.confirm(`确定删除「${record.title}」吗？`)) return;
  await store.remove(record.id);
  message.value = `已删除「${record.title}」`;
}

async function toggleFavoriteSelected() {
  if (!selected.value) return;
  await store.toggleFavorite(selected.value.id);
}

function openInStudio(id: string) {
  void router.push({ name: 'formula', params: { id } });
}

function selectFormula(id: string) {
  // 手机上不并排放「列表 + 详情」，点一条就直接进单条详情页（带播放器）
  if (isMobile.value) {
    void router.push({ name: 'formula', params: { id } });
    return;
  }
  void store.select(id);
}
</script>

<template>
  <ErrorBoundary>
    <div class="library-view">
      <header class="library-view__bar">
        <div class="row">
          <h1 class="library-view__title">公式库</h1>
          <span class="badge">{{ stats.total }} 条</span>
          <span class="badge badge--accent">收藏 {{ stats.favorites }}</span>
          <span class="badge">分类 {{ stats.categories }}</span>
        </div>
        <div class="row">
          <PuzzlePicker v-model="puzzleId" />
          <button type="button" class="btn btn--sm" @click="importOpen = true">导入 / 导出</button>
          <button type="button" class="btn btn--sm btn--primary" @click="openCreate">新建公式</button>
        </div>
      </header>

      <p v-if="message" class="alert alert--success">{{ message }}</p>

      <div class="library-view__grid">
        <div class="library-view__list panel">
          <FormulaList @select="selectFormula" @create="openCreate" />
        </div>
        <div v-if="!isMobile" class="library-view__detail panel">
          <FormulaDetailPanel
            :record="selected"
            :category-name="selected ? store.categoryName(selected.categoryId) : ''"
            @edit="openEdit"
            @duplicate="duplicateSelected"
            @remove="removeSelected"
            @favorite="toggleFavoriteSelected"
            @open-page="selected && openInStudio(selected.id)"
          />
        </div>
      </div>
    </div>

    <FormulaEditor :open="editorOpen" :record="editingRecord" @close="editorOpen = false" @saved="onSaved" />
    <ImportDialog :open="importOpen" @close="importOpen = false" />
  </ErrorBoundary>
</template>

<style scoped>
.library-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  flex: 1;
  min-height: 0;
}

.library-view__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.library-view__title {
  font-size: 18px;
}

.library-view__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--space-3);
  flex: 1;
  min-height: 0;
}

.library-view__list,
.library-view__detail {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 420px;
}

@media (max-width: 1023px) {
  .library-view__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .library-view__list {
    min-height: 50vh;
  }
}

/* 手机：只有一列列表，列表内部滚动，整页不上下滑 */
@media (max-width: 760px) {
  .library-view {
    padding: 8px 10px 0;
    gap: 8px;
    overflow: hidden;
  }

  /* 顶部栏已有页名，这里去掉重复标题 */
  .library-view__title {
    display: none;
  }

  /* 标题 + 统计徽标整行去掉：条数在下方的列表工具栏里已经有一份 */
  .library-view__bar > .row:first-child {
    display: none;
  }

  .library-view__bar {
    flex-wrap: nowrap;
    gap: 6px;
  }

  .library-view__bar > .row:last-child {
    flex: 1;
    flex-wrap: nowrap;
    gap: 6px;
    min-width: 0;
  }

  /* 「新建」在下方列表面板里已有一个，这里不重复放 */
  .library-view__bar > .row:last-child > .btn--primary {
    display: none;
  }

  .library-view__grid {
    flex: 1;
    min-height: 0;
  }

  .library-view__list {
    min-height: 0;
    overflow: hidden;
    border: none;
    background: transparent;
  }
}
</style>
