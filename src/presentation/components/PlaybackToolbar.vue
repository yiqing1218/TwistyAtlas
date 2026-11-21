<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '@/presentation/stores/playerStore';
import { useSettingsStore } from '@/presentation/stores/settingsStore';
import { SPEED_OPTIONS } from '@/domain/model/settings';

const player = usePlayerStore();
const settings = useSettingsStore();

const ready = computed(() => player.snapshot.status === 'ready' && player.snapshot.totalSteps > 0);
const atStart = computed(() => player.snapshot.currentStep === 0 && !player.snapshot.activeMoveIndex);
const atEnd = computed(
  () => player.snapshot.currentStep >= player.snapshot.totalSteps && !player.snapshot.activeMoveIndex,
);

const speed = computed({
  get: () => settings.settings.playbackSpeed,
  set: (value: number) => player.setSpeed(value),
});

function onSlider(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  player.seekToStep(value);
}

const activeLabel = computed(() => {
  const token = player.snapshot.activeMoveIndex;
  if (token === null) return '';
  const t = player.tokens[token];
  return t ? `正在执行 ${t.text}` : '';
});
</script>

<template>
  <div class="toolbar" data-testid="playback-toolbar">
    <div class="toolbar__buttons">
      <button
        type="button"
        class="btn btn--icon"
        title="回到第一步（快捷键 Home）"
        aria-label="回到第一步"
        data-testid="btn-start"
        :disabled="!ready || atStart"
        @click="player.seekToStart()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M18 5v14L8 12l10-7Z" stroke-linejoin="round" />
          <path d="M6 5v14" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="btn btn--icon"
        title="上一步（快捷键 ←）"
        aria-label="上一步"
        data-testid="btn-prev"
        :disabled="!ready || atStart"
        @click="player.previousStep()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="btn btn--primary btn--play"
        :title="player.snapshot.playing ? '暂停（空格）' : '播放（空格）'"
        :aria-label="player.snapshot.playing ? '暂停' : '播放'"
        data-testid="btn-play"
        :disabled="!ready"
        @click="player.togglePlay()"
      >
        <svg v-if="player.snapshot.playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 5.5v13l11-6.5-11-6.5Z" />
        </svg>
        <span class="btn__label">{{ player.snapshot.playing ? '暂停' : '播放' }}</span>
      </button>
      <button
        type="button"
        class="btn btn--icon"
        title="下一步（快捷键 →）"
        aria-label="下一步"
        data-testid="btn-next"
        :disabled="!ready || atEnd"
        @click="player.nextStep()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="btn btn--icon"
        title="跳到最后一步（快捷键 End）"
        aria-label="跳到最后一步"
        data-testid="btn-end"
        :disabled="!ready || atEnd"
        @click="player.seekToEnd()"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M6 5v14l10-7L6 5Z" stroke-linejoin="round" />
          <path d="M18 5v14" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="toolbar__progress">
      <input
        class="slider"
        type="range"
        min="0"
        :max="Math.max(player.snapshot.totalSteps, 1)"
        step="1"
        :value="player.snapshot.currentStep"
        :disabled="!ready"
        aria-label="播放进度（按动作步）"
        data-testid="progress-slider"
        @input="onSlider"
      />
      <div class="toolbar__meta">
        <span class="mono" data-testid="step-label">
          {{ player.snapshot.currentStep }} / {{ player.snapshot.totalSteps }}
        </span>
        <span v-if="activeLabel" class="toolbar__active">{{ activeLabel }}</span>
        <span class="toolbar__spacer"></span>
        <label class="toolbar__speed">
          <span class="small muted">速度</span>
          <select v-model.number="speed" class="select select--compact" aria-label="播放速度" data-testid="speed-select">
            <option v-for="option in SPEED_OPTIONS" :key="option" :value="option">{{ option }}×</option>
          </select>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  flex-wrap: wrap;
}

.toolbar__buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn--play {
  min-width: 84px;
  gap: 6px;
}

.btn__label {
  font-size: 13px;
}

.toolbar__progress {
  flex: 1;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider {
  width: 100%;
  height: 20px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.slider:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.toolbar__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 12px;
  color: var(--text-secondary);
}

.toolbar__active {
  color: var(--accent);
  font-weight: 600;
}

.toolbar__spacer {
  flex: 1;
}

.toolbar__speed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.select--compact {
  width: auto;
  min-height: 28px;
  padding: 2px 6px;
  font-size: 12px;
}

@media (max-width: 767px) {
  .toolbar {
    padding: 8px 10px;
    gap: 10px;
  }

  .toolbar__buttons {
    width: 100%;
    justify-content: space-between;
    gap: 6px;
  }

  .btn--play {
    flex: 1;
  }

  .toolbar__progress {
    min-width: 100%;
  }
}
</style>
