#!/usr/bin/env python3
"""Check each ELF PT_LOAD alignment in the APK; zip alignment is a separate check."""
import struct
import sys
import zipfile

failed = []
with zipfile.ZipFile(sys.argv[1]) as apk:
    libraries = [name for name in apk.namelist() if name.startswith('lib/') and name.endswith('.so')]
    for name in libraries:
        data = apk.read(name)
        if data[:4] != b'\x7fELF':
            failed.append(name + ': not ELF')
            continue
        order = '<' if data[5] == 1 else '>'
        is64 = data[4] == 2
        phoff = struct.unpack_from(order + ('Q' if is64 else 'I'), data, 32 if is64 else 28)[0]
        size, count = struct.unpack_from(order + 'HH', data, 54 if is64 else 42)
        alignments = []
        for index in range(count):
            start = phoff + index * size
            kind = struct.unpack_from(order + 'I', data, start)[0]
            if kind != 1:
                continue
            alignment = struct.unpack_from(order + ('Q' if is64 else 'I'), data, start + (48 if is64 else 28))[0]
            alignments.append(alignment)
        passed = bool(alignments) and min(alignments) >= 16384
        print(f'{name}: PT_LOAD {alignments} — {"16 KB OK" if passed else "FAIL"}')
        if not passed:
            failed.append(name)
print(f'{len(libraries)} bibliotecas comprobadas. Esta inspección no sustituye ejecutar Android con páginas de 16 KB.')
if failed:
    raise SystemExit('Alineación ELF incompatible: ' + ', '.join(failed))
