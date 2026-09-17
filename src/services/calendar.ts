import { CapacitorHttp } from '@capacitor/core';
import { applyCalendarDecisions, parseCalendar, reconcileCalendar, type Proposal } from '../domain/calendar';
import { isNative, NominaDevice } from '../platform/device';
import { repository, RevisionConflictError, type PayrollRepository, type SavedState } from './repository';

const maxFeedBytes = 2_000_000;
const minimumInterval = 5 * 60 * 1000;
export type CalendarStatus = { connected: boolean; lastFetched: string | null; persistent: boolean };
export type CalendarRead = SavedState & { proposals: Proposal[]; notes: string[]; importedAt: string; sourceCalendar: string; added: number };
type SecretStore = { get(): Promise<string | null>; set(url: string): Promise<void>; clear(): Promise<void>; persistent: boolean };
let sessionUrl: string | null = null;
const secrets: SecretStore = {
  get: async () => isNative() ? (await NominaDevice.getCalendarSecret()).url : sessionUrl,
  set: async url => { if (isNative()) await NominaDevice.setCalendarSecret({ url }); else sessionUrl = url; },
  clear: async () => { if (isNative()) await NominaDevice.clearCalendarSecret(); else sessionUrl = null; },
  get persistent() { return isNative(); },
};

export function validateCalendarUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Introduce la dirección secreta iCal de Google Calendar.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'calendar.google.com' || url.port || url.username || url.password || !/^\/calendar\/ical\/[^/]+\/(private-[^/]+|public)\/basic\.ics$/.test(url.pathname) || url.search || url.hash) throw new Error('Utiliza la dirección iCal HTTPS de calendar.google.com.');
  return url.href;
}

export async function calendarSourceId(url: string): Promise<string> {
  // Same calendar identifier used by the original web app; the secret is excluded.
  const calendarId = new URL(validateCalendarUrl(url)).pathname.split('/')[3];
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(calendarId));
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}

async function fetchFeed(url: string): Promise<string> {
  const validated = validateCalendarUrl(url);
  if (isNative()) {
    let response;
    try { response = await CapacitorHttp.get({ url: validated, responseType: 'text', connectTimeout: 12000, readTimeout: 12000, disableRedirects: true }); }
    catch { throw new Error('No se pudo leer Google Calendar. Revisa la conexión o importa el archivo .ics.'); }
    if (response.status < 200 || response.status >= 300 || typeof response.data !== 'string') throw new Error('Google Calendar no ha devuelto un calendario válido.');
    if (new TextEncoder().encode(response.data).byteLength > maxFeedBytes) throw new Error('El calendario supera 2 MB.');
    return response.data;
  }
  let response: Response;
  try { response = await fetch(validated, { redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(12000) }); }
  catch { throw new Error('El navegador no permite leer este enlace. Importa el archivo .ics o utiliza la app Android.'); }
  if (!response.ok) throw new Error('Google Calendar no ha devuelto el calendario. Revisa el enlace o importa el archivo .ics.');
  if (Number(response.headers.get('content-length')) > maxFeedBytes) throw new Error('El calendario supera 2 MB.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('El calendario está vacío.');
  const decoder = new TextDecoder(); let bytes = 0, text = '';
  while (true) {
    const part = await reader.read(); if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > maxFeedBytes) { await reader.cancel(); throw new Error('El calendario supera 2 MB.'); }
    text += decoder.decode(part.value, { stream: true });
  }
  return text + decoder.decode();
}

export class CalendarService {
  private lastAttempt = -Infinity;
  private lastFetched: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly repo: Pick<PayrollRepository, 'load' | 'save'> = repository, private readonly secretStore: SecretStore = secrets, private readonly transport = fetchFeed, private readonly clock = () => Date.now()) {}

  private run<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.queue.then(work);
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async getStatus(): Promise<CalendarStatus> {
    return { connected: !!(await this.secretStore.get()), lastFetched: this.lastFetched, persistent: this.secretStore.persistent };
  }

  private async readText(text: string, year: number, sourceCalendar: string, autoAdd: boolean): Promise<CalendarRead> {
    if (!Number.isInteger(year) || year < 2000 || year > 2099) throw new Error('Selecciona un año entre 2000 y 2099.');
    if (new TextEncoder().encode(text).byteLength > maxFeedBytes) throw new Error('El calendario supera 2 MB.');
    let saved = await this.repo.load();
    const parsed = parseCalendar(text, year, saved.state.settings);
    let proposals = reconcileCalendar(saved.state.shifts, parsed, sourceCalendar);
    const importedAt = new Date(this.clock()).toISOString();
    let added = 0;
    if (autoAdd) {
      const additions = proposals.filter(proposal => proposal.kind === 'new' && proposal.action === 'add').map(proposal => ({ ...proposal, incoming: proposal.incoming ? { ...proposal.incoming, status: 'pending' as const } : undefined }));
      if (additions.length) {
        const merged = applyCalendarDecisions(saved.state.shifts, additions);
        saved = await this.repo.save({ ...saved.state, shifts: merged.shifts, importedAt }, saved.revision, 'Nuevas guardias de calendario');
        added = merged.added;
        const ids = new Set(additions.map(proposal => proposal.id));
        proposals = proposals.filter(proposal => !ids.has(proposal.id));
      }
    }
    return { ...saved, proposals, notes: parsed.notes, importedAt, sourceCalendar, added };
  }

  connect(url: string, year: number): Promise<CalendarRead> {
    return this.run(async () => {
      const validated = validateCalendarUrl(url);
      this.lastAttempt = this.clock();
      const text = await this.transport(validated);
      const result = await this.readText(text, year, await calendarSourceId(validated), false);
      await this.secretStore.set(validated);
      this.lastFetched = result.importedAt;
      return result;
    });
  }

  read(year: number, options: { force?: boolean; autoAdd?: boolean } = {}): Promise<CalendarRead | null> {
    return this.run(async () => {
      const url = await this.secretStore.get();
      if (!url || (!options.force && this.clock() - this.lastAttempt < minimumInterval)) return null;
      this.lastAttempt = this.clock();
      const result = await this.readText(await this.transport(validateCalendarUrl(url)), year, await calendarSourceId(url), options.autoAdd ?? true);
      this.lastFetched = result.importedAt;
      return result;
    });
  }

  importFile(text: string, year: number): Promise<CalendarRead> {
    return this.run(() => this.readText(text, year, '', false));
  }

  disconnect(): Promise<void> {
    return this.run(async () => { await this.secretStore.clear(); this.lastFetched = null; this.lastAttempt = -Infinity; });
  }

  commit(proposals: Proposal[], revision: number): Promise<SavedState & { added: number; updated: number; linked: number; excluded: number }> {
    return this.run(async () => {
      const current = await this.repo.load();
      if (current.revision !== revision) throw new RevisionConflictError();
      if (proposals.length > 3000) throw new Error('La importación contiene demasiadas decisiones.');
      const { shifts, ...counts } = applyCalendarDecisions(current.state.shifts, proposals);
      const saved = await this.repo.save({ ...current.state, shifts, importedAt: new Date(this.clock()).toISOString() }, revision, 'Revisión de calendario');
      return { ...saved, ...counts };
    });
  }
}

export const calendarService = new CalendarService();
