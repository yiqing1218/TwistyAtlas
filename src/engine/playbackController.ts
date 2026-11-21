import {
  createTwistyPlayer,
  animatedLeaves,
  expandAlgLeaves,
  type TwistyPlayerInstance,
} from './cubingBridge';
import { getPuzzleDescriptor } from './puzzleRegistry';

export type PlaybackStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  error: string | null;
  puzzleId: string;
  alg: string;
  setupAlg: string;
  /** 公式动作总数 N */
  totalSteps: number;
  /** 已完成动作数 k ∈ [0, N] */
  currentStep: number;
  /** 正在执行的动作下标（0 起始），无则为 null */
  activeMoveIndex: number | null;
  /** 正在执行动作的进度 0..1 */
  moveProgress: number;
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  speed: number;
  /** 每个步骤边界对应的时间戳（ms），长度 N+1，供进度条使用 */
  stepTimes: number[];
  /** 播放器实际报告的当前时间戳（ms） */
  timestamp: number;
  /** 引擎实际使用的可视化方式（来自 visualizationStrategy，不是猜的） */
  renderMode: '3D' | '2D' | 'other';
}

export interface LoadOptions {
  puzzleId: string;
  alg: string;
  setupAlg: string;
  speed: number;
  showHintFacelets?: boolean;
  camera?: { latitude: number; longitude: number; distance: number };
}

export const INITIAL_SNAPSHOT: PlaybackSnapshot = {
  status: 'idle',
  error: null,
  puzzleId: '3x3x3',
  alg: '',
  setupAlg: '',
  totalSteps: 0,
  currentStep: 0,
  activeMoveIndex: null,
  moveProgress: 0,
  playing: false,
  atStart: true,
  atEnd: false,
  speed: 1,
  stepTimes: [0],
  timestamp: 0,
  renderMode: 'other',
};

export interface StepLocation {
  currentStep: number;
  activeMoveIndex: number | null;
  moveProgress: number;
}

/**
 * 纯函数：根据步骤边界时间轴推导当前状态。
 * 单独抽出以便在没有 WebGL 的环境（单元测试）里验证边界行为。
 *
 * 约定：
 * - timestamp === stepTimes[k] 表示"前 k 步已完成"，此时没有动作正在执行
 * - 位于 (stepTimes[k], stepTimes[k+1]) 之间表示第 k 个动作正在执行
 */
export function locateStepFromTimeline(
  stepTimes: number[],
  totalSteps: number,
  timestamp: number,
): StepLocation {
  if (totalSteps === 0 || stepTimes.length < 2) {
    return { currentStep: 0, activeMoveIndex: null, moveProgress: 0 };
  }

  let completed = 0;
  for (let k = 1; k <= totalSteps; k += 1) {
    if (timestamp >= (stepTimes[k] ?? Infinity) - 0.01) completed = k;
    else break;
  }

  if (completed >= totalSteps) {
    return { currentStep: totalSteps, activeMoveIndex: null, moveProgress: 0 };
  }

  const start = stepTimes[completed];
  const end = stepTimes[completed + 1];
  const span = Math.max(1, end - start);
  const progress = Math.min(1, Math.max(0, (timestamp - start) / span));
  if (progress <= 0.001) {
    return { currentStep: completed, activeMoveIndex: null, moveProgress: 0 };
  }
  return { currentStep: completed, activeMoveIndex: completed, moveProgress: progress };
}

interface FreshListenerSource<T> {
  addFreshListener: (cb: (value: T) => void) => void;
  removeFreshListener: (cb: (value: T) => void) => void;
}

interface DetailedTimelineInfoValue {
  timestamp: number;
  atStart: boolean;
  atEnd: boolean;
}

interface CoarseTimelineInfoValue {
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * 播放控制器：把 TwistyPlayer 的能力收敛成项目自己稳定的接口。
 *
 * 核心做法（与官方 `<twisty-alg-viewer>` 一致）：
 * - 第 k 步的位置 = indexer.indexToMoveStartTimestamp(k) + indexer.moveDuration(k)
 * - 使用同一个播放器实例的时间轴定位，不销毁/重建 WebGL 画布
 * - 步骤高亮完全来自 detailedTimelineInfo 的真实时间戳，不用定时器猜测
 */
export class PlaybackController {
  private container: HTMLElement | null = null;
  private player: TwistyPlayerInstance | null = null;
  private playerPromise: Promise<TwistyPlayerInstance> | null = null;
  private snapshot: PlaybackSnapshot = { ...INITIAL_SNAPSHOT };
  private listeners = new Set<(s: PlaybackSnapshot) => void>();
  private loadSequence = 0;
  private currentPuzzleId: string | null = null;
  private boundDetailed: ((v: DetailedTimelineInfoValue) => void) | null = null;
  private boundCoarse: ((v: CoarseTimelineInfoValue) => void) | null = null;
  private currentCamera: { latitude: number; longitude: number; distance: number } | null = null;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  subscribe(listener: (s: PlaybackSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): PlaybackSnapshot {
    return this.snapshot;
  }

  private emit(patch: Partial<PlaybackSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) {
      try {
        listener(this.snapshot);
      } catch (err) {
        console.error('[PlaybackController] listener error', err);
      }
    }
  }

