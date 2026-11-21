import { defineStore } from 'pinia';
import {
  INITIAL_SNAPSHOT,
  PlaybackController,
  isWebGLAvailable,
  type PlaybackSnapshot,
} from '@/infrastructure/cubing/playbackController';
import { parseFormulaLocal, type AlgToken } from '@/infrastructure/cubing/algService';
import { resolveSetup } from '@/infrastructure/cubing/setupResolver';
import { getPuzzleDescriptor, isPuzzlePlayable } from '@/infrastructure/cubing/puzzleRegistry';
import type { SetupMode } from '@/domain/model/formula';
import { withBottom } from '@/domain/model/orientation';
import { useSettingsStore } from '@/presentation/stores/settingsStore';

export interface LoadRequest {
  formulaId?: string;
  puzzleId: string;
  title?: string;
  alg: string;
  setupMode: SetupMode;
  setupAlg: string;
}

export interface PlayerTarget {
  formulaId?: string;
  puzzleId: string;
  title: string;
  alg: string;
  setupMode: SetupMode;
  setupAlg: string;
  /** 实际送入播放器的初始状态公式 */
  resolvedSetupAlg: string;
}

/**
 * 播放器控制器持有 WebGL 画布，绝不能放进 Pinia 的深层响应式代理，
 * 因此保存在模块作用域，store 只暴露可序列化的快照。
 */
let controllerInstance: PlaybackController | null = null;

export const usePlayerStore = defineStore('player', {
  state: () => ({
    snapshot: { ...INITIAL_SNAPSHOT } as PlaybackSnapshot,
    tokens: [] as AlgToken[],
    webglAvailable: true,
    attached: false,
    /** 当前装载的公式（容器出现后用于补载） */
    target: null as PlayerTarget | null,
    /** 最近一次加载请求（切换底面时按原请求重载） */
    lastRequest: null as LoadRequest | null,
    loadError: null as string | null,
    loadWarning: null as string | null,
  }),
  getters: {
    totalSteps: (state) => state.snapshot.totalSteps,
    currentStep: (state) => state.snapshot.currentStep,
    playing: (state) => state.snapshot.playing,
    isReady: (state) => state.snapshot.status === 'ready',
    progressPercent(state): number {
      if (state.snapshot.totalSteps === 0) return 0;
      return Math.round((state.snapshot.currentStep / state.snapshot.totalSteps) * 100);
    },
    playable(): boolean {
      return this.target ? isPuzzlePlayable(this.target.puzzleId) : false;
    },
    /** 引擎实际使用的渲染模式（不是由魔方注册表猜的） */
    renderMode(state): '3D' | '2D' | 'other' {
      return state.snapshot.renderMode;
    },
    supportsCustomSetup(): boolean {
      const descriptor = this.target ? getPuzzleDescriptor(this.target.puzzleId) : undefined;
      return descriptor?.supportsCustomSetup ?? true;
    },
  },
  actions: {
    attach(container: HTMLElement) {
      if (this.attached) return;
      this.webglAvailable = isWebGLAvailable();
      if (!this.webglAvailable) {
        this.loadError =
          '当前浏览器无法创建 WebGL 上下文，三维魔方不可用。请更新浏览器或开启硬件加速后重试。';
        return;
      }
      const controller = new PlaybackController(container);
      controller.subscribe((snapshot) => {
        this.snapshot = snapshot;
        if (snapshot.status === 'error' && snapshot.error) this.loadError = snapshot.error;
        else if (snapshot.status === 'ready') this.loadError = null;
      });
      controllerInstance = controller;
      this.attached = true;
      if (this.target) void this.applyTarget(this.target);
    },
    detach() {
      if (controllerInstance) controllerInstance.dispose();
      controllerInstance = null;
      this.attached = false;
      this.snapshot = { ...INITIAL_SNAPSHOT };
    },
    async loadFormula(request: LoadRequest) {
      this.lastRequest = request;
      const settings = useSettingsStore();
      // "以什么当底"：对公式与初始态做同一个共轭，保证终态仍是复原（只是整体转向）
      const bottom = settings.settings.bottomColor;
      const orientedAlg = withBottom(request.alg, bottom);
      const orientedSetup = withBottom(request.setupAlg, bottom);
      const resolved = resolveSetup(orientedAlg, request.setupMode, orientedSetup);
      const target: PlayerTarget = {
        formulaId: request.formulaId,
        puzzleId: request.puzzleId,
        title: request.title ?? '',
        alg: resolved.playAlg,
        setupMode: request.setupMode,
        setupAlg: request.setupAlg,
        resolvedSetupAlg: resolved.setupAlg,
      };
      this.target = target;
      this.loadError = resolved.error ?? null;
      this.loadWarning = null;

      const parsed = parseFormulaLocal(resolved.playAlg);
      this.tokens = parsed.tokens;
      if (!parsed.ok) {
        this.loadError = parsed.error ?? '公式无法解析';
      }
      const descriptor = getPuzzleDescriptor(request.puzzleId);
      if (!isPuzzlePlayable(request.puzzleId)) {
        this.loadWarning = descriptor
          ? `${descriptor.displayNameZh}当前标记为「${descriptor.status}」，暂不支持播放。`
          : `未知魔方类型：${request.puzzleId}`;
      } else if (descriptor?.status === 'ready-2d') {
        this.loadWarning = `${descriptor.displayNameZh}由引擎以二维方式渲染（没有真实形变三维模型），公式与步骤仍然真实执行。`;
      } else if (descriptor?.status === 'experimental') {
        this.loadWarning = `${descriptor.displayNameZh}为实验性支持，三维效果仍在验证。`;
      }
      if (!this.attached) return;
      await this.applyTarget(target);
    },
    async applyTarget(target: PlayerTarget) {
      if (!controllerInstance) return;
      const settings = useSettingsStore();
      await controllerInstance.load({
        puzzleId: target.puzzleId,
        alg: target.alg,
        setupAlg: target.resolvedSetupAlg,
        speed: settings.settings.playbackSpeed,
        showHintFacelets: settings.settings.showHintFacelets,
      });
    },
    /** 换底面后按原请求重载（公式与初始态会重新做共轭） */
    async reload() {
      if (!this.lastRequest) return;
      await this.loadFormula(this.lastRequest);
    },
    play() {
      controllerInstance?.play();
    },
    pause() {
      controllerInstance?.pause();
    },
    togglePlay() {
      controllerInstance?.togglePlay();
    },
    nextStep() {
      controllerInstance?.nextStep();
    },
    previousStep() {
      controllerInstance?.previousStep();
    },
    seekToStep(step: number) {
      controllerInstance?.seekToStep(step);
    },
    seekToStart() {
      controllerInstance?.seekToStart();
    },
    seekToEnd() {
      controllerInstance?.seekToEnd();
    },
    setSpeed(speed: number) {
      controllerInstance?.setSpeed(speed);
      const settings = useSettingsStore();
      void settings.update({ playbackSpeed: speed });
    },
    resetCamera() {
      void controllerInstance?.resetCamera();
    },
    zoomIn() {
      void controllerInstance?.zoomBy(0.85);
    },
    zoomOut() {
      void controllerInstance?.zoomBy(1.18);
    },
    setHintFacelets(show: boolean) {
      controllerInstance?.setHintFacelets(show);
    },
  },
});
