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
import {
  EXPORT_LABEL,
  EXPORT_MIME,
  buildExport,
  exportFileName,
  type ExportFormat,
} from '@/application/timer/exportSolves';
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
  if (event.key === 'Delete') {
    event.preventDefault();
    void deleteLast();
    return;
  }
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

/* ---------- 成绩导出与编辑（对齐 csTimer 的操作习惯） ---------- */

const flash = ref('');
const exportFormats: ExportFormat[] = ['csv', 'json', 'text'];
let flashTimer = 0;
function notify(message: string) {
  flash.value = message;
  window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => {
    flash.value = '';
  }, 2600);
}

const puzzleName = computed(
  () => puzzleOptions.value.find((p) => p.id === timer.puzzleId)?.displayNameZh ?? timer.puzzleId,
);

function download(format: ExportFormat) {
  if (timer.samples.length === 0) {
    notify('还没有成绩可以导出');
    return;
  }
  const input = { puzzleName: puzzleName.value, sessionId: timer.sessionId, records: timer.samples };
  const blob = new Blob([buildExport(format, input)], { type: EXPORT_MIME[format] });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exportFileName(format, puzzleName.value);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  notify(`已导出 ${timer.samples.length} 条成绩（${EXPORT_LABEL[format]}）`);
}

async function togglePlusTwo(record: SolveRecord) {
  await timer.setPenalty(record, record.penalty === '+2' ? 'none' : '+2');
}

async function toggleDnf(record: SolveRecord) {
  await timer.setPenalty(record, record.penalty === 'DNF' ? 'none' : 'DNF');
}

async function deleteSolve(record: SolveRecord) {
  await timer.removeSolve(record);
  notify('已删除一条成绩');
}

/** 删除最后一条（Delete 键） */
async function deleteLast() {
  const last = timer.samples[timer.samples.length - 1];
  if (!last) return;
  await deleteSolve(last);
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
    <p v-if="flash" class="timer-flash" data-testid="timer-flash">{{ flash }}</p>
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
              <th scope="row">ao50</th>
              <td>{{ formatMs(timer.stats.ao50) }}</td>
              <td>{{ formatMs(timer.stats.bestAo50) }}</td>
            </tr>
            <tr>
              <th scope="row">ao100</th>
              <td>{{ formatMs(timer.stats.ao100) }}</td>
              <td>—</td>
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
          <div class="history__toolbar">
            <span class="history__title">成绩（{{ timer.samples.length }}）</span>
            <div class="history__export">
              <span class="history__export-label">导出</span>
              <button
                v-for="format in exportFormats"
                :key="format"
                type="button"
                class="bar-btn bar-btn--small"
                :data-testid="`export-${format}`"
                :title="`导出为 ${EXPORT_LABEL[format]}`"
                @click="download(format)"
              >
                {{ EXPORT_LABEL[format] }}
              </button>
            </div>
          </div>
          <div class="history__head">
            <span>#</span><span>时间</span><span>ao5</span><span>ao12</span><span class="history__ops-head">改判/删除</span>
          </div>
          <ol class="history__list">
            <li v-for="(record, index) in history" :key="record.id" class="history__row" :data-testid="`solve-row-${index}`">
              <span class="history__index">{{ timer.samples.length - index }}</span>
              <span class="history__time" :class="{ 'history__time--best': record.elapsedMs === timer.stats.best }">
                {{ formatSolve(record.elapsedMs, record.penalty) }}
                <em v-if="penaltyLabel(record)" class="history__penalty">{{ penaltyLabel(record) }}</em>
              </span>
              <span class="history__avg">{{ aoForIndex(index, 5) }}</span>
              <span class="history__avg">{{ aoForIndex(index, 12) }}</span>
              <span class="history__ops">
                <button
                  type="button"
                  class="op-btn"
                  :class="{ 'op-btn--on': record.penalty === '+2' }"
                  title="加 2 秒 / 取消加时"
                  :data-testid="`plus2-${index}`"
                  @click="togglePlusTwo(record)"
                >
                  +2
                </button>
                <button
                  type="button"
                  class="op-btn"
                  :class="{ 'op-btn--on': record.penalty === 'DNF' }"
                  title="判为 DNF / 取消"
                  :data-testid="`dnf-${index}`"
                  @click="toggleDnf(record)"
                >
                  DNF
                </button>
                <button
                  type="button"
                  class="op-btn op-btn--danger"
                  title="删除这条成绩"
                  :data-testid="`delete-${index}`"
                  @click="deleteSolve(record)"
                >
                  ×
                </button>
              </span>
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
        <SevenSegmentDisplay :value="bigValue" :height="168" fluid data-testid="timer-display" />
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
  position: relative;
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

/* 导出工具条 */
.history__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-bottom: 6px;
}

