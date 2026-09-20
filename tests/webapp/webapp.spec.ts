// Artefactos compilados y datos sintéticos; estas pruebas no utilizan cuentas ni nóminas reales.
import {test, expect, type BrowserContext, type Page} from '@playwright/test';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {fileURLToPath} from 'node:url';

const appBase = 'http://127.0.0.1:4174/mi-nomina-mir-madrid/';
const artifactRoot = new URL('../../dist-web/', import.meta.url);
// Un '/' inicial descartaría la subcarpeta de Pages: usar siempre referencias relativas.
const appUrl = (relative = './') => new URL(relative, appBase).href;
const artifact = (relative: string) => new URL(relative, artifactRoot);
const syntheticPdf = fileURLToPath(new URL('../fixtures/nomina-sintetica.pdf', import.meta.url));

async function selectTab(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('button', {name, exact: true}).click();
}

async function ready(page: Page) {
  await page.goto(appUrl());
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // Una carga posterior ha de estar realmente controlada, aun sin clients.claim().
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(appUrl('sw.js'));
}

async function setup(page: Page) {
  await ready(page);
  await page.getByLabel('Inicio de residencia', {exact: true}).fill('2024-07-01');
  await page.getByLabel('Nombre del centro', {exact: true}).fill('Hospital WebApp sintético');
  await page.getByLabel('Municipio', {exact: true}).fill('Getafe');
  await page.getByRole('button', {name: 'Empezar', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Nómina', exact: true})).toBeVisible();
  await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
}

async function forbidThirdParties(context: BrowserContext) {
  const attempts: string[] = [];
  context.on('request', request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(appBase).origin) attempts.push(request.url());
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return /^https?:$/.test(url.protocol) && url.origin !== new URL(appBase).origin ? route.abort() : route.continue();
  });
  return attempts;
}

async function staticFiles(folder: URL = artifactRoot, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(folder, {withFileTypes: true})) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await staticFiles(new URL(`${entry.name}/`, folder), `${name}/`));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

// La API HTTP conserva ../ crudo, a diferencia de un navegador que normaliza la URL.
function rawStatus(path: string, method = 'GET'): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpRequest({hostname: '127.0.0.1', port: 4174, path, method}, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode ?? 0));
    });
    request.on('error', reject);
    request.end();
  });
}

test('sirve exactamente dist-web en la subcarpeta de Pages y rechaza rutas ajenas', async ({request}) => {
  const html = await readFile(artifact('index.html'), 'utf8');
  const response = await request.get(appUrl());
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.text()).toBe(html);
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]);
  expect(assets.some(name => name.endsWith('.js'))).toBe(true);
  expect(assets).toContain('./manifest.webmanifest');
  for (const name of assets) {
    expect(name, 'Los recursos de HTML deben conservar la base relativa').toMatch(/^\.\//);
    const assetResponse = await request.get(appUrl(name));
    expect(assetResponse.status(), name).toBe(200);
    expect(await assetResponse.body(), name).toEqual(await readFile(artifact(name)));
  }
  const manifest = await (await request.get(appUrl('manifest.webmanifest'))).json();
  expect(new URL(manifest.start_url, appUrl('manifest.webmanifest')).href).toBe(appUrl());
  expect(new URL(manifest.scope, appUrl('manifest.webmanifest')).href).toBe(appUrl());
  const files = await staticFiles();
  const worker = files.find(name => /pdf\.worker.*\.mjs$/.test(name));
  expect(worker, 'El motor de PDF tiene que incluir su worker local').toBeTruthy();
  expect((await request.get(appUrl(worker!))).headers()['content-type']).toContain('javascript');
  expect((await request.get(appUrl('sw.js'))).headers()['content-type']).toContain('javascript');
  const missing = await request.get(appUrl('assets/archivo-inexistente.js'));
  expect(missing.status()).toBe(404);
  expect(await missing.text()).not.toContain('<html');
  for (const path of ['/', '/package.json', '/mi-nomina-mir-madrid/../package.json', '/mi-nomina-mir-madrid/%2e%2e/package.json', '/mi-nomina-mir-madrid/%2e%2e%2fpackage.json', '/mi-nomina-mir-madrid/%5c..%5cpackage.json']) {
    expect(await rawStatus(path), path).toBe(404);
  }
  expect(await rawStatus('/mi-nomina-mir-madrid/%zz')).toBe(400);
  expect(await rawStatus('/mi-nomina-mir-madrid/', 'POST')).toBe(405);
});

