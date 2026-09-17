import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbStore } from '../platform/indexeddb';
import type { PayrollStore } from '../platform/store';
import { PayrollRepository, InvalidStoredStateError, RevisionConflictError } from './repository';

const make = () => {
  const store = new IndexedDbStore('test-nomina', new IDBFactory());
  return { store, repo: new PayrollRepository(() => store, () => '2026-09-16T12:00:00.000Z') };
};

describe('repository with transactional IndexedDB preview', () => {
  it('starts without personal data and preserves an atomic previous version', async () => {
    const { repo } = make();
    const initial = await repo.load();
    expect(initial.revision).toBe(1);
    expect(initial.state.shifts).toEqual([]);
    expect(initial.state.settings.profileComplete).toBe(false);
    const changed = structuredClone(initial.state); changed.settings.salaryBase = 1500;
    const saved = await repo.save(changed, initial.revision, 'Cambiar sueldo');
    expect(saved.revision).toBe(2);
    expect((await repo.load()).state.settings.salaryBase).toBe(1500);
    expect(await repo.history()).toEqual([{ revision: 1, savedAt: '2026-09-16T12:00:00.000Z', reason: 'Cambiar sueldo' }]);
  });

  it('serializes concurrent drafts and rejects the stale one without a second history row', async () => {
    const { repo } = make(), first = await repo.load();
    const a = structuredClone(first.state), b = structuredClone(first.state);
    a.settings.salaryBase = 1500; b.settings.salaryBase = 1600;
    const results = await Promise.allSettled([repo.save(a, 1, 'Primero'), repo.save(b, 1, 'Obsoleto')]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    if (results[1].status === 'rejected') expect(results[1].reason).toBeInstanceOf(RevisionConflictError);
    expect((await repo.load()).state.settings.salaryBase).toBe(1500);
    expect(await repo.history()).toHaveLength(1);
  });

  it('rejects stale saves across two independent repository instances', async () => {
    const factory = new IDBFactory();
    const a = new PayrollRepository(() => new IndexedDbStore('shared', factory));
    const b = new PayrollRepository(() => new IndexedDbStore('shared', factory));
    const initial = await a.load(); await b.load();
    const results = await Promise.allSettled([a.save(initial.state, 1), b.save(initial.state, 1)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await a.load()).revision).toBe(2);
  });

  it('restoring creates a recoverable version and never resurrects consumed import batches', async () => {
    const { repo } = make(), first = await repo.load();
    const changed = structuredClone(first.state);
    changed.settings.salaryBase = 1500; changed.appliedCalendarImports = ['already-imported'];
    const second = await repo.save(changed, first.revision);
    const restored = await repo.restore(1, second.revision);
    expect(restored.revision).toBe(3);
    expect(restored.state.settings.salaryBase).toBe(first.state.settings.salaryBase);
    expect(restored.state.appliedCalendarImports).toEqual(['already-imported']);
    const undone = await repo.restore(2, restored.revision);
    expect(undone.state.settings.salaryBase).toBe(1500);
    expect(await repo.history()).toHaveLength(3);
  });

  it('retains the newest twenty versions', async () => {
    const { repo } = make(); let saved = await repo.load();
    for (let i = 0; i < 24; i++) saved = await repo.save(saved.state, saved.revision, `Cambio ${i}`);
    const history = await repo.history();
    expect(history).toHaveLength(20);
    expect(history[0].revision).toBe(24);
    expect(history.at(-1)?.revision).toBe(5);
    await expect(repo.restore(1, saved.revision)).rejects.toThrow('ya no está disponible');
  });

  it('rolls back both the new state and the snapshot if storage fails before commit', async () => {
    const { store } = make(); let fail = false;
    const faultStore: PayrollStore = {
      transaction: work => store.transaction(transaction => work({
        ...transaction,
        retainHistory: async limit => { if (fail) throw new Error('Simulated storage failure'); await transaction.retainHistory(limit); },
      })),
    };
    const repo = new PayrollRepository(() => faultStore), initial = await repo.load();
    const changed = structuredClone(initial.state); changed.settings.salaryBase = 999;
    fail = true;
    await expect(repo.save(changed, 1)).rejects.toThrow('Simulated storage failure');
    fail = false;
    expect(await repo.load()).toEqual(initial);
    expect(await repo.history()).toEqual([]);
    expect((await repo.save(changed, 1)).revision).toBe(2);
  });

  it('does not replace corrupted saved data with defaults', async () => {
    const { store, repo } = make(); await repo.load();
    await store.transaction(transaction => transaction.putState({ id: 1, payload: '{broken', revision: 7, updatedAt: '2026-09-16' }));
    await expect(repo.load()).rejects.toBeInstanceOf(InvalidStoredStateError);
    const raw = await store.transaction(transaction => transaction.getState());
    expect(raw?.payload).toBe('{broken');
    expect(raw?.revision).toBe(7);
    expect(await repo.history()).toEqual([]);
  });

  it('rejects invalid input without a partial snapshot and captures queued input by value', async () => {
    const { repo } = make(), initial = await repo.load();
    const invalid = structuredClone(initial.state); invalid.settings.salaryBase = -1;
    await expect(repo.save(invalid, 1)).rejects.toThrow();
    expect(await repo.history()).toEqual([]);
    const changed = structuredClone(initial.state); changed.settings.salaryBase = 1500;
    const pending = repo.save(changed, 1); changed.settings.salaryBase = 999;
    expect((await pending).state.settings.salaryBase).toBe(1500);
  });
});
