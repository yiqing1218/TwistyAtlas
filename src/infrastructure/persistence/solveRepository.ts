import { db } from './database';
import type { SolveRecord } from '@/domain/model/solve';
import type { Penalty } from '@/domain/timer/stateMachine';

/** 只暴露纯对象，避免 Vue 响应式 Proxy 直接落库（IndexedDB 无法结构化克隆 Proxy） */
function toPlain(record: SolveRecord): SolveRecord {
  return {
    id: record.id,
    sessionId: record.sessionId,
    puzzleId: record.puzzleId,
    scramble: record.scramble,
    elapsedMs: Math.round(record.elapsedMs),
    penalty: record.penalty,
    comment: record.comment ?? '',
    createdAt: record.createdAt,
  };
}

export class SolveRepository {
  async list(sessionId: string, limit = 500): Promise<SolveRecord[]> {
    const rows = await db.solves.where('sessionId').equals(sessionId).toArray();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return limit > 0 ? rows.slice(-limit) : rows;
  }

  async add(record: SolveRecord): Promise<void> {
    await db.solves.put(toPlain(record));
  }

  async updatePenalty(id: string, penalty: Penalty): Promise<void> {
    await db.solves.update(id, { penalty });
  }

  async remove(id: string): Promise<void> {
    await db.solves.delete(id);
  }

  async clear(sessionId: string): Promise<void> {
    await db.solves.where('sessionId').equals(sessionId).delete();
  }

  async count(sessionId: string): Promise<number> {
    return db.solves.where('sessionId').equals(sessionId).count();
  }
}

export const solveRepository = new SolveRepository();
