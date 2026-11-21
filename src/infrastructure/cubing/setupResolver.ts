import type { SetupMode } from '@/domain/model/formula';
import { invertFormula } from '@/infrastructure/cubing/algService';

export interface ResolvedSetup {
  /** 播放器需要应用的 setupAlg（空字符串表示从复原态开始） */
  setupAlg: string;
  /** 需要播放的公式本体 */
  playAlg: string;
  /** 面向界面的初始状态说明 */
  description: string;
  error?: string;
}

/**
 * 三种初始状态规则（任务书 6.1 / 8.3）：
 * - solved  ：复原态 → 播放 alg
 * - inverse ：alg.invert() 作用于复原态作为初始态 → 再播放 alg
 * - explicit：setupAlg 作用于复原态作为初始态 → 再播放 alg
 *
 * 注意：`inverse` 只是教学上的通用可逆演示，并不等价于"该案例已满足 OLL/PLL 前置条件"。
 */
export function resolveSetup(
  playAlg: string,
  setupMode: SetupMode,
  explicitSetupAlg = '',
): ResolvedSetup {
  const alg = playAlg.trim();
  if (!alg) {
    return { setupAlg: '', playAlg: '', description: '公式为空', error: '公式不能为空' };
  }

  switch (setupMode) {
    case 'solved':
      return {
        setupAlg: '',
        playAlg: alg,
        description: '从复原态开始执行公式',
      };
    case 'inverse': {
      try {
        const inverted = invertFormula(alg);
        return {
          setupAlg: inverted,
          playAlg: alg,
          description: `初始态 = 公式的逆序（${inverted}）`,
        };
      } catch (err) {
        return {
          setupAlg: '',
          playAlg: alg,
          description: '无法计算逆公式',
          error: `无法计算逆公式：${(err as Error).message}`,
        };
      }
    }
    case 'explicit': {
      const setup = explicitSetupAlg.trim();
      if (!setup) {
        return {
          setupAlg: '',
          playAlg: alg,
          description: '未填写 setup 公式，等同于从复原态开始',
          error: '选择"自定义初始状态"时必须填写 setup 公式',
        };
      }
      return {
        setupAlg: setup,
        playAlg: alg,
        description: `初始态 = setup 公式（${setup}）执行后的状态`,
      };
    }
    default:
      return {
        setupAlg: '',
        playAlg: alg,
        description: '未知的初始状态模式',
        error: `未知的初始状态模式：${String(setupMode)}`,
      };
  }
}
