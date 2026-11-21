<script setup lang="ts">
/**
 * 公式集浏览。
 *
 * 数据来自 `src/data/algsets.json`（由 scripts/data/build-dataset.mjs 生成，
 * 每条公式都经过 cubing.js 状态模型校验）。界面分三块：公式集、案例、播放器。
 */
import { computed, onMounted, ref } from 'vue';
import { loadDataset, type AlgCase, type AlgSet, type AlgSource } from '@/application/sets/formulaSets';
import { usePlayerStore } from '@/presentation/stores/playerStore';
import PuzzleViewport from '@/presentation/components/PuzzleViewport.vue';
import PlaybackToolbar from '@/presentation/components/PlaybackToolbar.vue';
import AlgorithmTokens from '@/presentation/components/AlgorithmTokens.vue';

const dataset = ref<Awaited<ReturnType<typeof loadDataset>> | null>(null);
const activeSetId = ref<string>('');
const activeCaseId = ref<string>('');
const activeAlgIndex = ref(0);
const search = ref('');
const player = usePlayerStore();

const sets = computed(() => dataset.value?.sets ?? []);
const activeSet = computed<AlgSet | undefined>(() => sets.value.find((s) => s.id === activeSetId.value));
const source = computed<AlgSource | undefined>(() => {
  const id = activeSet.value?.sourceId;
  return dataset.value?.sources.find((s) => s.id === id);
});

const visibleCases = computed<AlgCase[]>(() => {
  const list = activeSet.value?.cases ?? [];
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return list;
  return list.filter(
    (c) => c.name.toLowerCase().includes(keyword) || c.group.toLowerCase().includes(keyword),
  );
});

const activeCase = computed<AlgCase | undefined>(() =>
  activeSet.value?.cases.find((c) => c.caseId === activeCaseId.value),
);

const groupedCases = computed(() => {
  const groups = new Map<string, AlgCase[]>();
  for (const c of visibleCases.value) {
    const key = c.group || '全部';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return [...groups.entries()];
});

const totals = computed(() => {
  let cases = 0;
  let algs = 0;
  for (const s of sets.value) {
    cases += s.cases.length;
    for (const c of s.cases) algs += c.algs.length;
  }
  return { cases, algs };
});

function selectSet(id: string) {
  activeSetId.value = id;
  activeCaseId.value = '';
  activeAlgIndex.value = 0;
  search.value = '';
}

async function selectCase(c: AlgCase, algIndex = 0) {
  activeCaseId.value = c.caseId;
  activeAlgIndex.value = algIndex;
  const set = activeSet.value;
  if (!set) return;
  const entry = c.algs[algIndex] ?? c.algs[0];
  await player.loadFormula({
    puzzleId: set.puzzleId,
    alg: entry.alg,
    setupMode: set.setupMode,
    setupAlg: entry.setupAlg || c.setupAlg,
    title: c.name,
  });
}

function verificationLabel(level: string): string {
  return level === 'structural' ? '引擎已校验' : '仅语法校验';
}

onMounted(async () => {
  dataset.value = await loadDataset();
  const first = sets.value[0];
  if (first) {
    selectSet(first.id);
    const firstCase = first.cases[0];
    if (firstCase) await selectCase(firstCase);
  }
});
</script>

<template>
  <div class="sets-page" data-testid="sets-page">
    <header class="sets-header">
      <div class="sets-header__title">
        <h1>公式集</h1>
        <p v-if="dataset" class="sets-header__meta">
          {{ totals.cases }} 个案例 · {{ totals.algs }} 条公式 · 数据生成于 {{ dataset.generatedAt.slice(0, 10) }}
        </p>
      </div>
      <input v-model="search" class="input sets-header__search" type="search" placeholder="搜索案例或分组" aria-label="搜索案例" />
    </header>

    <nav class="set-pills" aria-label="公式集">
      <button
        v-for="set in sets"
        :key="set.id"
        type="button"
        class="set-pill"
        :class="{ 'set-pill--active': set.id === activeSetId }"
        :data-testid="`set-pill-${set.id}`"
        @click="selectSet(set.id)"
      >
        <span class="set-pill__name">{{ set.name }}</span>
        <span class="set-pill__count">{{ set.cases.length }}</span>
      </button>
    </nav>

    <div class="sets-body">
      <section class="cases-pane" data-testid="cases-pane">
        <p v-if="activeSet?.note" class="cases-note">{{ activeSet.note }}</p>
        <div v-for="[group, list] in groupedCases" :key="group" class="cases-group">
          <h2 class="cases-group__title">{{ group }}</h2>
          <ul class="cases-list">
            <li v-for="c in list" :key="c.caseId">
              <button
                type="button"
                class="case-item"
                :class="{ 'case-item--active': c.caseId === activeCaseId }"
                @click="selectCase(c)"
              >
                <span class="case-item__name">{{ c.name }}</span>
                <span class="case-item__alg mono">{{ c.algs[0]?.alg }}</span>
                <span class="case-item__count">{{ c.algs.length }} 条</span>
              </button>
            </li>
          </ul>
        </div>
        <p v-if="visibleCases.length === 0" class="cases-empty">没有匹配的案例。</p>
      </section>

      <section class="cases-player">
        <div class="cases-player__viewport">
          <PuzzleViewport />
        </div>
        <PlaybackToolbar />
        <div class="tokens-panel panel">
          <AlgorithmTokens />
        </div>
        <div v-if="activeCase" class="case-detail panel">
          <div class="case-detail__head">
            <h3>{{ activeCase.name }}</h3>
            <span class="case-detail__badge">{{ verificationLabel(activeCase.algs[activeAlgIndex]?.level ?? 'parsed') }}</span>
          </div>
          <ol class="case-detail__algs">
            <li v-for="(entry, index) in activeCase.algs" :key="`${entry.alg}-${index}`">
              <button
                type="button"
                class="case-detail__alg mono"
                :class="{ 'case-detail__alg--active': index === activeAlgIndex }"
                @click="selectCase(activeCase, index)"
              >
                {{ entry.alg }}
              </button>
              <span v-if="entry.preservesEdgePermutation === false" class="case-detail__tag">会改动棱块排列</span>
            </li>
          </ol>
          <p v-if="source" class="case-detail__source">
            来源：<a :href="source.pageUrl" target="_blank" rel="noreferrer noopener">{{ source.siteName }}</a>
            · 采集于 {{ source.accessedAt }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sets-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: var(--space-4);
  gap: var(--space-3);
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
}

.sets-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
}

