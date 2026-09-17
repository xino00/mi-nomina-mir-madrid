"""Generate deterministic synthetic payroll PDFs using only Python's standard library.

No personal identifiers and no copied real payslip. Run from any directory.
"""
from pathlib import Path


def receipt_pdf(page_count: int) -> bytes:
    # Separate text objects reproduce the positioned labels/values of a payroll PDF.
    rows = [
        (45, 800, "RECIBO SINTETICO - SOLO PRUEBAS"),
        (45, 760, "PERIODO DE PAGO"),
        (45, 744, "SEPTIEMBRE 2026"),
        (45, 680, "RETENCION I.R.P.F. 450,00"),
        (45, 660, "COTIZ EMPLEADO 200,00"),
        (45, 640, "GUA PRES FIS 1.000,00"),
        (45, 600, "Otros descuentos: 50,00"),
        (45, 500, "TOTAL DEVENGOS"),
        (95, 482, "3.000,00"),
        (240, 500, "TOTAL DESCUENTOS"),
        (300, 482, "700,00"),
        (440, 500, "LIQUIDO"),
        (445, 482, "2.300,01"),
        (45, 400, "Neto con diferencia intencionada de 0,01 para verificar su conservacion."),
    ]
    stream = "\n".join(f"BT /F1 10 Tf {x} {y} Td ({text}) Tj ET" for x, y, text in rows).encode("ascii")
    pages = [4 + i * 2 for i in range(page_count)]
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Count {page_count} /Kids [{' '.join(f'{p} 0 R' for p in pages)}] >>".encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    for page in pages:
        objects += [
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {page + 1} 0 R >>".encode(),
            f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
        ]
    result = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(result)
    result.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        result.extend(f"{offset:010d} 00000 n \n".encode())
    result.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(result)


if __name__ == "__main__":
    folder = Path(__file__).resolve().parent
    for name, count in [("nomina-sintetica.pdf", 1), ("dos-recibos.pdf", 2), ("once-paginas.pdf", 11)]:
        destination = folder / name
        destination.write_bytes(receipt_pdf(count))
        print(f"{destination.name}: {destination.stat().st_size} bytes, {count} page(s)")
