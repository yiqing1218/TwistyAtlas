<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import PuzzleViewport from '@/presentation/components/PuzzleViewport.vue';
import PlaybackToolbar from '@/presentation/components/PlaybackToolbar.vue';
import AlgorithmTokens from '@/presentation/components/AlgorithmTokens.vue';
import FormulaDetailPanel from '@/presentation/components/FormulaDetailPanel.vue';
import FormulaEditor from '@/presentation/components/FormulaEditor.vue';
import ErrorBoundary from '@/presentation/components/ErrorBoundary.vue';
import { getFormula, deleteFormula } from '@/infrastructure/persistence/formulaRepository';
import { listCategories } from '@/infrastructure/persistence/formulaRepository';
import { usePlayerStore } from '@/presentation/stores/playerStore';
import { useFormulaStore } from '@/presentation/stores/formulaStore';
import type { FormulaCategory, FormulaRecord } from '@/domain/model/formula';

const props = defineProps<{ id: string }>();
const router = useRouter();
const player = usePlayerStore();
const store = useFormulaStore();

const record = ref<FormulaRecord | null>(null);
const categories = ref<FormulaCategory[]>([]);
const loading = ref(true);
const notFound = ref(false);
const editorOpen = ref(false);

const categoryName = computed(() => {
  if (!record.value?.categoryId) return '';
  return categories.value.find((c) => c.id === record.value?.categoryId)?.name ?? '';
});

async function loadRecord(id: string) {
  loading.value = true;
  notFound.value = false;
  const found = await getFormula(id);
  record.value = found ?? null;
  if (!found) {
    notFound.value = true;
    loading.value = false;
    return;
  }
  categories.value = await listCategories(found.puzzleId);
  player.pause();
  await player.loadFormula({
    formulaId: found.id,
    puzzleId: found.puzzleId,
    title: found.title,
    alg: found.alg,
    setupMode: found.setupMode,
    setupAlg: found.setupAlg,
  });
  loading.value = false;
}

onMounted(() => loadRecord(props.id));

watch(
  () => props.id,
  (id) => {
    if (id) void loadRecord(id);
  },
);

async function onSaved(updated: FormulaRecord) {
  record.value = updated;
  await player.loadFormula({
    formulaId: updated.id,
    puzzleId: updated.puzzleId,
    title: updated.title,
    alg: updated.alg,
    setupMode: updated.setupMode,
    setupAlg: updated.setupAlg,
  });
}

async function removeRecord() {
  if (!record.value) return;
  if (!window.confirm(`确定删除「${record.value.title}」吗？`)) return;
  await deleteFormula(record.value.id);
  await store.refresh();
  void router.push('/');
}
</script>

<template>
  <ErrorBoundary>
    <div class="detail-view">
      <header class="detail-view__bar">
        <RouterLink to="/" class="btn btn--sm btn--ghost">← 返回工作台</RouterLink>
        <h1 class="detail-view__title truncate">{{ record?.title ?? '公式详情' }}</h1>
      </header>

      <p v-if="loading" class="empty-state">正在读取公式…</p>

      <div v-else-if="notFound" class="empty-state">
        <strong>找不到这条公式</strong>
        <p>它可能已被删除。返回 <RouterLink to="/">工作台</RouterLink> 重新选择。</p>
      </div>

      <template v-else-if="record">
        <div class="detail-view__grid">
          <section class="detail-view__center">
            <PuzzleViewport />
            <PlaybackToolbar />
            <div class="tokens-panel panel">
              <AlgorithmTokens />
            </div>
            <div v-if="player.loadError" class="alert alert--error">{{ player.loadError }}</div>
            <div v-if="player.loadWarning" class="alert alert--warning">{{ player.loadWarning }}</div>
          </section>
          <aside class="detail-view__side panel">
            <FormulaDetailPanel
              :record="record"
              :category-name="categoryName"
              @edit="editorOpen = true"
              @duplicate="() => {}"
              @remove="removeRecord"
              @favorite="() => {}"
              @open-page="() => {}"
            />
          </aside>
        </div>
      </template>
    </div>

    <FormulaEditor :open="editorOpen" :record="record" @close="editorOpen = false" @saved="onSaved" />
  </ErrorBoundary>
</template>

<style scoped>
.detail-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  flex: 1;
  min-height: 0;
}

.detail-view__bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.detail-view__title {
  font-size: 16px;
  min-width: 0;
}

.detail-view__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-2);
  flex: 1;
  min-height: 0;
}

.detail-view__center {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
  min-width: 0;
}

.detail-view__side {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tokens-panel {
  padding: 8px 10px;
}

@media (max-width: 1023px) {
  .detail-view__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail-view__side {
    max-height: 60vh;
  }
}
</style>
