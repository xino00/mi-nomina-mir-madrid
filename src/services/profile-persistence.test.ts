import {describe, expect, it} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {IndexedDbStore} from '../platform/indexeddb';
import {PayrollRepository} from './repository';
import {blankMonth, buildGradeDates, defaultState, legacyCentres} from '../domain/model';
import {applyWorkProfile, builtinWorkProfiles, profileFromSettings} from '../domain/work-profiles';
import {exportBackup, parseBackup} from '../domain/backup';
import {yearCalculation} from '../domain/engine';

describe('Actualización Android: perfiles, copias e historial', () => {
  it('lee el estado anterior sin aplicar FJD y recupera ambas configuraciones desde el historial', async () => {
    const store = new IndexedDbStore('profile-upgrade-test', new IDBFactory());
    const previous = defaultState();
    Object.assign(previous.settings, {
      profileComplete: true, residencyStart: '2025-06-01', residencyEnd: '2029-05-31',
      gradeDates: buildGradeDates('2025-06-01', 4), centres: structuredClone(legacyCentres),
      taxMode: 'manual', manualTaxPercent: 18, accumulatedThrough: '2026-01',
      accumulatedGross: 3000, accumulatedSS: 200, accumulatedWithheld: 450,
    });
    previous.months['2026-01'] = {...blankMonth(), actual: {
      gross: 3000, ss: 200, withheld: 450, guardGross: 900, otherDeductions: 50,
      net: 2300, source: 'Recibo sintético',
    }};
    const legacy = JSON.parse(JSON.stringify(previous));
    delete legacy.settings.fiscalPreset;
    delete legacy.settings.savedWorkProfiles;
    delete legacy.settings.activeWorkProfileId;
    const original = JSON.stringify(legacy);
    await store.transaction(tx => tx.putState({id: 1, payload: original, revision: 7, updatedAt: '2026-09-01'}));

    const repo = new PayrollRepository(() => store), loaded = await repo.load();
    expect(loaded.state.settings).toMatchObject({taxMode: 'manual', manualTaxPercent: 18, fiscalPreset: null});
    expect(loaded.state.settings.centres).toEqual(legacy.settings.centres);
    expect((await store.transaction(tx => tx.getState()))?.payload).toBe(original);

    const applied = applyWorkProfile(loaded.state, builtinWorkProfiles[0]);
    applied.settings.savedWorkProfiles = [profileFromSettings(applied.settings, 'Perfil sintético', 'synthetic-profile')];
    const saved = await repo.save(applied, loaded.revision, 'Aplicar FJD');
    const reopened = await new PayrollRepository(() => store).load();
    expect(reopened).toEqual(saved);
    const copy = exportBackup(reopened.state);
    expect(JSON.parse(copy).version).toBe(4);
    expect(parseBackup(copy).state).toEqual(reopened.state);
    expect(reopened.state.months).toEqual(loaded.state.months);
    expect(yearCalculation(reopened.state, 2026).recordedWithholding).toBe(450);

    const restored = await repo.restore(loaded.revision, saved.revision);
    expect(restored.state).toEqual(loaded.state);
    const redone = await repo.restore(saved.revision, restored.revision);
    expect(redone.state).toEqual(applied);
    expect(redone.state.settings.savedWorkProfiles[0].fiscalPreset).toBe('madrid-single-employee');
    expect(redone.state.settings.centres.every(c => c.holidayMunicipality === 'Madrid')).toBe(true);
  });
});
