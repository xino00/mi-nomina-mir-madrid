import { NominaDevice, isNative } from '../platform/device';
import { parseReceipt, type TextPiece } from '../domain/receipt';

const decodeBase64 = (text: string) => Uint8Array.from(atob(text), character => character.charCodeAt(0));
function encodeBase64(bytes: Uint8Array): string {
  const pieces: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) pieces.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  return btoa(pieces.join(''));
}

export async function openDocument(mimeTypes: string[]): Promise<File | null> {
  if (isNative()) {
    // Browser accept allows extensions; Android EXTRA_MIME_TYPES only accepts MIME values.
    const extensions: Record<string, string> = { '.json': 'application/json', '.ics': 'text/calendar', '.pdf': 'application/pdf', '.csv': 'text/csv' };
    const nativeTypes = [...new Set(mimeTypes.map(value => extensions[value.toLowerCase()] ?? value).filter(value => value.includes('/') && !/[\s,;]/.test(value)))];
    const result = await NominaDevice.openDocument({ mimeTypes: nativeTypes.length ? nativeTypes : ['*/*'] });
    if (result.cancelled) return null;
    if (typeof result.data !== 'string' || !result.name) throw new Error('No se pudo leer el documento seleccionado.');
    return new File([decodeBase64(result.data)], result.name, { type: result.mimeType ?? 'application/octet-stream' });
  }
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = mimeTypes.join(','); input.style.display = 'none';
    const finish = (file: File | null) => { input.remove(); resolve(file); };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.append(input); input.click();
  });
}

export async function saveDocument(name: string, mimeType: string, data: string | Uint8Array): Promise<void> {
  const safeName = name.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 180) || 'mi-nomina';
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  if (isNative()) {
    await NominaDevice.saveDocument({ name: safeName, mimeType, data: encodeBase64(bytes) });
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const link = document.createElement('a'); link.href = url; link.download = safeName;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** No PDF bytes or extracted text leave this function or enter persistent storage. */
export async function readPdf(file: File) {
  if (file.size > 15_000_000) throw new Error('El PDF supera 15 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  // Legacy includes the Promise/typed-array polyfills needed by supported older WebViews.
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
  try {
    const document = await task.promise;
    if (document.numPages > 10) throw new Error('Importa un recibo por PDF, con un máximo de 10 páginas.');
    const receipts = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber), viewport = page.getViewport({ scale: 1 }), content = await page.getTextContent();
      const pieces: TextPiece[] = content.items.filter((item): item is import('pdfjs-dist/types/src/display/api').TextItem => 'str' in item).map(item => {
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return { text: item.str, x, y, width: item.width };
      });
      const parsed = parseReceipt(pieces);
      if (parsed.gross !== null || parsed.withheld !== null || pageNumber === 1) receipts.push({ ...parsed, page: pageNumber });
    }
    if (receipts.length !== 1) throw new Error('Este PDF contiene varios recibos. Separa las páginas para revisar cada recibo y su mes.');
    return { ...receipts[0], hash, name: file.name };
  } finally { await task.destroy(); }
}