test('recarga y reapertura offline conservan los datos, con primera lectura de PDF sin red', async ({page, context}) => {
  const external = await forbidThirdParties(context);
  const errors: string[] = [];
  context.on('page', opened => opened.on('pageerror', error => errors.push(error.message)));
  page.on('pageerror', error => errors.push(error.message));
  await setup(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Nómina', exact: true})).toBeVisible();
  await selectTab(page, 'Ajustes');
  await expect(page.getByLabel('Nombre del centro', {exact: true})).toHaveValue('Hospital WebApp sintético');
  await selectTab(page, 'Nómina');
  await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
  await page.getByRole('button', {name: 'Añadir recibo', exact: true}).click();
  // No se abrió ningún PDF mientras había red: incluye la primera importación dinámica y el worker.
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', {name: 'Leer PDF de nómina', exact: true}).click();
  await (await chooser).setFiles(syntheticPdf);
  await expect(page.getByLabel('Documento 1: Neto recibido (€)', {exact: true})).toHaveValue('2300,01');
  await expect(page.getByLabel('Documento 1: Otros descuentos (€)', {exact: true})).toHaveValue('50');
  await page.getByRole('button', {name: 'Guardar recibo revisado', exact: true}).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('.net-amount')).toContainText('2300,01');
  expect(await page.evaluate(async () => (await indexedDB.databases()).some(database => !!database.name))).toBe(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(appUrl());
  await expect(reopened.getByRole('heading', {name: 'Nómina', exact: true})).toBeVisible();
  await reopened.getByLabel('Mes de cobro seleccionado').fill('2026-09');
  await expect(reopened.locator('.net-amount')).toContainText('2300,01');
  await selectTab(reopened, 'Ajustes');
  await expect(reopened.getByLabel('Nombre del centro', {exact: true})).toHaveValue('Hospital WebApp sintético');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('el service worker almacena solo artefactos locales y no cachea datos o rutas arbitrarias', async ({page, context}) => {
  const external = await forbidThirdParties(context);
  await setup(page);
  const statuses = await page.evaluate(async () => {
    const urls = ['datos-personales.json', 'calendar/private-test/basic.ics'];
    return Promise.all(urls.map(async url => (await fetch(new URL(url, location.href))).status));
  });
  expect(statuses).toEqual([404, 404]);
  const entries = await page.evaluate(async () => {
    const records: {cache: string; url: string; status: number; hash: string}[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (!response) throw new Error(`Falta una respuesta en la caché ${name}`);
        const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        records.push({cache: name, url: request.url, status: response.status, hash});
      }
    }
    return records;
  });
  expect(entries.length).toBeGreaterThan(0);
  const files = new Set(await staticFiles());
  for (const entry of entries) {
    const url = new URL(entry.url);
    expect(url.origin).toBe(new URL(appBase).origin);
    expect(url.pathname.startsWith(new URL(appBase).pathname)).toBe(true);
    expect(url.search).toBe('');
    const filename = decodeURIComponent(url.pathname.slice(new URL(appBase).pathname.length)) || 'index.html';
    expect(files.has(filename), `${entry.cache}: ${filename}`).toBe(true);
    expect(entry.status).toBe(200);
    expect(entry.hash, filename).toBe(createHash('sha256').update(await readFile(artifact(filename))).digest('hex'));
  }
  expect(external).toEqual([]);
});

test('una actualización espera a cerrar la página y conserva el formulario y los datos', async ({page, context}) => {
  const swFile = artifact('sw.js');
  const original = await readFile(swFile, 'utf8');
  const nextVersion = `qa-update-${randomUUID()}`;
  const changed = original.replace(/^const version = .+;$/m, `const version = ${JSON.stringify(nextVersion)};`);
  expect(changed).not.toBe(original);
  try {
    await setup(page);
    await selectTab(page, 'Ajustes');
    await page.getByLabel('Nombre del centro', {exact: true}).fill('Centro conservado tras actualización');
    await page.evaluate(() => { document.documentElement.dataset.qaUpdate = 'pagina-original'; });
    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    // Solo se modifica el resultado generado, nunca el SW fuente; finally restaura los bytes.
    await writeFile(swFile, changed);
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
    await expect(page.getByRole('heading', {name: 'Ajustes', exact: true})).toBeVisible();
    await expect(page.getByLabel('Nombre del centro', {exact: true})).toHaveValue('Centro conservado tras actualización');
    expect(await page.evaluate(() => document.documentElement.dataset.qaUpdate)).toBe('pagina-original');
    expect(navigations).toBe(0);
    // El borrador sigue siendo editable y puede guardarse mientras la actualización espera.
    await page.getByRole('button', {name: 'Guardar ajustes', exact: true}).click();
    await expect(page.getByText('Cambios sin guardar.', {exact: true})).toHaveCount(0);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(appUrl());
    await expect.poll(() => reopened.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {active: registration.active?.state, waiting: !!registration.waiting};
    })).toEqual({active: 'activated', waiting: false});
    await expect.poll(() => reopened.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('mi-nomina-webapp:'))))
      .toEqual([`mi-nomina-webapp:/mi-nomina-mir-madrid/:${nextVersion}`]);
    await selectTab(reopened, 'Ajustes');
    await expect(reopened.getByLabel('Nombre del centro', {exact: true})).toHaveValue('Centro conservado tras actualización');
  } finally {
    try { await context.close(); } finally { await writeFile(swFile, original); }
  }
});

