import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  INITIAL_TIMER_STATE,
  displayMs,
  inspectionStatus,
  reduce,
  solveOutcome,
  type Penalty,
  type TimerState,
} from '@/domain/timer/stateMachine';
import { summarize } from '@/domain/timer/statistics';
import { defaultSessionId, type SolveRecord } from '@/domain/model/solve';
import { solveRepository } from '@/infrastructure/persistence/solveRepository';
import { generateScramble } from '@/infrastructure/cubing/scrambleService';

/**
 * 计时器（表现层状态容器）。
 *
 * 状态迁移本身是 `@/domain/timer/stateMachine` 里的纯函数；
 * 这里只负责：时钟推进、键盘/触摸输入、打乱获取、成绩落库。
 */
export const useTimerStore = defineStore('timer', () => {
  const timerState = shallowRef<TimerState>({ ...INITIAL_TIMER_STATE });
  const nowMs = ref(0);
  const puzzleId = ref('3x3x3');
  const samples = ref<SolveRecord[]>([]);
  const scramble = ref('');
  const scramblePending = ref(false);
  const scrambleSource = ref<'state' | 'moves' | null>(null);
  const inspectionEnabled = ref(false);
  const initialized = ref(false);

  const sessionId = computed(() => defaultSessionId(puzzleId.value));
  const phase = computed(() => timerState.value.phase);
  const isRunning = computed(() => phase.value === 'running');
  const stats = computed(() => summarize(samples.value));
  const runningMs = computed(() => displayMs(timerState.value, nowMs.value));
  const inspection = computed(() => inspectionStatus(timerState.value, nowMs.value));

  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  let raf = 0;
  function ensureLoop() {
    if (raf) return;
    const step = () => {
      nowMs.value = clock();
      const active = ['running', 'holding', 'inspecting'].includes(timerState.value.phase);
      if (active) raf = requestAnimationFrame(step);
      else {
        raf = 0;
      }
    };
    raf = requestAnimationFrame(step);
  }
  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function dispatch(next: TimerState) {
    timerState.value = next;
    nowMs.value = clock();
    if (['running', 'holding', 'inspecting'].includes(next.phase)) ensureLoop();
    else stopLoop();
  }

  async function refreshSamples() {
    samples.value = await solveRepository.list(sessionId.value, 2000);
  }

  async function init(id?: string) {
    if (id && id !== puzzleId.value) puzzleId.value = id;
    await refreshSamples();
    if (!initialized.value || !scramble.value) {
      initialized.value = true;
      await newScramble();
    }
  }

  async function setPuzzle(id: string) {
    puzzleId.value = id;
    dispatch({ ...INITIAL_TIMER_STATE });
    samples.value = [];
    await refreshSamples();
    await newScramble();
  }

  async function newScramble() {
    scramblePending.value = true;
    try {
      const { scramble: text, source } = await generateScramble(puzzleId.value);
      scramble.value = text;
      scrambleSource.value = source;
    } finally {
      scramblePending.value = false;
    }
  }

  /** 记录一次成绩（停表时调用一次） */
  async function commit(elapsedOverride?: number) {
    const outcome = solveOutcome(timerState.value, inspectionEnabled.value);
    const elapsedMs = elapsedOverride ?? outcome.elapsedMs;
    if (!elapsedMs || elapsedMs < 100) return;
    const record: SolveRecord = {
      id: crypto.randomUUID(),
      sessionId: sessionId.value,
      puzzleId: puzzleId.value,
      scramble: scramble.value,
      elapsedMs: Math.round(elapsedMs),
      penalty: outcome.penalty,
      createdAt: Date.now(),
    };
    await solveRepository.add(record);
    samples.value = [...samples.value, record];
    await newScramble();
  }

  function press() {
    const at = clock();
    const before = timerState.value.phase;
    dispatch(reduce(timerState.value, { type: 'press', at, inspectionEnabled: inspectionEnabled.value }));
    if (before === 'running') {
      const elapsed = timerState.value.elapsedMs ?? 0;
      void commit(elapsed);
    }
  }

  function release() {
    const at = clock();
    dispatch(reduce(timerState.value, { type: 'release', at }));
  }

  function tick() {
    if (timerState.value.phase === 'holding') {
      dispatch(reduce(timerState.value, { type: 'tick', at: clock() }));
    }
  }

  function cancel() {
    dispatch(reduce(timerState.value, { type: 'cancel' }));
  }

  async function setPenalty(record: SolveRecord, penalty: Penalty) {
    await solveRepository.updatePenalty(record.id, penalty);
    samples.value = samples.value.map((s) => (s.id === record.id ? { ...s, penalty } : s));
  }

  async function removeSolve(record: SolveRecord) {
    await solveRepository.remove(record.id);
    samples.value = samples.value.filter((s) => s.id !== record.id);
  }

  async function clearSession() {
    await solveRepository.clear(sessionId.value);
    samples.value = [];
  }

  function toggleInspection() {
    inspectionEnabled.value = !inspectionEnabled.value;
    dispatch({ ...INITIAL_TIMER_STATE });
  }

  return {
    timerState,
    nowMs,
    puzzleId,
    samples,
    scramble,
    scramblePending,
    scrambleSource,
    inspectionEnabled,
    phase,
    isRunning,
    stats,
    runningMs,
    inspection,
    sessionId,
    init,
    setPuzzle,
    newScramble,
    press,
    release,
    tick,
    cancel,
    commit,
    setPenalty,
    removeSolve,
    clearSession,
    toggleInspection,
  };
});