.history__title {
  font-size: 12px;
  color: var(--text-secondary);
}

.history__export {
  display: flex;
  align-items: center;
  gap: 4px;
}

.history__export-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.bar-btn--small {
  font-size: 11px;
  padding: 3px 6px;
}

.history__ops-head {
  text-align: right;
  font-size: 10px;
}

/* 每行操作按钮：+2 / DNF / 删除 */
.history__ops {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.12s;
}

.history__row:hover .history__ops,
.history__row:focus-within .history__ops {
  opacity: 1;
}

@media (hover: none) {
  .history__ops {
    opacity: 1;
  }
}

.op-btn {
  border: 1px solid color-mix(in srgb, var(--timer-text, #222) 18%, transparent);
  background: transparent;
  color: inherit;
  font-size: 10px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 3px;
  cursor: pointer;
}

.op-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.op-btn--on {
  border-color: var(--danger, #d64545);
  color: var(--danger, #d64545);
  font-weight: 600;
}

.op-btn--danger:hover {
  border-color: var(--danger, #d64545);
  color: var(--danger, #d64545);
}

/* 顶部闪现提示 */
.timer-flash {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  margin: 0;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--accent, #2563eb);
  color: #fff;
  font-size: 12px;
  box-shadow: 0 4px 14px rgb(0 0 0 / 18%);
}

.history__head,
.history__row {
  display: grid;
  grid-template-columns: 28px 1fr 54px 54px 74px;
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
  /* 手机：大计时固定在中间，统计与历史在下方，历史自身滚动 —— 整页不上下滑 */
  .timer-body {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .timer-stage {
    order: 1;
    flex: 0 0 auto;
    height: 30vh;
    min-height: 176px;
    gap: 6px;
    padding: 4px 8px 2px;
  }

  .cube-pane {
    display: none;
  }

  .stats-pane {
    order: 2;
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
    overflow: hidden;
    border-right: none;
    border-top: 1px solid var(--border);
    border-bottom: none;
    padding: 4px 10px 0;
  }

  .stats-pane__group {
    padding-bottom: 4px;
  }

  /* 统计表只保留 时间 / ao5 / ao12 / 还原 四行，避免占据整屏 */
  .stats-table {
    margin: 4px 0;
    font-size: 12px;
  }

  .stats-table thead tr th:nth-child(3),
  .stats-table tbody tr td:nth-child(3) {
    display: none;
  }

  .stats-table tbody tr:nth-child(2),
  .stats-table tbody tr:nth-child(5),
  .stats-table tbody tr:nth-child(6),
  .stats-table tbody tr:nth-child(8) {
    display: none;
  }

  .history {
    min-height: 0;
  }

  .history__head,
  .history__row {
    grid-template-columns: 26px 1fr 46px 46px 68px;
    font-size: 12px;
  }

  .history__ops {
    opacity: 1;
  }

  .scramble-bar {
    grid-template-columns: 1fr auto;
    grid-template-areas: 'event actions' 'text text';
    row-gap: 6px;
    padding: 6px 10px;
  }

  .scramble-bar__event {
    grid-area: event;
  }

  .scramble-bar__text {
    grid-area: text;
    font-size: 11.5px;
    line-height: 1.35;
    /* 打乱是必须完整可见的信息，手机上不截断，让它自然折行 */
    word-break: normal;
    overflow-wrap: anywhere;
  }

  .scramble-bar__actions {
    grid-area: actions;
  }
}
</style>
