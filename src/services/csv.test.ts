// Importes sintéticos: no proceden de recibos personales.
import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('CSV export', () => {
  it('neutralizes formula cells in text while keeping actual numeric values numeric', () => {
    for (const text of ['=SUM(A1:A2)', '+cmd', '-cmd', '@cmd', '  =HYPERLINK("x")', '\t=1', '\n=1']) expect(csvCell(text)).toMatch(/^"'/);
    expect(csvCell(-12.5)).toBe('"-12.5"');
    expect(csvCell('Guardia "Hospital"; sábado')).toBe('"Guardia ""Hospital""; sábado"');
  });
  it('uses UTF-8 BOM, semicolons and quoted multiline fields for Spanish spreadsheets', () => {
    expect(toCsv([['Mes', 'Neto'], ['2026-09', 2300.01]])).toBe('\uFEFF"Mes";"Neto"\r\n"2026-09";"2300.01"\r\n');
  });
});
