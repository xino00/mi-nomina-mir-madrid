# Comprobaciones de la copia pública

Fecha: **17/09/2026**. Versión de código: **1.0.1**. Ámbito: médicos residentes MIR R1–R5 del SERMAS, Comunidad de Madrid.

## Ejecutado en esta copia

| Comprobación | Resultado |
|---|---|
| Instalación independiente con `npm ci` | Correcta, con el archivo de dependencias fijadas. |
| Pruebas de dominio y servicios | **59/59** superadas; casos salariales sintéticos. |
| TypeScript y compilación Vite | Correctos. |
| Recorridos Playwright en Chrome | **6/6** superados sobre la compilación pública. |
| PDF de prueba | Los tres archivos coinciden con el generador sintético incluido. Lectura y conservación del neto comprobadas en el recorrido de navegador. |
| Comprobación de publicación | Sin patrones privados detectados en los archivos seleccionados. Tres casos negativos sintéticos rechazados: archivo forzado al índice, copia de datos y enlace privado de calendario. |
| Sintaxis de scripts y configuración CI | Bash y YAML correctos. |
| Android debug | Compilación correcta con JDK 21, SDK 36 y Build Tools 35.0.0; lint: **0 errores, 20 avisos**. |
| Firma y empaquetado de prueba | Firma debug v2 válida; ZIP y cuatro bibliotecas ELF comprobados para alineación de 16 KB. |
| Pruebas instrumentadas Android | Cinco pruebas compiladas; **no ejecutadas**. |

Los seis recorridos cubren importación de guardias genéricas y horarios 17/11/24 h, reimportación y ajustes manuales; PDF sintético, neto literal y otros descuentos; CSV, JSON, historial y restauración; edición con el navegador sin red; cinco pantallas a 320/390/768 px, teclado y texto ampliado; y protección de cambios sin guardar.

La revisión de contenido y de empaquetado se realiza sobre lo incluido en la copia pública. No se distribuyen inventarios, rutas ni valores procedentes de archivos privados. Los patrones genéricos del comprobador son una ayuda, no una garantía de que cualquier futura aportación esté libre de datos personales.

## Pendiente y alcance de la evidencia

- **GitHub Actions:** configuración preparada; todavía no ejecutada en un repositorio remoto.
- **Teléfono/emulador:** no disponible para esta comprobación. Quedan pendientes primer arranque en modo avión, SQLite real, Keystore, selectores Android, cierre forzado, actualización con la misma firma y funcionamiento con páginas de 16 KB.
- **Calendario real:** las pruebas usan transporte simulado o archivos sintéticos; no acreditan conectividad con una cuenta personal.
- **Firma release:** la copia pública se ha compilado con firma de depuración. Cada distribución debe configurar y verificar su firma externa.

El modo sin red del navegador comprueba operaciones de la app ya cargada; no sustituye el arranque Android sin conexión. Duplicar texto con CSS no sustituye comprobar la escala de fuente y el teclado reales del sistema. Las pruebas del cálculo no equivalen a certificar toda liquidación de nómina: los límites y fuentes se documentan en [FUENTES.md](FUENTES.md).

## Reproducir

```sh
npm ci
npm run check:public
npm test
npm run build
npm run test:e2e
npm run android:build
npm run package:public
```

Consulta [ANDROID.md](ANDROID.md) para configurar el SDK y ejecutar las pruebas instrumentadas en un emulador de prueba.
