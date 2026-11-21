<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { usePlayerStore } from '@/presentation/stores/playerStore';
import { useI18n } from '@/presentation/i18n';

const player = usePlayerStore();
const { t } = useI18n();
const containerRef = ref<HTMLElement | null>(null);
const tokenRefs = ref<HTMLElement[]>([]);

const tokens = computed(() => player.tokens);
const completed = computed(() => player.snapshot.currentStep);
const active = computed(() => player.snapshot.activeMoveIndex);

function stateOf(index: number): 'done' | 'active' | 'pending' {
  if (index < completed.value) return 'done';
  if (index === active.value) return 'active';
  return 'pending';
}

function jumpTo(index: number) {
  // 点击第 k 个动作 → 跳到"该动作完成"后的状态
  player.seekToStep(index + 1);
}

function setTokenRef(el: Element | null, index: number) {
  if (el instanceof HTMLElement) tokenRefs.value[index] = el;
}

watch(
  () => [player.snapshot.currentStep, player.snapshot.activeMoveIndex],
  async () => {
    await nextTick();
    const focusIndex = player.snapshot.activeMoveIndex ?? player.snapshot.currentStep - 1;
    const el = tokenRefs.value[focusIndex];
    if (el && containerRef.value) {
      // 只滚动 token 容器本身，避免把整个页面卷走（scrollIntoView 会连带滚动祖先）
      const container = containerRef.value;
      const targetLeft = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  },
);
</script>

<template>
  <div class="tokens" data-testid="algorithm-tokens">
    <div v-if="tokens.length === 0" class="empty-state">{{ t('tokens.empty') }}</div>
    <div v-else ref="containerRef" class="tokens__list" role="list">
      <button
        v-for="token in tokens"
        :key="token.index"
        :ref="(el) => setTokenRef(el as Element | null, token.index)"
        type="button"
        class="token"
        :class="`token--${stateOf(token.index)}`"
        :title="t('tokens.stepTitle', { n: token.index + 1, move: token.text, readable: token.readable })"
        :aria-label="t('tokens.stepAria', { n: token.index + 1, move: token.text, readable: token.readable })"
        role="listitem"
        @click="jumpTo(token.index)"
      >
        <span class="token__index">{{ token.index + 1 }}</span>
        <span class="token__text">{{ token.text }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tokens {
  min-height: 40px;
}

.tokens__list {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 2px 6px;
  scrollbar-width: thin;
}

.token {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.token:hover {
  border-color: var(--accent);
}

.token__index {
  font-family: var(--font-sans);
  font-size: 10px;
  color: var(--muted);
}

.token--done {
  background: var(--surface-3);
  color: var(--text-secondary);
  border-color: transparent;
}

.token--done .token__text {
  text-decoration: line-through;
  text-decoration-color: var(--muted);
}

.token--active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.token--active .token__index {
  color: color-mix(in srgb, var(--accent-contrast) 75%, transparent);
}

@media (max-width: 767px) {
  .token {
    padding: 7px 12px;
  }
}
</style>