  /** 确保播放器存在并挂载到容器（同一个组件生命周期内只创建一次） */
  private async ensurePlayer(): Promise<TwistyPlayerInstance> {
    if (this.player) return this.player;
    if (!this.playerPromise) this.playerPromise = this.attachPlayer();
    return this.playerPromise;
  }

  private async attachPlayer(): Promise<TwistyPlayerInstance> {
    if (!this.container) throw new Error('播放器容器不存在');
    const descriptor = getPuzzleDescriptor(this.snapshot.puzzleId) ?? getPuzzleDescriptor('3x3x3');
    const camera = this.currentCamera ?? descriptor?.camera ?? { latitude: 30, longitude: 30, distance: 5 };
    const player = await createTwistyPlayer({
      puzzle: (descriptor?.id ?? '3x3x3') as never,
      alg: '',
      background: 'none',
      controlPanel: 'none',
      viewerLink: 'none',
      hintFacelets: 'none',
      cameraLatitude: camera.latitude,
      cameraLongitude: camera.longitude,
      cameraDistance: camera.distance,
      tempoScale: this.snapshot.speed,
      experimentalSetupAnchor: 'start',
    });
    // 顺序动画 + 严格逐步语义：每一步的结束时间都可精确计算。
    player.indexer = 'simple';
    // 只设置尺寸，不要覆盖 display：TwistyPlayer 的 :host 需要 display:grid
    // 才能让内部的 .wrapper 撑满高度，否则 3D 画布高度会是 0。
    player.style.width = '100%';
    player.style.height = '100%';
    this.container.appendChild(player);
    this.player = player;
    this.bindTimeline(player);
    return player;
  }

  private bindTimeline(player: TwistyPlayerInstance): void {
    const model = player.experimentalModel;
    const detailed = model.detailedTimelineInfo as unknown as FreshListenerSource<DetailedTimelineInfoValue>;
    const coarse = model.coarseTimelineInfo as unknown as FreshListenerSource<CoarseTimelineInfoValue>;

    this.boundDetailed = (info) => {
      if (this.snapshot.status !== 'ready') return;
      // 到达终点时直接报告 N/N：某些魔方的最后一个动作结束时间与时间轴末尾
      // 存在亚毫秒级差异，纯时间戳比较会停在 N-1。
      const located = info.atEnd
        ? { currentStep: this.snapshot.totalSteps, activeMoveIndex: null, moveProgress: 0 }
        : this.locateStep(info.timestamp);
      const { currentStep, activeMoveIndex, moveProgress } = located;
      this.emit({
        timestamp: info.timestamp,
        currentStep,
        activeMoveIndex,
        moveProgress,
        atStart: info.atStart,
        atEnd: info.atEnd,
      });
    };
    this.boundCoarse = (info) => {
      this.emit({ playing: info.playing, atStart: info.atStart, atEnd: info.atEnd });
    };
    detailed.addFreshListener(this.boundDetailed);
    coarse.addFreshListener(this.boundCoarse);
  }

  /**
   * TwistyPlayer 的时间戳类型带编译期标记（MillisecondTimestamp），
   * 这里集中做一次收窄，避免业务代码到处 cast。
   */
  private setTimestamp(milliseconds: number): void {
    const player = this.player;
    if (!player) return;
    player.experimentalModel.timestampRequest.set(milliseconds as never);
  }

  /** 由真实时间戳推导"完成了多少步 / 正在执行哪一步" */
  locateStep(timestamp: number): {
    currentStep: number;
    activeMoveIndex: number | null;
    moveProgress: number;
  } {
    return locateStepFromTimeline(this.snapshot.stepTimes, this.snapshot.totalSteps, timestamp);
  }

