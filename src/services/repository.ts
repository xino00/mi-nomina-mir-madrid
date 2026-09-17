import { defaultState, stateSchema, type State } from '../domain/model';
import { normalizeShiftHours } from '../domain/engine';
import { isNative } from '../platform/device';
import type { PayrollStore, StateRow, StoreTransaction } from '../platform/store';

export type SavedState = { state: State; revision: number };
export type HistoryEntry = { revision: number; savedAt: string; reason: string };
export class RevisionConflictError extends Error {
  constructor() { super('Los datos han cambiado. Conserva tu borrador, recarga y vuelve a guardar.'); this.name = 'RevisionConflictError'; }
}
export class InvalidStoredStateError extends Error {
  constructor() { super('Los datos guardados no se pueden leer. Se han conservado sin cambios; no se ha reiniciado la aplicación.'); this.name = 'InvalidStoredStateError'; }
}

function parseStored(row: StateRow): SavedState {
  try {
    if (!Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('Invalid revision');
    return { state: normalizeShiftHours(stateSchema.parse(JSON.parse(row.payload))), revision: row.revision };
  } catch { throw new InvalidStoredStateError(); }
}

export class PayrollRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private store?: Promise<PayrollStore>;
  constructor(private readonly createStore: () => PayrollStore | Promise<PayrollStore>, private readonly clock = () => new Date().toISOString()) {}

  private run<T>(work: (transaction: StoreTransaction) => Promise<T>): Promise<T> {
    const operation = this.queue.then(async () => {
      this.store ??= Promise.resolve(this.createStore());
      return (await this.store).transaction(work);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  load(): Promise<SavedState> {
    return this.run(async transaction => {
      const row = await transaction.getState();
      if (row) return parseStored(row);
      const state = stateSchema.parse(defaultState());
      await transaction.putState({ id: 1, payload: JSON.stringify(state), revision: 1, updatedAt: this.clock() });
      return { state, revision: 1 };
    });
  }

  private async write(transaction: StoreTransaction, state: State, expectedRevision: number, reason: string): Promise<SavedState> {
    const row = await transaction.getState();
    if (!row || row.revision !== expectedRevision) throw new RevisionConflictError();
    const current = parseStored(row);
    const next = normalizeShiftHours(stateSchema.parse(state));
    // A restored/imported snapshot cannot make a previously consumed import run again.
    next.appliedCalendarImports = [...new Set([...current.state.appliedCalendarImports, ...next.appliedCalendarImports])];
    stateSchema.parse(next);
    const now = this.clock(), revision = current.revision + 1;
    await transaction.putHistory({ revision: current.revision, payload: row.payload, savedAt: now, reason: reason.slice(0, 120) });
    await transaction.putState({ id: 1, payload: JSON.stringify(next), revision, updatedAt: now });
    await transaction.retainHistory(20);
    return { state: next, revision };
  }

  save(state: State, expectedRevision: number, reason = 'Edición de nómina'): Promise<SavedState> {
    // Capture immediately so later UI changes cannot alter a queued operation.
    const captured = structuredClone(state);
    return this.run(transaction => this.write(transaction, captured, expectedRevision, reason));
  }

  history(): Promise<HistoryEntry[]> {
    return this.run(async transaction => (await transaction.history()).map(({ revision, savedAt, reason }) => ({ revision, savedAt, reason })));
  }

  restore(revision: number, expectedRevision: number): Promise<SavedState> {
    return this.run(async transaction => {
      const historical = await transaction.getHistory(revision);
      if (!historical) throw new Error('Esta versión ya no está disponible.');
      const restored = parseStored({ id: 1, payload: historical.payload, revision: historical.revision, updatedAt: historical.savedAt });
      return this.write(transaction, restored.state, expectedRevision, 'Restauración de versión anterior');
    });
  }
}

export const repository = new PayrollRepository(async () => {
  if (isNative()) {
    const { NativeSqliteStore } = await import('../platform/sqlite');
    return new NativeSqliteStore();
  }
  const { IndexedDbStore } = await import('../platform/indexeddb');
  return new IndexedDbStore();
});
