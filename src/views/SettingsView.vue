<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ImportDialog from '../components/ImportDialog.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';
import PuzzlePicker from '../components/PuzzlePicker.vue';
import { useSettingsStore } from '../stores/settingsStore';
import { useFormulaStore } from '../stores/formulaStore';
import { SPEED_OPTIONS, type ThemeMode } from '../types/settings';
import { PUZZLE_DESCRIPTORS, STATUS_LABEL } from '../engine/puzzleRegistry';
import { db } from '../db/database';
import { clearFormulas } from '../db/formulaRepository';
import { seedDatabase } from '../db/seed';

const settings = useSettingsStore();
const store = useFormulaStore();
const importOpen = ref(false);
const message = ref<string | null>(null);
const counts = ref({ formulas: 0, categories: 0 });

const themes: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

const faceLegend = computed(() => [
  { key: 'U', label: '上 U', color: settings.settings.faceColors.U },
  { key: 'D', label: '下 D', color: settings.settings.faceColors.D },
  { key: 'F', label: '前 F', color: settings.settings.faceColors.F },
  { key: 'B', label: '后 B', color: settings.settings.faceColors.B },
  { key: 'R', label: '右 R', color: settings.settings.faceColors.R },
  { key: 'L', label: '左 L', color: settings.settings.faceColors.L },
]);

async function refreshCounts() {
  counts.value = {
    formulas: await db.formulas.count(),
    categories: await db.categories.count(),
  };
}

onMounted(refreshCounts);

async function setTheme(theme: ThemeMode) {
  await settings.update({ theme });
}

async function setSpeed(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value);
  await settings.update({ playbackSpeed: value });
}

async function setDefaultPuzzle(id: string) {
  await settings.update({ defaultPuzzleId: id });
}

async function toggleHintFacelets(event: Event) {
  await settings.update({ showHintFacelets: (event.target as HTMLInputElement).checked });
}

async function toggleLockCamera(event: Event) {
  await settings.update({ lockCamera: (event.target as HTMLInputElement).checked });
}

async function clearAll() {
  const first = window.confirm('这会删除本地保存的全部公式（分类与设置保留）。建议先导出备份。继续？');
  if (!first) return;
  const second = window.confirm('再次确认：删除后无法恢复，除非你有备份。');
  if (!second) return;
  try {
    await clearFormulas();
    await store.refresh();
    await refreshCounts();
    message.value = '已清空公式库。';
  } catch (err) {
    message.value = `清空失败：${(err as Error).message}`;
  }
}

async function reseed() {
  try {
    await seedDatabase(true);
    await store.refresh();
    await refreshCounts();
    message.value = '已重新写入内置演示公式（不会删除你自己的公式）。';
  } catch (err) {
    message.value = `写入失败：${(err as Error).message}`;
  }
}
</script>