  /**
   * 装载公式。返回是否成功。
   * 使用请求序号，快速切换时旧请求的结果不会覆盖最新选择。
   */
  async load(options: LoadOptions): Promise<boolean> {
    if (this.disposed) return false;
    const sequence = ++this.loadSequence;
    this.emit({
      status: 'loading',
      error: null,
      puzzleId: options.puzzleId,
      alg: options.alg,
      setupAlg: options.setupAlg,
      speed: options.speed,
      totalSteps: 0,
      currentStep: 0,
      activeMoveIndex: null,
      moveProgress: 0,
      stepTimes: [0],
      playing: false,
    });

    try {
      const player = await this.ensurePlayer();
      player.pause();

      if (this.currentPuzzleId !== options.puzzleId) {
        this.currentPuzzleId = options.puzzleId;
        player.puzzle = options.puzzleId as never;
      }
      const descriptor = getPuzzleDescriptor(options.puzzleId);
      if (descriptor) {
        this.currentCamera = { ...descriptor.camera };
        player.cameraLatitude = descriptor.camera.latitude;
        player.cameraLongitude = descriptor.camera.longitude;
        player.cameraDistance = descriptor.camera.distance;
      }
      player.hintFacelets = options.showHintFacelets ? 'floating' : 'none';
      player.tempoScale = options.speed;

      const expected = this.normalizeForPlayer(options.alg);
      const setup = this.normalizeForPlayer(options.setupAlg);
      player.experimentalSetupAlg = setup;
      player.alg = expected;
      this.setTimestamp(0);
      // 先清除历史的高亮与进行中状态
      this.emit({ playing: false, atStart: true, atEnd: false });

      const model = player.experimentalModel;
      const indexer = await model.indexer.get();
      if (sequence !== this.loadSequence || this.disposed) return false;

      let renderMode: '3D' | '2D' | 'other' = 'other';
      try {
        const strategy = String(await model.visualizationStrategy.get());
        if (strategy === 'Cube3D' || strategy === 'PG3D') renderMode = '3D';
        else if (strategy.includes('2D')) renderMode = '2D';
      } catch {
        renderMode = 'other';
      }
      if (sequence !== this.loadSequence || this.disposed) return false;

      const totalSteps = indexer.numAnimatedLeaves();
      const stepTimes: number[] = [0];
      for (let k = 0; k < totalSteps; k += 1) {
        // 与官方 <twisty-alg-viewer> 相同的定位公式：第 k 个动作结束的时刻
        const index = k as unknown as Parameters<typeof indexer.indexToMoveStartTimestamp>[0];
        const end = indexer.indexToMoveStartTimestamp(index) + indexer.moveDuration(index);
        stepTimes.push(end);
      }
      // 保证时间轴严格递增，避免定位歧义
      for (let k = 1; k < stepTimes.length; k += 1) {
        if (stepTimes[k] <= stepTimes[k - 1]) stepTimes[k] = stepTimes[k - 1] + 1;
      }

      if (totalSteps !== animatedLeaves(options.alg).length) {
        console.warn(
          '[PlaybackController] 播放器动作数与本项目解析结果不一致',
          totalSteps,
          animatedLeaves(options.alg).length,
        );
      }

      this.setTimestamp(0);
      this.emit({
        status: 'ready',
        totalSteps,
        currentStep: 0,
        stepTimes,
        activeMoveIndex: null,
        moveProgress: 0,
        timestamp: 0,
        renderMode,
        atStart: true,
        atEnd: totalSteps === 0,
        error: totalSteps === 0 ? '该公式在此魔方上没有可执行动作' : null,
      });
      return true;
    } catch (err) {
      if (sequence !== this.loadSequence || this.disposed) return false;
      this.emit({
        status: 'error',
        error: `无法装载三维魔方：${(err as Error).message}`,
      });
      return false;
    }
  }

  /** 把带括号/注释的公式转换为与步骤一一对应的动作序列 */
  private normalizeForPlayer(text: string): string {
    if (!text.trim()) return '';
    const leaves = expandAlgLeaves(text);
    const moves = animatedLeaves(text);
    if (moves.length === leaves.length) return text.trim();
    return moves.map((m) => m.toString()).join(' ');
  }

  play(): void {
    const player = this.player;
    if (!player || this.snapshot.status !== 'ready' || this.snapshot.totalSteps === 0) return;
    if (this.snapshot.currentStep >= this.snapshot.totalSteps) {
      this.seekToStep(0);
    }
    player.play();
    this.emit({ playing: true });
  }

  pause(): void {
    if (!this.player) return;
    this.player.pause();
    this.emit({ playing: false });
  }

  togglePlay(): void {
    if (this.snapshot.playing) this.pause();
    else this.play();
  }

