import { describe, expect, it } from 'vitest';
import { locateStepFromTimeline } from '../engine/playbackController';
import { resolveSetup } from '../engine/setupResolver';

describe('resolveSetup：三种初始状态', () => {
  it('solved：不使用 setup，直接播放公式', () => {
    const resolved = resolveSetup("R U R' U'", 'solved');
    expect(resolved.setupAlg).toBe('');
    expect(resolved.playAlg).toBe("R U R' U'");
    expect(resolved.error).toBeUndefined();
  });

  it('inverse：初始态来自公式逆序', () => {
    const resolved = resolveSetup("R U R' U'", 'inverse');
    expect(resolved.setupAlg).toBe("U R U' R'");
    expect(resolved.playAlg).toBe("R U R' U'");
  });

  it('explicit：使用用户提供的 setup', () => {
    const resolved = resolveSetup('R U', 'explicit', "F R U R' U' F'");
    expect(resolved.setupAlg).toBe("F R U R' U' F'");
    expect(resolved.error).toBeUndefined();
  });

  it('explicit 缺少 setup 时报错', () => {
    const resolved = resolveSetup('R U', 'explicit', '   ');
    expect(resolved.error).toBeTruthy();
    expect(resolved.setupAlg).toBe('');
  });

  it('空公式报错', () => {
    expect(resolveSetup('', 'solved').error).toBeTruthy();
  });

  it('inverse 模式不会叠加"终点锚定复原态"的相反操作', () => {
    // 断言只在 setup 上提供逆公式一次，playAlg 保持原公式
    const resolved = resolveSetup('R', 'inverse');
    expect(resolved.setupAlg).toBe("R'");
    expect(resolved.playAlg).toBe('R');
  });
});

describe('locateStepFromTimeline：步骤边界', () => {
  // 4 步，每步 100ms
  const stepTimes = [0, 100, 200, 300, 400];

  it('t=0 表示第 0 步、无动作在执行', () => {
    expect(locateStepFromTimeline(stepTimes, 4, 0)).toEqual({
      currentStep: 0,
      activeMoveIndex: null,
      moveProgress: 0,
    });
  });

  it('动作进行中报告为"正在执行"且不提前计入完成数', () => {
    const location = locateStepFromTimeline(stepTimes, 4, 50);
    expect(location.currentStep).toBe(0);
    expect(location.activeMoveIndex).toBe(0);
    expect(location.moveProgress).toBeCloseTo(0.5, 5);
  });

  it('恰好落在边界时完成数 +1 且无动作执行(不出现半转被标记完成)', () => {
    const location = locateStepFromTimeline(stepTimes, 4, 200);
    expect(location.currentStep).toBe(2);
    expect(location.activeMoveIndex).toBeNull();
  });

  it('终点报告 N/N', () => {
    expect(locateStepFromTimeline(stepTimes, 4, 400).currentStep).toBe(4);
    expect(locateStepFromTimeline(stepTimes, 4, 9999).currentStep).toBe(4);
  });

  it('0 步公式不会崩溃', () => {
    expect(locateStepFromTimeline([0], 0, 0)).toEqual({
      currentStep: 0,
      activeMoveIndex: null,
      moveProgress: 0,
    });
  });

  it('时间戳倒退（跳转回退）也能得到正确步骤', () => {
    expect(locateStepFromTimeline(stepTimes, 4, 120).currentStep).toBe(1);
  });
});
