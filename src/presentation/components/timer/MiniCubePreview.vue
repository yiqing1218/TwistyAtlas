<script setup lang="ts">
/**
 * 计时器右侧的魔方预览：显示"当前打乱后的样子"。
 * 用真实的 TwistyPlayer 渲染（不是图片），并把打乱作为 setup 应用。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createTwistyPlayer, type TwistyPlayerInstance } from '@/infrastructure/cubing/cubingBridge';
import { getPuzzleDescriptor } from '@/infrastructure/cubing/puzzleRegistry';
import { useI18n } from '@/presentation/i18n';

const { t } = useI18n();

const props = defineProps<{ puzzleId: string; scramble: string }>();

const host = ref<HTMLDivElement | null>(null);
const failed = ref(false);
let player: TwistyPlayerInstance | null = null;
let disposed = false;

async function build() {
  if (!host.value) return;
  const descriptor = getPuzzleDescriptor(props.puzzleId);
  try {
    const next = await createTwistyPlayer({
      puzzle: props.puzzleId as never,
      experimentalSetupAlg: props.scramble || '',
      experimentalSetupAnchor: 'start',
      hintFacelets: 'none',
      cameraLatitude: descriptor?.camera.latitude ?? 30,
      cameraLongitude: descriptor?.camera.longitude ?? 30,
      cameraDistance: (descriptor?.camera.distance ?? 6) * 1.12,
      background: 'none',
      controlPanel: 'none',
    });
    if (disposed) return;
    next.style.width = '100%';
    next.style.height = '100%';
    host.value.replaceChildren(next);
    player = next;
  } catch {
    failed.value = true;
  }
}

onMounted(() => {
  void build();
});

watch(
  () => props.scramble,
  (value) => {
    if (player) {
      // 只改 setup，不重建播放器，避免 WebGL 上下文泄漏
      player.experimentalSetupAlg = value;
    }
  },
);

watch(
  () => props.puzzleId,
  async () => {
    player = null;
    if (host.value) host.value.replaceChildren();
    failed.value = false;
    await build();
  },
);

onBeforeUnmount(() => {
  disposed = true;
  player = null;
  if (host.value) host.value.replaceChildren();
});
</script>

<template>
  <div class="mini-cube">
    <div ref="host" class="mini-cube__host" data-testid="mini-cube" />
    <p v-if="failed" class="mini-cube__error">{{ t('viewport.previewUnavailable') }}</p>
  </div>
</template>

<style scoped>
.mini-cube {
  width: 100%;
  height: 100%;
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-cube__host {
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.mini-cube__error {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
