<script setup lang="ts">
/**
 * 计时器页面。
 *
 * 版式对齐 csTimer：顶部打乱条、左侧成绩统计与历史、中间超大计时、右侧魔方预览。
 * 计时数字用 SVG 七段显示；交互用空格（按住起表、松开跑表），移动端用触摸按住。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useTimerStore } from '@/presentation/stores/timerStore';
import { formatMs, formatInspection } from '@/domain/timer/format';
import { listPuzzles } from '@/infrastructure/cubing/puzzleRegistry';
import { formatSolve } from '@/domain/timer/format';
import SevenSegmentDisplay from '@/presentation/components/timer/SevenSegmentDisplay.vue';
import MiniCubePreview from '@/presentation/components/timer/MiniCubePreview.vue';
import type { SolveRecord } from '@/domain/model/solve';

const timer = useTimerStore();

const puzzleOptions = computed(() => listPuzzles().filter((p) => p.status !== 'experimental'));

const bigValue = computed(() => {
  if (timer.phase === 'inspecting') return formatInspection(timer.inspection.elapsedMs);
  if (timer.phase === 'holding') return '0.000';
  return formatMs(timer.runningMs);
});

const holdClass = computed(() => ({
  'timer-stage--holding': timer.phase === 'holding' && !timer.timerState.holdReady,
  'timer-stage--ready': timer.phase === 'holding' && timer.timerState.holdReady,
  'timer-stage--running': timer.phase === 'running',
}));

const average5 = computed(() => timer.stats.ao5);
const average12 = computed(() => timer.stats.ao12);

const history = computed(() => [...timer.samples].reverse());

function aoForIndex(index: number, window: number): string {
  // index 是倒序列表下标；换算成原始顺序后取该点为止的滚动均值
  const chrono = timer.samples.length - 1 - index;
  if (chrono + 1 < window) return '';
  const slice = timer.samples.slice(chrono + 1 - window, chrono + 1);
  const values = slice.map((s) => (s.penalty === 'DNF' ? null : s.elapsedMs + (s.penalty === '+2' ? 2000 : 0)));
  if (values.filter((v) => v !== null).length < window - 1) return 'DNF';
  const numeric = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  const trimmed = numeric.slice(1, -1);
  if (trimmed.length === 0) return 'DNF';
  return formatMs(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
}

const held = ref(false);
/** 初始化（读库 + 生成首条打乱 + 挂键盘）完成后置真，供 UI/测试判定可输入 */
const ready = ref(false);

/** 最近一次成绩的有效用时（用于"当前"一栏） */
function lastEffective(): number | null {
  const record = timer.samples[timer.samples.length - 1];
  if (!record) return null;
  if (record.penalty === 'DNF') return null;
  return record.elapsedMs + (record.penalty === '+2' ? 2000 : 0);
}

function onKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && /input|textarea|select/i.test(target.tagName)) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (event.repeat) return;
    if (!held.value) {
      held.value = true;
      timer.press();
      timer.tick();
    }
    return;
  }
  if (event.key === 'Escape') timer.cancel();
  if (event.key === 'n' || event.key === 'N') void timer.newScramble();
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!held.value) return;
    held.value = false;
    timer.release();
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  timer.press();
  timer.tick();
}

function onPointerUp() {
  if (timer.phase === 'holding') timer.release();
}

function penaltyLabel(record: SolveRecord): string {
  return record.penalty === '+2' ? '+2' : record.penalty === 'DNF' ? 'DNF' : '';
}

function onPuzzleChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  void timer.setPuzzle(value);
}

