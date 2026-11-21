<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FormulaRecord } from '../types/formula';
import { SETUP_MODE_HINT, SETUP_MODE_LABEL } from '../types/formula';
import { getPuzzleDescriptor, STATUS_LABEL } from '../engine/puzzleRegistry';
import { parseFormulaLocal } from '../engine/algService';

const props = defineProps<{
  record?: FormulaRecord | null;
  categoryName?: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  (event: 'edit'): void;
  (event: 'duplicate'): void;
  (event: 'remove'): void;
  (event: 'favorite'): void;
  (event: 'open-page'): void;
}>();

const copied = ref(false);

const descriptor = computed(() =>
  props.record ? getPuzzleDescriptor(props.record.puzzleId) : undefined,
);
const tokenCount = computed(() => {
  if (!props.record) return 0;
  const parsed = parseFormulaLocal(props.record.alg);
  return parsed.ok ? parsed.tokens.length : 0;
});
const updatedText = computed(() => {
  if (!props.record) return '';
  const date = new Date(props.record.updatedAt);
  return Number.isNaN(date.getTime()) ? props.record.updatedAt : date.toLocaleString('zh-CN');
});

async function copyAlg() {
  if (!props.record) return;
  try {
    await navigator.clipboard.writeText(props.record.alg);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <div class="detail" data-testid="formula-detail">
    <template v-if="record">
      <header class="detail__header">
        <div class="detail__title-row">
          <h2 class="detail__title">{{ record.title }}</h2>
          <button
            type="button"
            class="star"
            :class="{ 'star--on': record.favorite }"
            :aria-label="record.favorite ? '取消收藏' : '收藏'"
            :title="record.favorite ? '取消收藏' : '收藏'"
            @click="emit('favorite')"
          >
            ★
          </button>
        </div>
        <div class="detail__badges">
          <span v-if="descriptor" class="badge">{{ descriptor.displayNameZh }}</span>
          <span v-if="descriptor" class="badge" :class="descriptor.status === 'ready-3d' ? 'badge--success' : 'badge--warning'">
            {{ STATUS_LABEL[descriptor.status] }}
          </span>
          <span v-if="categoryName" class="badge">{{ categoryName }}</span>
          <span class="badge">{{ tokenCount }} 步</span>
        </div>
      </header>

      <div class="detail__formula">
        <div class="detail__formula-head">
          <span class="field__label">公式</span>
          <button type="button" class="btn btn--sm btn--ghost" @click="copyAlg">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <code class="detail__alg mono" data-testid="detail-alg">{{ record.alg }}</code>
      </div>

      <section class="detail__section">
        <h3 class="detail__label">初始状态</h3>
        <p class="detail__value">
          <span class="badge badge--accent">{{ SETUP_MODE_LABEL[record.setupMode] }}</span>
        </p>
        <p class="small muted">{{ SETUP_MODE_HINT[record.setupMode] }}</p>
        <code v-if="record.setupMode === 'explicit' && record.setupAlg" class="detail__alg mono">{{ record.setupAlg }}</code>
      </section>

      <section v-if="record.description" class="detail__section">
        <h3 class="detail__label">说明</h3>
        <p class="detail__value detail__description">{{ record.description }}</p>
      </section>

      <section v-if="record.tags.length" class="detail__section">
        <h3 class="detail__label">标签</h3>
        <div class="detail__tags">
          <span v-for="tag in record.tags" :key="tag" class="badge badge--accent">#{{ tag }}</span>
        </div>
      </section>

      <section v-if="record.sourceName || record.sourceUrl" class="detail__section">
        <h3 class="detail__label">来源</h3>
        <p class="detail__value">
          <a v-if="record.sourceUrl" :href="record.sourceUrl" target="_blank" rel="noopener noreferrer">
            {{ record.sourceName || record.sourceUrl }}
          </a>
          <span v-else>{{ record.sourceName }}</span>
        </p>
      </section>

      <p class="small muted detail__meta">最后更新：{{ updatedText }}</p>

      <div class="detail__actions">
        <button type="button" class="btn btn--sm" data-testid="btn-edit" @click="emit('edit')">编辑</button>
        <button type="button" class="btn btn--sm" @click="emit('duplicate')">复制</button>
        <button type="button" class="btn btn--sm" @click="emit('open-page')">独立页面</button>
        <button type="button" class="btn btn--sm btn--danger" data-testid="btn-delete" @click="emit('remove')">删除</button>
      </div>
    </template>
    <div v-else class="empty-state">
      还没有选中公式。左侧选择一条，或点击「新建」创建。
    </div>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  overflow-y: auto;
  height: 100%;
}

.detail__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail__title-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.detail__title {
  font-size: 16px;
  line-height: 1.35;
  flex: 1;
  word-break: break-word;
}

.detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail__formula {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
}

.detail__formula-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.detail__alg {
  display: block;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 13px;
  word-break: break-all;
}

.detail__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: none;
}

.detail__value {
  font-size: 13px;
}

.detail__description {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-secondary);
}

.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail__meta {
  border-top: 1px solid var(--border);
  padding-top: var(--space-2);
}

.detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}

.star {
  border: none;
  background: transparent;
  color: var(--border-strong);
  font-size: 17px;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.star--on {
  color: #f0a800;
}
</style>