  /** 定位到"前 k 个动作执行完成"的状态（k=0 为初始态，k=N 为播放完成） */
  seekToStep(step: number): void {
    const player = this.player;
    if (!player || this.snapshot.status !== 'ready') return;
    const k = Math.max(0, Math.min(Math.round(step), this.snapshot.totalSteps));
    const timestamp = this.snapshot.stepTimes[k] ?? 0;
    player.pause();
    this.setTimestamp(timestamp);
    this.emit({
      playing: false,
      currentStep: k,
      activeMoveIndex: null,
      moveProgress: 0,
      timestamp,
      atStart: k === 0,
      atEnd: k === this.snapshot.totalSteps,
    });
  }

  nextStep(): void {
    if (this.snapshot.activeMoveIndex === null && this.snapshot.currentStep < this.snapshot.totalSteps) {
      this.seekToStep(this.snapshot.currentStep + 1);
      return;
    }
    this.seekToStep(Math.min(this.snapshot.currentStep + 1, this.snapshot.totalSteps));
  }

  previousStep(): void {
    if (this.snapshot.activeMoveIndex !== null) {
      this.seekToStep(this.snapshot.currentStep);
      return;
    }
    this.seekToStep(Math.max(this.snapshot.currentStep - 1, 0));
  }

  seekToStart(): void {
    const player = this.player;
    if (!player || this.snapshot.status !== 'ready') return;
    player.pause();
    player.jumpToStart({ flash: false });
    this.emit({
      playing: false,
      currentStep: 0,
      activeMoveIndex: null,
      moveProgress: 0,
      timestamp: 0,
      atStart: true,
      atEnd: this.snapshot.totalSteps === 0,
    });
  }

  seekToEnd(): void {
    const player = this.player;
    if (!player || this.snapshot.status !== 'ready') return;
    player.pause();
    player.jumpToEnd({ flash: false });
    this.emit({
      playing: false,
      currentStep: this.snapshot.totalSteps,
      activeMoveIndex: null,
      moveProgress: 0,
      timestamp: this.snapshot.stepTimes[this.snapshot.totalSteps] ?? 0,
      atStart: this.snapshot.totalSteps === 0,
      atEnd: true,
    });
  }

  setSpeed(speed: number): void {
    if (this.player) this.player.tempoScale = speed;
    this.emit({ speed });
  }

  setHintFacelets(show: boolean): void {
    if (this.player) this.player.hintFacelets = show ? 'floating' : 'none';
  }

  async resetCamera(): Promise<void> {
    const player = this.player;
    if (!player) return;
    const descriptor = getPuzzleDescriptor(this.snapshot.puzzleId);
    const camera = this.currentCamera ?? descriptor?.camera;
    if (!camera) return;
    player.cameraLatitude = camera.latitude;
    player.cameraLongitude = camera.longitude;
    player.cameraDistance = camera.distance;
  }

  /** 缩放：距离越小越近。使用引擎的 orbit 坐标 API，不自己写相机数学。 */
  async zoomBy(factor: number): Promise<void> {
    const player = this.player;
    if (!player) return;
    try {
      const model = player.experimentalModel.twistySceneModel as unknown as {
        orbitCoordinates: { get: () => Promise<{ distance: number }> };
        orbitCoordinatesRequest: { set: (v: { distance: number }) => void };
      };
      const current = await model.orbitCoordinates.get();
      const next = Math.min(20, Math.max(1.2, current.distance * factor));
      model.orbitCoordinatesRequest.set({ distance: next });
    } catch (err) {
      console.warn('[PlaybackController] 缩放失败', err);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.loadSequence += 1;
    const player = this.player;
    if (player) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      const model = player.experimentalModel;
      if (this.boundDetailed) {
        try {
          (model.detailedTimelineInfo as unknown as FreshListenerSource<DetailedTimelineInfoValue>).removeFreshListener(
            this.boundDetailed,
          );
        } catch {
          /* ignore */
        }
      }
      if (this.boundCoarse) {
        try {
          (model.coarseTimelineInfo as unknown as FreshListenerSource<CoarseTimelineInfoValue>).removeFreshListener(
            this.boundCoarse,
          );
        } catch {
          /* ignore */
        }
      }
      this.boundDetailed = null;
      this.boundCoarse = null;
      if (player.parentNode) player.parentNode.removeChild(player);
      this.player = null;
      this.playerPromise = null;
    }
    this.listeners.clear();
    this.container = null;
  }
}

/** 浏览器是否真的能创建 WebGL 上下文（用于降级提示） */
export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