onMounted(async () => {
  await timer.init();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  ready.value = true;
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
  <div class="timer-page" data-testid="timer-page" :data-ready="ready ? 'true' : 'false'">
    <!-- 顶部打乱条 -->
    <header class="scramble-bar">
      <div class="scramble-bar__event">
        <select class="scramble-bar__select" :value="timer.puzzleId" aria-label="计时项目" @change="onPuzzleChange">
          <option v-for="p in puzzleOptions" :key="p.id" :value="p.id">{{ p.displayNameZh }}</option>
        </select>
      </div>

      <p class="scramble-bar__text" data-testid="scramble-text" :data-pending="timer.scramblePending ? 'true' : 'false'">
        <span v-if="timer.scramblePending" class="scramble-bar__pending">生成打乱…</span>
        <span v-else>{{ timer.scramble || '按 N 生成新打乱' }}</span>
      </p>

      <div class="scramble-bar__actions">
        <button type="button" class="bar-btn" title="换一条打乱（N）" @click="timer.newScramble()">换一条</button>
        <button
          type="button"
          class="bar-btn"
          :class="{ 'bar-btn--on': timer.inspectionEnabled }"
          :aria-pressed="timer.inspectionEnabled"
          @click="timer.toggleInspection()"
        >
          观察 {{ timer.inspectionEnabled ? '开' : '关' }}
        </button>
      </div>
    </header>

    <div class="timer-body">
      <!-- 左栏：统计 + 历史 -->
      <aside class="stats-pane" data-testid="stats-pane">
        <div class="stats-pane__group">
          <span class="stats-pane__label">分组</span>
          <span class="stats-pane__name">{{ puzzleOptions.find((p) => p.id === timer.puzzleId)?.displayNameZh }}</span>
        </div>

        <table class="stats-table">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">当前</th>
              <th scope="col">最快</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">时间</th>
              <td data-testid="stat-current">{{ formatMs(timer.samples.length ? lastEffective() : null) }}</td>
              <td>{{ formatMs(timer.stats.best) }}</td>
            </tr>
            <tr>
              <th scope="row">mo3</th>
              <td>{{ formatMs(timer.stats.mo3) }}</td>
              <td>{{ formatMs(timer.stats.mo3) }}</td>
            </tr>
            <tr>
              <th scope="row">ao5</th>
              <td data-testid="stat-ao5">{{ formatMs(timer.stats.ao5) }}</td>
              <td>{{ formatMs(timer.stats.bestAo5) }}</td>
            </tr>
            <tr>
              <th scope="row">ao12</th>
              <td>{{ formatMs(timer.stats.ao12) }}</td>
              <td>{{ formatMs(timer.stats.bestAo12) }}</td>
            </tr>
            <tr>
              <th scope="row">还原</th>
              <td colspan="2" class="stats-table__count">{{ timer.stats.count }} / {{ timer.stats.count }}</td>
            </tr>
            <tr>
              <th scope="row">平均</th>
              <td colspan="2">{{ formatMs(timer.stats.mean) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="history" data-testid="history">
          <div class="history__head">
            <span>#</span><span>时间</span><span>ao5</span><span>ao12</span>
          </div>
          <ol class="history__list">
            <li v-for="(record, index) in history" :key="record.id" class="history__row">
              <span class="history__index">{{ timer.samples.length - index }}</span>
              <span class="history__time" :class="{ 'history__time--best': record.elapsedMs === timer.stats.best }">
                {{ formatSolve(record.elapsedMs, record.penalty) }}
                <em v-if="penaltyLabel(record)" class="history__penalty">{{ penaltyLabel(record) }}</em>
              </span>
              <span class="history__avg">{{ aoForIndex(index, 5) }}</span>
              <span class="history__avg">{{ aoForIndex(index, 12) }}</span>
            </li>
          </ol>
          <p v-if="history.length === 0" class="history__empty">还没有成绩，按住空格开始计时。</p>
        </div>
      </aside>

      <!-- 中间：大计时 -->
      <section
        class="timer-stage"
        :class="holdClass"
        data-testid="timer-stage"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <SevenSegmentDisplay :value="bigValue" :height="168" data-testid="timer-display" />
        <div class="timer-stage__sub">
          <span>ao5: <b>{{ formatMs(average5) }}</b></span>
          <span>ao12: <b>{{ formatMs(average12) }}</b></span>
        </div>
        <p class="timer-stage__hint">
          <template v-if="timer.phase === 'inspecting'">观察中 —— 按住空格准备，松开开始</template>
          <template v-else-if="timer.phase === 'holding'">
            {{ timer.timerState.holdReady ? '松开开始' : '继续按住…' }}
          </template>
          <template v-else-if="timer.phase === 'running'">按空格停表</template>
          <template v-else>按住空格（或按住此处）{{ timer.inspectionEnabled ? '开始观察' : '开始计时' }}</template>
        </p>
      </section>

      <!-- 右栏：魔方预览 -->
      <aside class="cube-pane">
        <MiniCubePreview :puzzle-id="timer.puzzleId" :scramble="timer.scramble" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.timer-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--timer-bg, var(--bg));
  color: var(--timer-text, var(--text));
}

/* ---------- 顶部打乱条 ---------- */
.scramble-bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 16px;
  background: var(--timer-bar-bg, #f3e8f2);
  border-bottom: 1px solid color-mix(in srgb, var(--timer-text, #222) 12%, transparent);
  min-height: 62px;
}

.scramble-bar__select {
  border: 1px solid color-mix(in srgb, var(--timer-text, #222) 18%, transparent);
  background: color-mix(in srgb, var(--timer-bg, #fff) 70%, transparent);
  color: inherit;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 13px;
  max-width: 150px;
}

.scramble-bar__text {
  margin: 0;
  text-align: center;
  font-family: ui-monospace, 'SFMono-Regular', 'Consolas', monospace;
  font-size: 15px;
  line-height: 1.45;
  letter-spacing: 0.01em;
  word-break: break-word;
}

.scramble-bar__pending {
  opacity: 0.6;
}

.scramble-bar__actions {
  display: flex;
  gap: 6px;
}

.bar-btn {
  border: 1px solid color-mix(in srgb, var(--timer-text, #222) 20%, transparent);
  background: transparent;
  color: inherit;
  font-size: 12px;
  padding: 5px 9px;
  border-radius: 4px;
  cursor: pointer;
}

.bar-btn:hover {
  background: color-mix(in srgb, var(--timer-text, #222) 8%, transparent);
}

.bar-btn--on {
  border-color: var(--accent);
  color: var(--accent);
}

/* ---------- 主体三栏 ---------- */
.timer-body {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 210px;
  flex: 1;
  min-height: 0;
}

.stats-pane {
  border-right: 1px solid var(--border);
  padding: 10px 12px 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  font-size: 13px;
}

.stats-pane__group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.stats-pane__label {
  color: var(--text-secondary);
  font-size: 12px;
}

.stats-pane__name {
  font-weight: 600;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-variant-numeric: tabular-nums;
}

.stats-table th,
.stats-table td {
  padding: 2px 4px;
  text-align: right;
  font-weight: 400;
}

.stats-table thead th {
  color: var(--text-secondary);
  font-size: 11px;
  padding-bottom: 4px;
}

.stats-table tbody th {
  text-align: left;
  color: var(--text-secondary);
  font-size: 12px;
}

.stats-table__count {
  text-align: right;
}

.history {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  padding-top: 6px;
}

.history__head,
.history__row {
  display: grid;
  grid-template-columns: 34px 1fr 62px 62px;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.history__head {
  color: var(--text-secondary);
  font-size: 11px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.history__row {
  padding: 2px 0;
  font-size: 12.5px;
}

.history__index {
  color: var(--text-secondary);
  text-align: right;
  padding-right: 2px;
}

.history__time {
  text-align: right;
}

.history__time--best {
  color: var(--timer-best, #d93a3a);
  font-weight: 600;
}

.history__penalty {
  font-style: normal;
  font-size: 10px;
  margin-left: 3px;
  color: var(--text-secondary);
}

.history__avg {
  text-align: right;
  color: var(--timer-avg, #2447c9);
}

.history__empty {
  color: var(--text-secondary);
  font-size: 12px;
  padding: 12px 0;
}

/* ---------- 中间计时区 ---------- */
.timer-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 12px;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  min-width: 0;
}

.timer-stage--holding {
  --timer-digit: #c02a2a;
}

.timer-stage--ready {
  --timer-digit: #1f9d55;
}

.timer-stage__sub {
  display: flex;
  gap: 26px;
  font-size: 20px;
  color: var(--timer-avg, #2447c9);
  font-variant-numeric: tabular-nums;
}

.timer-stage__sub b {
  font-weight: 600;
}

.timer-stage__hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

/* ---------- 右栏预览 ---------- */
.cube-pane {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-left: 1px solid var(--border);
}

@media (max-width: 1080px) {
  .timer-body {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .cube-pane {
    display: none;
  }
}

@media (max-width: 720px) {
  .timer-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .stats-pane {
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 42vh;
  }

  .scramble-bar {
    grid-template-columns: 1fr auto;
    grid-template-areas: 'event actions' 'text text';
    row-gap: 6px;
  }

  .scramble-bar__event {
    grid-area: event;
  }

  .scramble-bar__text {
    grid-area: text;
    font-size: 13px;
  }

  .scramble-bar__actions {
    grid-area: actions;
  }
}
</style>
