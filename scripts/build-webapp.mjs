import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile} from 'node:fs/promises';

const output = new URL('../dist-web/', import.meta.url);
const htmlPath = new URL('index.html', output);
const html = await readFile(htmlPath, 'utf8');
await writeFile(htmlPath, html.replace('</head>', '<link rel="manifest" href="./manifest.webmanifest"/></head>'));
await writeFile(new URL('manifest.webmanifest', output), JSON.stringify({
  id: './', name: 'Mi nómina · MIR Madrid', short_name: 'Mi nómina', lang: 'es',
  start_url: './', scope: './', display: 'standalone',
  background_color: '#0B0C0A', theme_color: '#0B0C0A',
  icons: [{src: './favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any'}],
}, null, 2) + '\n');

async function list(folder = '') {
  const entries = await readdir(new URL(folder, output), {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const name = folder + entry.name;
    if (entry.isDirectory()) files.push(...await list(name + '/'));
    else if (entry.isFile() && name !== 'sw.js') files.push(name);
  }
  return files.sort();
}

// Include lazy PDF modules, workers and fonts, not just the initial app shell.
const files = await list();
const template = await readFile(new URL('webapp-sw.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(template);
for (const name of files) hash.update(name).update(await readFile(new URL(name, output)));
const revision = hash.digest('hex').slice(0, 20);
const worker = template.replace('__VERSION__', JSON.stringify(revision)).replace('__FILES__', JSON.stringify(files));
await writeFile(new URL('sw.js', output), worker);
console.log(`WebApp: ${files.length} recursos locales preparados para uso sin conexión (${revision}).`);
