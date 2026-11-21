<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { t } from '@/presentation/i18n';

const error = ref<Error | null>(null);

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err));
  console.error('[TwistyAtlas] 渲染错误', err);
  return false;
});

function retry() {
  error.value = null;
}

function reload() {
  if (typeof location !== 'undefined') location.reload();
}
</script>

<template>
  <div v-if="error" class="error-boundary" role="alert">
    <h2>{{ t('error.title') }}</h2>
    <p class="small muted">{{ error.message }}</p>
    <div class="row">
      <button type="button" class="btn" @click="retry">{{ t('common.retry') }}</button>
      <button type="button" class="btn btn--ghost" @click="reload">{{ t('common.reload') }}</button>
    </div>
    <p class="small muted">{{ t('error.safe') }}</p>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  border: 1px solid color-mix(in srgb, var(--danger) 40%, var(--border));
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--text);
}

.error-boundary h2 {
  font-size: 15px;
}
</style>
