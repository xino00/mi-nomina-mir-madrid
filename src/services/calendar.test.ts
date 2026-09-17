import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbStore } from '../platform/indexeddb';
import { PayrollRepository, RevisionConflictError } from './repository';
import { CalendarService, calendarSourceId, validateCalendarUrl } from './calendar';
import { buildGradeDates } from '../domain/model';

// URL ficticia; el transporte de esta suite siempre está simulado.
const feedUrl = 'https://calendar.google.com/calendar/ical/example%40group.calendar.google.com/private-secret/basic.ics';
const event = (id: string, date = '20260914', extra = '') => `BEGIN:VEVENT\nUID:${id}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:20260915\nSUMMARY:Guardia Hospital\n${extra}\nEND:VEVENT`;
const feed = (...events: string[]) => `BEGIN:VCALENDAR\nVERSION:2.0\n${events.join('\n')}\nEND:VCALENDAR`;
async function setup() {
  let url: string | null = null, text = feed(event('one')), now = Date.UTC(2026, 8, 16);
  const store = new IndexedDbStore('calendar-test', new IDBFactory());
  const repo = new PayrollRepository(() => store);
  const initial = await repo.load();
  initial.state.settings.profileComplete = true;
  initial.state.settings.centres = [{ id: 'synthetic', name: 'Hospital de pruebas', municipality: 'Getafe', labourHours: 17, festiveHours: 24, aliases: ['hospital'], localHolidays: {} }];
  initial.state.settings.gradeDates = buildGradeDates(initial.state.settings.residencyStart);
  await store.transaction(transaction => transaction.putState({ id: 1, revision: 1, updatedAt: '2026-09-16', payload: JSON.stringify(initial.state) }));
  const secret = { get: async () => url, set: async (value: string) => { url = value; }, clear: async () => { url = null; }, persistent: false };
  const transport = vi.fn(async () => text);
  const service = new CalendarService(repo, secret, transport, () => now);
  return { service, repo, transport, setText: (value: string) => { text = value; }, advance: (value: number) => { now += value; } };
}

