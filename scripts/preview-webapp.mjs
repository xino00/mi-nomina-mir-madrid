import {createReadStream} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// Reproduce una página de proyecto de GitHub Pages sin servir el repositorio.
const root = await realpath(fileURLToPath(new URL('../dist-web/', import.meta.url)));
const prefix = '/mi-nomina-mir-madrid/';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.pdf': 'application/pdf',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
};
const insideRoot = filename => {
  const child = relative(root, filename);
  return child !== '..' && !child.startsWith(`..${sep}`) && !child.startsWith(sep);
};

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const reject = (status, message) => {
    response.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8'});
    response.end(request.method === 'HEAD' ? undefined : message);
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    reject(405, 'Método no permitido.');
    return;
  }
  let pathname;
  try {
    // Validar antes de normalizar: URL eliminaría los segmentos ../ originales.
    pathname = decodeURIComponent((request.url ?? '').split('?')[0]);
  } catch {
    reject(400, 'Ruta no válida.');
    return;
  }
  if (!pathname.startsWith(prefix) || /[\\\u0000-\u001f\u007f]/.test(pathname)
    || pathname.split('/').some(segment => segment === '.' || segment === '..')) {
    reject(404, 'No encontrado.');
    return;
  }
  try {
    const filename = await realpath(resolve(root, pathname.slice(prefix.length) || 'index.html'));
    if (!insideRoot(filename)) { reject(404, 'No encontrado.'); return; }
    const info = await stat(filename);
    if (!info.isFile()) { reject(404, 'No encontrado.'); return; }
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filename).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
    });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(filename);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch {
    reject(404, 'No encontrado.');
  }
});

server.listen(4174, '127.0.0.1', () => {
  process.stdout.write(`WebApp de prueba: http://127.0.0.1:4174${prefix}\n`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
