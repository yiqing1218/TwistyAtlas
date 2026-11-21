<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { PUZZLE_DESCRIPTORS } from '@/infrastructure/cubing/puzzleRegistry';
import type { PuzzleDescriptor } from '@/domain/model/puzzle';
import { useI18n } from '@/presentation/i18n';
import { puzzleName, puzzleNote, statusLabel } from '@/presentation/i18n/labels';

const props = defineProps<{
  modelValue: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
}>();

const router = useRouter();
const { t } = useI18n();

interface Group {
  label: string;
  items: PuzzleDescriptor[];
}

const groups = computed<Group[]>(() => [
  { label: t('puzzle.family.cube'), items: PUZZLE_DESCRIPTORS.filter((p) => p.family === 'cube') },
  { label: t('puzzle.family.other'), items: PUZZLE_DESCRIPTORS.filter((p) => p.family !== 'cube') },
]);

const current = computed(
  () => PUZZLE_DESCRIPTORS.find((p) => p.id === props.modelValue) ?? PUZZLE_DESCRIPTORS[0],
);

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  emit('update:modelValue', value);
  // 魔方类型是全局上下文，切换后回到公式库更符合预期
  if (router.currentRoute.value.name === 'formula') {
    void router.push({ name: 'library' });
  }
}
</script>

<template>
  <div class="picker" :class="{ 'picker--compact': compact }">
    <label class="picker__label" for="puzzle-select">{{ t('puzzle.label') }}</label>
    <select
      id="puzzle-select"
      class="select picker__select"
      :value="modelValue"
      data-testid="puzzle-select"
      @change="onChange"
    >
      <optgroup v-for="group in groups" :key="group.label" :label="group.label">
        <option v-for="item in group.items" :key="item.id" :value="item.id">
          {{ puzzleName(item.id) }} · {{ statusLabel(item.status) }}
        </option>
      </optgroup>
    </select>
    <span
      class="badge"
      :class="{
        'badge--success': current.status === 'ready-3d',
        'badge--warning': current.status === 'experimental' || current.status === 'ready-2d',
      }"
      :title="puzzleNote(current.id)"
    >
      {{ statusLabel(current.status) }}
    </span>
    <span class="picker__name visually-hidden">{{ puzzleName(modelValue) }}</span>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.picker__label {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.picker__select {
  width: auto;
  min-width: 150px;
  max-width: 240px;
}

.picker--compact .picker__label {
  display: none;
}

@media (max-width: 767px) {
  .picker__label {
    display: none;
  }

  .picker__select {
    min-width: 0;
    max-width: 150px;
  }

  /* 下拉选项里已经带了状态文案，手机上不再重复一枚徽标 */
  .picker .badge {
    display: none;
  }
}
</style>
