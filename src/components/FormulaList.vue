<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFormulaStore } from '../stores/formulaStore';
import { SETUP_MODE_LABEL } from '../types/formula';

const props = defineProps<{
  /** 是否显示紧凑模式（工作台左栏） */
  compact?: boolean;
}>();

const emit = defineEmits<{
  (event: 'select', id: string): void;
  (event: 'create'): void;
}>();

const store = useFormulaStore();
const searchText = ref(store.filter.search);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => store.filter.search,
  (value) => {
    if (value !== searchText.value) searchText.value = value;
  },
);

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void store.setFilter({ search: searchText.value });
  }, 220);
}

function selectCategory(id: string | null) {
  void store.setFilter({ categoryId: id });
}

function toggleFavoriteOnly() {
  void store.setFilter({ favoriteOnly: !store.filter.favoriteOnly });
}

function onTagChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  void store.setFilter({ tag: value || null });
}

function onSortChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as 'updatedAt' | 'title' | 'category';
  void store.setFilter({ sortBy: value });
}

const totalCount = computed(() => store.formulas.length);

function setupBadge(mode: keyof typeof SETUP_MODE_LABEL) {
  return SETUP_MODE_LABEL[mode];
}
</script>

<template>
  <section class="library" :class="{ 'library--compact': compact }" data-testid="formula-list">
    <div class="library__tools">
      <div class="library__search">
        <input
          v-model="searchText"
          class="input"
          type="search"
          placeholder="搜索名称、公式或标签"
          aria-label="搜索公式"
          data-testid="formula-search"
          @input="onSearchInput"
        />
      </div>
      <button
        type="button"
        class="btn btn--primary btn--sm"
        data-testid="btn-new-formula"
        @click="emit('create')"
      >
        新建
      </button>
    </div>

    <div class="library__filters">
      <button
        type="button"
        class="chip"
        :class="{ 'chip--active': !store.filter.categoryId }"
        @click="selectCategory(null)"
      >
        全部
      </button>
      <button
        type="button"
        class="chip"
        :class="{ 'chip--active': store.filter.favoriteOnly }"
        :aria-pressed="store.filter.favoriteOnly"
        data-testid="filter-favorite"
        @click="toggleFavoriteOnly"
      >
        ★ 收藏
      </button>
      <button
        v-for="category in store.categories"
        :key="category.id"
        type="button"
        class="chip"
        :class="{ 'chip--active': store.filter.categoryId === category.id }"
        @click="selectCategory(category.id)"
      >
        {{ category.name }}
      </button>
    </div>

    <div class="library__meta">
      <span class="small muted">{{ totalCount }} 条</span>
      <div class="library__meta-actions">
        <select
          v-if="store.tags.length"
          class="select select--mini"
          :value="store.filter.tag ?? ''"
          aria-label="按标签筛选"
          @change="onTagChange"
        >
          <option value="">全部标签</option>
          <option v-for="tag in store.tags" :key="tag" :value="tag">#{{ tag }}</option>
        </select>
        <select
          class="select select--mini"
          :value="store.filter.sortBy"
          aria-label="排序方式"
          @change="onSortChange"
        >
          <option value="updatedAt">按更新时间</option>
          <option value="title">按名称</option>
          <option value="category">按分类</option>
        </select>
      </div>
    </div>

    <div class="library__list" role="list">
      <p v-if="store.loading" class="empty-state">正在读取公式库…</p>
      <p v-else-if="store.error" class="alert alert--error">{{ store.error }}</p>
      <p v-else-if="totalCount === 0" class="empty-state">
        <template v-if="store.filter.search || store.filter.categoryId || store.filter.favoriteOnly">
          没有符合筛选条件的公式
        </template>
        <template v-else>这个魔方类型还没有公式，点击「新建」添加一条。</template>
      </p>
      <template v-else>
        <article
          v-for="record in store.formulas"
          :key="record.id"
          class="formula-card"
          :class="{ 'formula-card--active': record.id === store.selectedId }"
          role="listitem"
          tabindex="0"
          :data-formula-id="record.id"
          @click="emit('select', record.id)"
          @keydown.enter.prevent="emit('select', record.id)"
          @keydown.space.prevent="emit('select', record.id)"
        >
          <div class="formula-card__top">
            <h3 class="formula-card__title truncate">{{ record.title }}</h3>
            <button
              type="button"
              class="star"
              :class="{ 'star--on': record.favorite }"
              :title="record.favorite ? '取消收藏' : '收藏'"
              :aria-label="record.favorite ? '取消收藏' : '收藏'"
              @click.stop="store.toggleFavorite(record.id)"
            >
              ★
            </button>
          </div>
          <p class="formula-card__alg mono">{{ record.alg }}</p>
          <div class="formula-card__tags">
            <span v-if="store.categoryName(record.categoryId)" class="badge">
              {{ store.categoryName(record.categoryId) }}
            </span>
            <span class="badge" :title="setupBadge(record.setupMode)">
              {{ record.setupMode === 'solved' ? '复原态' : record.setupMode === 'inverse' ? '逆序起点' : '自定义起点' }}
            </span>
            <span v-for="tag in record.tags.slice(0, 3)" :key="tag" class="badge badge--accent">#{{ tag }}</span>
          </div>
        </article>
      </template>
    </div>
  </section>
</template>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: var(--space-2);
}

.library__tools {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3) 0;
}

.library__search {
  flex: 1;
  min-width: 0;
}

.library__filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 0 var(--space-3) 2px;
  scrollbar-width: none;
}

.library__filters::-webkit-scrollbar {
  display: none;
}

.chip {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.chip--active {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  color: var(--accent);
  font-weight: 600;
}

.library__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0 var(--space-3);
}

.library__meta-actions {
  display: flex;
  gap: 6px;
}

.select--mini {
  width: auto;
  min-height: 26px;
  padding: 1px 6px;
  font-size: 12px;
}

.library__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px var(--space-3) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.formula-card {
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.formula-card:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
}

.formula-card--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: var(--shadow-sm);
}

.formula-card__top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.formula-card__title {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.formula-card__alg {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.formula-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.star {
  border: none;
  background: transparent;
  color: var(--border-strong);
  font-size: 15px;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.star--on {
  color: #f0a800;
}

.star:hover {
  color: #f0a800;
}

@media (max-width: 767px) {
  .library__list {
    max-height: none;
  }

  .formula-card {
    padding: 11px 12px;
  }
}
</style>
