/** Browser integration runner: serve with Vite and open /tests/pdf-integration.html.
 * Uses the production PDF worker, parser, receipt validation and IndexedDB repository.
 * It never reads or modifies the user's preview/native database.
 */
import { readPdf } from '../src/services/documents';
import { saveReceipt } from '../src/domain/receipt';
import { blankMonth, buildGradeDates } from '../src/domain/model';
import { calculate } from '../src/domain/engine';
import { IndexedDbStore } from '../src/platform/indexeddb';
import { PayrollRepository } from '../src/services/repository';

const element = document.querySelector<HTMLPreElement>('#result')!;
const checks: string[] = [];
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); checks.push(message); };
const fixture = async (name: string) => {
  const response = await fetch(new URL(`./fixtures/${name}`, import.meta.url));
  if (!response.ok) throw new Error(`Fixture no disponible: ${name}`);
  return new File([await response.arrayBuffer()], name, { type: 'application/pdf' });
};
const rejects = async (work: () => Promise<unknown>, expected: RegExp, message: string) => {
  let failure = '';
  try { await work(); } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  assert(expected.test(failure), message);
};
const NativeWorker = window.Worker, workerUrls: string[] = [];
const simulateLegacy = new URLSearchParams(location.search).has('legacy');
const missingFeatures = [[Promise, 'try'], [Promise, 'withResolvers'], [Uint8Array, 'fromBase64'], [Uint8Array.prototype, 'toBase64']] as const;
const originalFeatures = missingFeatures.map(([target, key]) => ({ target, key, descriptor: Object.getOwnPropertyDescriptor(target, key) }));
const workerBlobs: string[] = [];
if (simulateLegacy) for (const [target, key] of missingFeatures) Reflect.deleteProperty(target, key);
window.Worker = class extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) {
    const originalUrl = new URL(url, location.href).href;
    let actualUrl = originalUrl;
    if (simulateLegacy) {
      const script = `delete Promise.try; delete Promise.withResolvers; delete Uint8Array.fromBase64; delete Uint8Array.prototype.toBase64; await import(${JSON.stringify(originalUrl)});`;
      actualUrl = URL.createObjectURL(new Blob([script], { type: 'text/javascript' })); workerBlobs.push(actualUrl);
    }
    super(actualUrl, options); workerUrls.push(originalUrl);
  }
};
const databaseName = `mi-nomina-pdf-test-${crypto.randomUUID()}`;

async function run() {
  if (simulateLegacy) assert(missingFeatures.every(([target, key]) => Reflect.get(target, key) === undefined), 'Inicia sin Promise.try/withResolvers ni base64 de Uint8Array');
  const file = await fixture('nomina-sintetica.pdf'), draft = await readPdf(file);
  if (simulateLegacy) assert(missingFeatures.every(([target, key]) => typeof Reflect.get(target, key) === 'function'), 'La distribución legacy incorpora los cuatro polyfills ausentes');
  assert(draft.gross === 3000 && draft.ss === 200 && draft.withheld === 450, 'Extrae bruto 3000, SS 200 e IRPF 450 del PDF sintético');
  assert(draft.guardGross === 1000 && draft.otherDeductions === 50, 'Separa guardias 1000 y otros descuentos 50');
  assert(draft.net === 2300.01 && draft.paymentMonth === '2026-09', 'Extrae mes septiembre y neto literal 2300,01');
  assert(draft.hash.length === 64 && draft.page === 1, 'Identifica el PDF por SHA-256 y página');
  assert(workerUrls.some(url => new URL(url, location.href).origin === location.origin && url.includes('pdf.worker')), 'Ejecuta el worker PDF.js local del mismo origen');
  const reviewed = { gross: draft.gross, ss: draft.ss, withheld: draft.withheld, guardGross: draft.guardGross, otherDeductions: draft.otherDeductions, net: draft.net, source: 'Recibo sintético revisado' };
  // Simulate a user correcting a field that must not silently reconstruct the liquid amount.
  reviewed.guardGross = 999.99;
  const month = saveReceipt(blankMonth(), reviewed, draft.hash);
  assert(month.actual?.guardGross === 999.99 && month.actual.net === 2300.01, 'La edición conserva el neto PDF y la corrección de guardias');
  const repository = new PayrollRepository(() => new IndexedDbStore(databaseName)), initial = await repository.load();
  initial.state.settings = { ...initial.state.settings, profileComplete: true, residencyStart: '2024-07-01', residencyEnd: '2029-06-30', gradeDates: buildGradeDates('2024-07-01'), centres: [{ id: 'synthetic', name: 'Centro de pruebas', municipality: 'Madrid', labourHours: 17, festiveHours: 24, aliases: [], localHolidays: {} }] };
  initial.state.months['2026-09'] = month;
  const saved = await repository.save(initial.state, initial.revision, 'Prueba PDF sintético');
  const reopened = new PayrollRepository(() => new IndexedDbStore(databaseName)), loaded = await reopened.load();
  assert(loaded.revision === saved.revision && loaded.state.months['2026-09'].actual?.net === 2300.01, 'La recarga desde IndexedDB conserva la revisión y 2300,01');
  assert(calculate(loaded.state, '2026-09').net === 2300.01, 'La nómina calculada respeta el líquido confirmado');
  assert((await reopened.history()).length === 1, 'El guardado crea una versión histórica atómica');
  const serialized = JSON.stringify(loaded.state);
  assert(!serialized.includes('%PDF') && !serialized.includes('PERIODO DE PAGO'), 'El estado guarda importes y hash sin PDF ni texto extraído');
  await rejects(async () => saveReceipt(month, reviewed, draft.hash, 'add'), /ya está/, 'El mismo hash no puede sumarse dos veces');
  await rejects(async () => readPdf(await fixture('dos-recibos.pdf')), /varios recibos/, 'Dos recibos requieren separar los PDF');
  await rejects(async () => readPdf(await fixture('once-paginas.pdf')), /máximo de 10 páginas/, 'Rechaza PDF de más de diez páginas');
  await rejects(() => readPdf(new File([new Uint8Array(15_000_001)], 'grande.pdf')), /supera 15 MB/, 'Rechaza más de 15 MB antes de extraer');
  return { status: 'passed', mode: simulateLegacy ? 'legacy-apis-removed' : 'current-browser', count: checks.length, checks, values: reviewed, hash: draft.hash, workerUrls };
}

run().then(result => {
  element.dataset.status = 'passed'; element.textContent = JSON.stringify(result, null, 2);
}).catch(error => {
  element.dataset.status = 'failed'; element.textContent = JSON.stringify({ status: 'failed', checks, error: error instanceof Error ? error.message : String(error) }, null, 2);
}).finally(() => {
  window.Worker = NativeWorker;
  for (const url of workerBlobs) URL.revokeObjectURL(url);
  if (simulateLegacy) for (const { target, key, descriptor } of originalFeatures) {
    if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key);
  }
  // Deletion completes when this test tab releases its connections on navigation/close.
  indexedDB.deleteDatabase(databaseName);
});