describe('calendar service', () => {
  it('allows only the original Google HTTPS feed shape and excludes the secret from source identity', async () => {
    expect(validateCalendarUrl(feedUrl)).toBe(feedUrl);
    for (const url of ['http://calendar.google.com/calendar/ical/a/public/basic.ics', 'https://example.org/calendar.ics', feedUrl + '?token=x', 'https://calendar.google.com@evil.test/calendar.ics', feedUrl + '#fragment']) expect(() => validateCalendarUrl(url)).toThrow();
    expect(await calendarSourceId(feedUrl)).toBe(await calendarSourceId(feedUrl.replace('private-secret', 'private-new-secret')));
  });

  it('connects only after a valid read and leaves the initial import for review', async () => {
    const { service, repo } = await setup();
    const review = await service.connect(feedUrl, 2026);
    expect(review.added).toBe(0);
    expect(review.proposals[0].kind).toBe('new');
    expect((await repo.load()).state.shifts).toEqual([]);
    expect(await service.getStatus()).toMatchObject({ connected: true, persistent: false });
    const saved = await service.commit(review.proposals, review.revision);
    expect(saved.added).toBe(1);
    expect(saved.state.shifts[0].status).toBe('pending');
    expect(await repo.history()).toHaveLength(1);
  });

  it('throttles foreground reads, auto-adds only new pending guards, and preserves modified guards', async () => {
    const { service, repo, transport, advance, setText } = await setup();
    const first = await service.connect(feedUrl, 2026);
    await service.commit(first.proposals, first.revision);
    expect(await service.read(2026)).toBeNull();
    expect(transport).toHaveBeenCalledTimes(1);
    setText(feed(event('one', '20260916'), event('two', '20260917'))); advance(300_000);
    const result = await service.read(2026);
    expect(result?.added).toBe(1);
    expect(result?.proposals.some(proposal => proposal.kind === 'modified')).toBe(true);
    const saved = await repo.load();
    expect(saved.state.shifts.find(shift => shift.sourceKey === 'one')?.date).toBe('2026-09-14');
    expect(saved.state.shifts.find(shift => shift.sourceKey === 'two')?.status).toBe('pending');
    expect(await repo.history()).toHaveLength(2);
  });

  it('keeps cancellations and partial files conservative and rejects stale decisions', async () => {
    const { service, repo, setText } = await setup();
    const initial = await service.connect(feedUrl, 2026);
    await service.commit(initial.proposals, initial.revision);
    expect((await service.importFile(feed(), 2026)).proposals).toEqual([]);
    setText(feed('BEGIN:VEVENT\nUID:one\nSTATUS:CANCELLED\nEND:VEVENT'));
    const review = await service.read(2026, { force: true });
    expect(review?.proposals[0].kind).toBe('cancelled');
    expect((await repo.load()).state.shifts[0].status).toBe('pending');
    const current = await repo.load(); await repo.save(current.state, current.revision);
    await expect(service.commit(review!.proposals, review!.revision)).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it('never persists a URL when the feed is invalid and disconnecting leaves guards unchanged', async () => {
    const { service, repo, setText } = await setup();
    setText('not an ics file');
    await expect(service.connect(feedUrl, 2026)).rejects.toThrow();
    expect((await service.getStatus()).connected).toBe(false);
    setText(feed(event('one')));
    const review = await service.connect(feedUrl, 2026); await service.commit(review.proposals, review.revision);
    await service.disconnect();
    expect((await service.getStatus()).connected).toBe(false);
    expect((await repo.load()).state.shifts).toHaveLength(1);
  });

  it('imports the final year of a five-year residency started in June 2026', async () => {
    const { service, repo } = await setup(), current = await repo.load();
    Object.assign(current.state.settings, { residencyStart: '2026-06-01', residencyEnd: '2031-05-31', gradeDates: buildGradeDates('2026-06-01') });
    await repo.save(current.state, current.revision, 'Perfil de cinco años');
    const text = feed('BEGIN:VEVENT\nUID:last-year\nDTSTART;VALUE=DATE:20310530\nDTEND;VALUE=DATE:20310531\nSUMMARY:Guardia Hospital\nEND:VEVENT');
    const review = await service.importFile(text, 2031);
    expect(review.proposals).toHaveLength(1);
    const saved = await service.commit(review.proposals, review.revision);
    expect(saved.added).toBe(1); expect(saved.state.shifts[0].date).toBe('2031-05-30');
    for (const year of [1999, 2100, 2031.5]) await expect(service.importFile(text, year)).rejects.toThrow(/2000 y 2099/);
  });

  it('imports generic guards and refreshes Torrelodones without centre setup or loss of manual hours', async () => {
    const { service, repo, setText } = await setup(), initial = await repo.load();
    initial.state.settings.centres = [{ ...initial.state.settings.centres[0], id: 'centre-test', name: 'Hospital de prueba', municipality: 'Getafe', aliases: [], localHolidays: {} }];
    await repo.save(initial.state, initial.revision, 'Centro propio');
    const generic = event('generic').replace('Guardia Hospital', 'Guardia');
    setText(feed(generic));
    const review = await service.connect(feedUrl, 2026);
    expect(review.proposals[0]).toMatchObject({ kind: 'new', action: 'add', incoming: { centre: 'unassigned', hours: 17 } });
    const saved = await service.commit(review.proposals, review.revision);
    saved.state.shifts[0] = { ...saved.state.shifts[0], hours: 13, hoursMode: 'custom', status: 'confirmed' };
    await repo.save(saved.state, saved.revision, 'Horas revisadas');
    setText(feed(generic, event('torre', '20260916').replace('Guardia Hospital', 'Guardia Torrelodones')));
    expect((await service.read(2026, { force: true }))?.added).toBe(1);
    const updated = await repo.load();
    expect(updated.state.shifts.find(s => s.sourceKey === 'generic')).toMatchObject({ hours: 13, status: 'confirmed' });
    expect(updated.state.shifts.find(s => s.sourceKey === 'torre')).toMatchObject({ hours: 11, status: 'pending' });
    expect((await service.read(2026, { force: true }))?.added).toBe(0);
    expect((await repo.load()).state.shifts).toHaveLength(2);
  });
});
