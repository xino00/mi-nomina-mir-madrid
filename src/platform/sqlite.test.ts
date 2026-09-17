import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  version: 0,
  active: false,
  persisted: 'anterior',
  staged: 'anterior',
  failure: false,
  calls: [] as string[],
}));
vi.mock('@capacitor-community/sqlite', () => {
  const database = {
    open: async () => undefined,
    beginTransaction: async () => { if (native.active) throw new Error('Nested transaction'); native.active = true; native.staged = native.persisted; native.calls.push('begin'); },
    commitTransaction: async () => { if (!native.active) throw new Error('No transaction'); native.active = false; native.persisted = native.staged; native.calls.push('commit'); },
    rollbackTransaction: async () => { native.active = false; native.staged = native.persisted; native.calls.push('rollback'); },
    query: async (sql: string) => sql === 'PRAGMA user_version' ? { values: [{ user_version: native.version }] } : { values: [] },
    execute: async (sql: string, transaction: boolean) => {
      if (transaction || !native.active) throw new Error('Schema must join active transaction');
      native.calls.push('schema'); if (sql.includes('PRAGMA user_version = 1')) native.version = 1;
    },
    run: async (_sql: string, values: unknown[], transaction: boolean) => {
      if (transaction || !native.active) throw new Error('Write must join active transaction');
      native.staged = String(values[0]); native.calls.push('write');
      if (native.failure) throw new Error('Disco lleno');
    },
  };
  return {
    CapacitorSQLite: {},
    SQLiteConnection: class {
      checkConnectionsConsistency = async () => ({ result: true });
      isConnection = async () => ({ result: false });
      createConnection = async () => database;
      retrieveConnection = async () => database;
    },
  };
});
import { NativeSqliteStore } from './sqlite';

beforeEach(() => { Object.assign(native, { version: 0, active: false, persisted: 'anterior', staged: 'anterior', failure: false, calls: [] }); });
const row = { id: 1 as const, payload: 'nuevo', revision: 2, updatedAt: '2026-09-16T12:00:00Z' };

describe('Contrato nativo de SQLite', () => {
  it('inicializa user_version y escribe dentro de transacciones sin anidarlas', async () => {
    const store = new NativeSqliteStore();
    await store.transaction(async transaction => { await transaction.putState(row); });
    expect(native.version).toBe(1); expect(native.persisted).toBe('nuevo');
    expect(native.calls).toEqual(['begin', 'schema', 'commit', 'begin', 'write', 'commit']);
  });
  it('no modifica bases de una versión futura', async () => {
    native.version = 2; const work = vi.fn();
    await expect(new NativeSqliteStore().transaction(work)).rejects.toThrow(/compatible/);
    expect(work).not.toHaveBeenCalled(); expect(native.persisted).toBe('anterior');
    expect(native.version).toBe(2); expect(native.calls).toEqual(['begin', 'rollback']);
  });
  it('rollback conserva datos y permite otra operación después del fallo', async () => {
    const store = new NativeSqliteStore(); native.failure = true;
    await expect(store.transaction(transaction => transaction.putState(row))).rejects.toThrow(/Disco lleno/);
    expect(native.persisted).toBe('anterior'); expect(native.active).toBe(false);
    native.failure = false;
    await store.transaction(transaction => transaction.putState(row));
    expect(native.persisted).toBe('nuevo'); expect(native.calls.filter(call => call === 'schema')).toHaveLength(1);
  });
  it('un error de validación posterior a escritura revierte esa escritura', async () => {
    await expect(new NativeSqliteStore().transaction(async transaction => {
      await transaction.putState(row); throw new Error('Estado no válido');
    })).rejects.toThrow(/Estado no válido/);
    expect(native.persisted).toBe('anterior'); expect(native.calls.at(-1)).toBe('rollback');
  });
});
