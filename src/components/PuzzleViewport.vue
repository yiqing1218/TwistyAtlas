<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usePlayerStore } from '../stores/playerStore';
import { useSettingsStore } from '../stores/settingsStore';

const container = ref<HTMLDivElement | null>(null);
const player = usePlayerStore();
const settings = useSettingsStore();
let lastWheelAt = 0;

onMounted(() => {
  if (container.value) player.attach(container.value);
});

onBeforeUnmount(() => {
  player.detach();
});

watch(
  () => settings.settings.showHintFacelets,
  (show) => player.setHintFacelets(show),
);

function onWheel(event: WheelEvent) {
  // 只在三维区域缩放，避免整页滚动被劫持；节流避免一次手势触发多次请求
  event.preventDefault();
  const now = Date.now();
  if (now - lastWheelAt < 120) return;
  lastWheelAt = now;
  if (event.deltaY > 0) player.zoomOut();
  else player.zoomIn();
}

const unavailable = () => !player.webglAvailable || player.snapshot.status === 'error';
</script>

<template>
  <div class="viewport" :class="{ 'viewport--locked': settings.settings.lockCamera }">
    <div
      ref="container"
      class="viewport__canvas"
      data-testid="puzzle-canvas"
      role="img"
      :aria-label="`三维魔方视图：${player.target?.title || '未选择公式'}`"
      @wheel="onWheel"
    ></div>

    <div v-if="unavailable()" class="viewport__overlay" data-testid="viewport-error">
      <strong>无法显示三维魔方</strong>
      <p>{{ player.loadError || '当前浏览器或显卡不支持 WebGL。' }}</p>
      <p class="small muted">公式数据仍可正常查看、编辑和导出。</p>
    </div>

    <div v-else-if="!player.target" class="viewport__overlay" data-testid="viewport-empty">
      <strong>选择一条公式开始</strong>
      <p class="small">左侧公式库中选择公式，或将任意公式粘贴到编辑器中预览。</p>
    </div>

    <div v-else-if="player.snapshot.status === 'loading'" class="viewport__status" data-testid="viewport-loading">
      正在装载三维魔方…
    </div>

    <div v-else-if="settings.settings.lockCamera" class="viewport__locked">
      <span class="badge">视角已锁定</span>
    </div>

    <div class="viewport__corner">
      <span
        v-if="player.isReady && player.snapshot.renderMode === '2D'"
        class="badge badge--warning"
        data-testid="render-mode"
        title="安装的引擎对该魔方只提供二维渲染"
      >
        二维渲染
      </span>
      <button
        type="button"
        class="btn btn--sm"
        title="复位视角"
        aria-label="复位视角"
        @click="player.resetCamera()"
      >
        复位视角
      </button>
      <div class="viewport__zoom">
        <button type="button" class="btn btn--sm btn--icon" title="放大" aria-label="放大" @click="player.zoomIn()">+</button>
        <button type="button" class="btn btn--sm btn--icon" title="缩小" aria-label="缩小" @click="player.zoomOut()">−</button>
      </div>
    </div>

    <p class="viewport__hint">拖动旋转视角（不改变魔方状态） · 滚轮或按钮缩放</p>
  </div>
</template>

<style scoped>
.viewport {
  position: relative;
  flex: 1;
  min-height: 300px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background:
    radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 55%),
    var(--surface);
  overflow: hidden;
  display: flex;
  align-items: stretch;
}

.viewport__canvas {
  flex: 1;
  min-height: 0;
  touch-action: none;
}

.viewport--locked .viewport__canvas {
  pointer-events: none;
}

.viewport__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-6);
  text-align: center;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--text-secondary);
}

.viewport__overlay strong {
  color: var(--text);
  font-size: 14px;
}

.viewport__status {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-secondary);
  font-size: 12px;
}

.viewport__locked {
  position: absolute;
  top: 12px;
  left: 12px;
}

.viewport__corner {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.viewport__zoom {
  display: flex;
  gap: 4px;
}

.viewport__hint {
  position: absolute;
  left: 12px;
  bottom: 8px;
  font-size: 11px;
  color: var(--muted);
  pointer-events: none;
}

@media (max-width: 767px) {
  .viewport {
    min-height: 46vh;
  }

  .viewport__hint {
    display: none;
  }
}
</style>