.sets-header__title h1 {
  margin: 0;
  font-size: 20px;
}

.sets-header__meta {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.sets-header__search {
  max-width: 260px;
}

.set-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.set-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.set-pill--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.set-pill__count {
  font-size: 11px;
  opacity: 0.7;
}

.sets-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
  flex: 1;
  min-height: 0;
}

.cases-pane {
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: var(--space-3);
  min-height: 0;
}

.cases-note {
  margin: 0 0 var(--space-3);
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.cases-group__title {
  margin: var(--space-3) 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: none;
}

.cases-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.case-item {
  width: 100%;
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) 52px;
  gap: 8px;
  align-items: center;
  text-align: left;
  padding: 7px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
}

.case-item:hover {
  background: var(--surface-2);
}

.case-item--active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.case-item__name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-item__alg {
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-item__count {
  text-align: right;
  color: var(--text-secondary);
  font-size: 11px;
}

.cases-empty {
  color: var(--text-secondary);
  font-size: 13px;
}

.cases-player {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

/* 播放器必须有确定高度：flex:1 在可滚动的列容器里会无限拉伸 */
.cases-player__viewport {
  height: min(46vh, 460px);
  min-height: 300px;
  display: flex;
}

.cases-player__viewport > * {
  flex: 1;
  min-height: 0;
}

.case-detail {
  padding: var(--space-3);
}

.case-detail__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.case-detail__head h3 {
  margin: 0;
  font-size: 15px;
}

.case-detail__badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
}

.case-detail__algs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.case-detail__alg {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-size: 12.5px;
  color: var(--text);
  cursor: pointer;
}

.case-detail__alg--active {
  border-color: var(--accent);
}

.case-detail__tag {
  margin-left: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.case-detail__source {
  margin: 10px 0 0;
  font-size: 11.5px;
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .sets-body {
    grid-template-columns: 1fr;
  }

  .cases-pane {
    max-height: 40vh;
  }
}
</style>
