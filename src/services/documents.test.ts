import { beforeEach, describe, expect, it, vi } from 'vitest';
const plugin = vi.hoisted(() => ({ openDocument: vi.fn(), saveDocument: vi.fn() }));
vi.mock('../platform/device', () => ({ NominaDevice: plugin, isNative: () => true }));
import { openDocument, readPdf, saveDocument } from './documents';

beforeEach(() => { plugin.openDocument.mockReset(); plugin.saveDocument.mockReset(); });
describe('Puente de documentos nativo', () => {
  it('convierte extensiones accept en MIME de SAF y devuelve el documento binario', async () => {
    plugin.openDocument.mockResolvedValue({ name: 'prueba.json', mimeType: 'application/json', data: 'AAH/' });
    const file = await openDocument(['application/json', '.json', '.ics']);
    expect(plugin.openDocument).toHaveBeenCalledWith({ mimeTypes: ['application/json', 'text/calendar'] });
    expect(file?.name).toBe('prueba.json'); expect(new Uint8Array(await file!.arrayBuffer())).toEqual(new Uint8Array([0, 1, 255]));
  });
  it('distingue cancelación de una respuesta incompleta', async () => {
    plugin.openDocument.mockResolvedValueOnce({ cancelled: true }).mockResolvedValueOnce({ name: 'incompleto.pdf' });
    expect(await openDocument(['application/pdf'])).toBeNull();
    await expect(openDocument(['application/pdf'])).rejects.toThrow(/No se pudo leer/);
  });
  it('exporta UTF-8 sin alterar contenido y sanea solo nombre de destino', async () => {
    plugin.saveDocument.mockResolvedValue({ cancelled: false });
    await saveDocument('carpeta/nómina.json', 'application/json', '{"mes":"año"}');
    const sent = plugin.saveDocument.mock.calls[0][0];
    expect(sent.name).toBe('carpeta_nómina.json');
    expect(new TextDecoder().decode(Uint8Array.from(atob(sent.data), v => v.charCodeAt(0)))).toBe('{"mes":"año"}');
  });
  it('limita PDF antes de cargar PDF.js o transferir datos al worker', async () => {
    await expect(readPdf(new File([new Uint8Array(15_000_001)], 'grande.pdf'))).rejects.toThrow(/supera 15 MB/);
  });
});