<template>
  <ErrorBoundary>
    <div class="settings">
      <header class="settings__header">
        <h1 class="settings__title">设置</h1>
        <p class="muted small">所有数据保存在本机浏览器中，不联网、不需要账号。</p>
      </header>

      <p v-if="message" class="alert alert--success">{{ message }}</p>
      <p v-if="settings.saveError" class="alert alert--error">{{ settings.saveError }}</p>

      <section class="panel">
        <div class="panel__header"><span class="panel__title">外观</span></div>
        <div class="panel__body stack">
          <div class="field">
            <span class="field__label">主题</span>
            <div class="segmented" role="group" aria-label="主题">
              <button
                v-for="theme in themes"
                :key="theme.value"
                type="button"
                class="segmented__item"
                :class="{ 'segmented__item--active': settings.settings.theme === theme.value }"
                @click="setTheme(theme.value)"
              >
                {{ theme.label }}
              </button>
            </div>
          </div>
          <div class="field">
            <span class="field__label">标准配色对照</span>
            <div class="faces">
              <span v-for="face in faceLegend" :key="face.key" class="face">
                <span class="face__swatch" :style="{ background: face.color }"></span>
                {{ face.label }}
              </span>
            </div>
            <p class="field__hint">
              三维贴纸颜色由渲染引擎绘制。当前安装的引擎版本没有暴露逐面自定义颜色的 API，
              因此这里只提供对照说明，不做假的"改色"开关。主题切换会影响整个界面。
            </p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header"><span class="panel__title">播放</span></div>
        <div class="panel__body stack">
          <div class="grid-2">
            <label class="field">
              <span class="field__label">默认播放速度</span>
              <select class="select" :value="settings.settings.playbackSpeed" @change="setSpeed">
                <option v-for="speed in SPEED_OPTIONS" :key="speed" :value="speed">{{ speed }}×</option>
              </select>
            </label>
            <div class="field">
              <span class="field__label">默认魔方类型</span>
              <PuzzlePicker :model-value="settings.settings.defaultPuzzleId" @update:model-value="setDefaultPuzzle" />
            </div>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" :checked="settings.settings.showHintFacelets" @change="toggleHintFacelets" />
            显示背面提示贴纸（hint facelets）
          </label>
          <label class="checkbox-row">
            <input type="checkbox" :checked="settings.settings.lockCamera" @change="toggleLockCamera" />
            锁定观察视角（防止误拖动；公式播放不受影响）
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header">
          <span class="panel__title">数据</span>
          <span class="badge">{{ counts.formulas }} 条公式 · {{ counts.categories }} 个分类</span>
        </div>
        <div class="panel__body stack">
          <div class="row">
            <button type="button" class="btn" @click="importOpen = true">导入 / 导出备份</button>
            <button type="button" class="btn" @click="reseed">重新写入演示公式</button>
            <button type="button" class="btn btn--danger" @click="clearAll">清空公式库</button>
          </div>
          <p class="field__hint">
            清理浏览器数据（Cookie / 站点数据）会同时删除 IndexedDB 中的公式。建议定期导出 JSON 备份。
            导入时会先预览，重复记录可跳过、覆盖或作为新记录导入；失败会整体回滚。
          </p>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header">
          <span class="panel__title">魔方能力矩阵</span>
          <span class="small muted">仅在真实 3D 与层转验证通过后才标记为三维可播放</span>
        </div>
        <div class="panel__body">
          <table class="matrix">
            <thead>
              <tr>
                <th>魔方</th>
                <th>能力状态</th>
                <th>公式</th>
                <th>步进定位</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="puzzle in PUZZLE_DESCRIPTORS" :key="puzzle.id">
                <td>
                  <strong>{{ puzzle.displayNameZh }}</strong>
                  <span class="mono small muted">{{ puzzle.id }}</span>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="puzzle.status === 'ready-3d' ? 'badge--success' : 'badge--warning'"
                  >{{ STATUS_LABEL[puzzle.status] }}</span>
                </td>
                <td>{{ puzzle.supportsAnimation ? '支持' : '不支持' }}</td>
                <td>{{ puzzle.supportsStepSeek ? '支持' : '不支持' }}</td>
                <td class="small muted">{{ puzzle.verificationNote }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel__header"><span class="panel__title">关于与已知限制</span></div>
        <div class="panel__body stack small muted">
          <p>Twisty Atlas 1.0 · 纯客户端应用，使用 cubing.js 渲染与计算真实魔方状态。</p>
          <ul class="limits">
            <li>Square-1 的公式语法与状态由 KPuzzle 计算，但三维形变渲染仍属实验性，界面上不会标成"已完成"。</li>
            <li>逐面自定义贴纸颜色、手动拖动转层记录公式、云同步属于后续阶段，本版未实现。</li>
            <li>首次载入高階魔方（6×6、7×7）需要下载额外的几何数据，离线缓存需要先联网访问一次。</li>
            <li>iOS Safari 的"添加到主屏幕"与 Android 安装流程不同，均不是应用商店上架。</li>
          </ul>
        </div>
      </section>
    </div>

    <ImportDialog :open="importOpen" @close="importOpen = false" />
  </ErrorBoundary>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
}

.settings__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings__title {
  font-size: 20px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.segmented {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  background: var(--surface-3);
  border-radius: var(--radius-sm);
  width: fit-content;
}

.segmented__item {
  padding: 5px 12px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.segmented__item--active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.faces {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.face {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.face__swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--border-strong);
}

.matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.matrix th,
.matrix td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.matrix th {
  font-size: 12px;
  color: var(--muted);
  background: var(--surface-2);
}

.limits {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (max-width: 640px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .matrix {
    font-size: 12px;
  }
}
</style>