test('recupera los recursos offline tras perder la caché sin perder IndexedDB', async ({page, context}) => {
  const external = await forbidThirdParties(context);
  await setup(page);
  const cachedUrls = () => page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map(request => request.url));
    }
    return urls.sort();
  });
  const expected = await cachedUrls();
  expect(expected.length).toBeGreaterThan(0);
  await page.evaluate(async () => {
    for (const name of await caches.keys()) await caches.delete(name);
  });
  expect(await cachedUrls()).toEqual([]);
  // Simular pérdida del almacenamiento de recursos manteniendo SW y base de datos.
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Nómina', exact: true})).toBeVisible();
  await expect.poll(cachedUrls).toEqual(expected);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Nómina', exact: true})).toBeVisible();
  await selectTab(page, 'Ajustes');
  await expect(page.getByLabel('Nombre del centro', {exact: true})).toHaveValue('Hospital WebApp sintético');
  expect(external).toEqual([]);
});

test('FJD conserva calendario Madrid y Renta en una reapertura sin conexión',async({page,context})=>{
  const external=await forbidThirdParties(context);
  await ready(page);
  await page.getByRole('combobox',{name:'Perfil inicial',exact:true}).selectOption('mfyc-fjd');
  await page.getByLabel('Inicio de residencia',{exact:true}).fill('2025-06-01');
  await page.getByRole('button',{name:'Empezar',exact:true}).click();
  await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
  await selectTab(page,'Año');
  const renta=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Renta Madrid · 2026',exact:true})});
  const before=await renta.locator('.money-line').allTextContents();
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
  await selectTab(page,'Año');
  await expect(renta.locator('.money-line')).toHaveText(before);
  await selectTab(page,'Ajustes');
  for(const name of ['Fundación Jiménez Díaz','SAR Cercedilla','SAR Torrelodones']){
    const centre=page.getByRole('group',{name,exact:true});
    await expect(centre.getByLabel('Municipio del calendario',{exact:true})).toHaveValue('Madrid');
    await expect(centre.getByLabel(/^Festivos locales 2026/)).toHaveValue('2026-05-15\n2026-11-09');
  }
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Guardar copia JSON',exact:true}).click();
  const copy=JSON.parse(await readFile((await(await download).path())!,'utf8'));
  expect(copy.version).toBe(4);expect(copy.state.settings.fiscalPreset).toBe('madrid-single-employee');
  expect(external).toEqual([]);
});
