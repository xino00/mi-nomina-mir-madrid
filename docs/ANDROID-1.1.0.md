# Android 1.1.0: perfiles, calendario y Renta Madrid

Integración de las funciones de la WebApp de los commits `4f10e89` y `080ae8f`,
validada el 20/09/2026. La variante Android mantiene SQLite, documentos nativos,
Android Keystore y recursos locales incluidos en el APK. No incorpora el service
worker ni la instalación de Pages.

## Actualizar desde 1.0.1

Instala `MiNomina-1.1.0-release.apk` sobre la instalación existente, sin
desinstalarla. Se ha comprobado que el identificador y el certificado coinciden
con el APK de distribución 1.0.1; el código de versión pasa de 2 a 3.
La instalación de este APK de distribución en un teléfono físico sigue pendiente.

| Dato | Valor verificado |
|---|---|
| Identificador | `es.juanarenas.minomina` |
| Versión | `1.1.0` / `versionCode 3` |
| Tamaño | 12.651.319 bytes |
| SHA-256 del APK | `a696882a9b38f5f4528ebe666e1bc40b96d273cadbf60addec7a0b66e622542c` |
| SHA-256 del certificado, igual a 1.0.1 | `6c484867ff526f5b2c6d8ca59a348ba6a7c07f625342794a0bba02af64759c15` |

La actualización no aplica FJD automáticamente. Para incorporar el calendario y
la fiscalidad nuevos, abre **Ajustes → Seleccionar o crear perfil**, revisa las
condiciones y pulsa **Aplicar perfil**. Se conservan las fechas personales,
recibos, acumulados y condiciones de las guardias anteriores. Consulta
[los supuestos y fuentes fiscales](IRPF-MADRID-2026.md).

## Copias e historial

La exportación utiliza JSON v4 y la restauración admite v1–v4. Los campos
opcionales ausentes conservan la configuración anterior; un perfil sin bloque
fiscal no cambia el IRPF actual. Android 1.0.1 y anteriores no abren v4.

La versión del archivo de copia y la versión de SQLite son independientes:
SQLite sigue en versión 1, con las mismas tablas y los nuevos campos dentro de
su estado JSON. El historial conserva los estados anteriores y permite restaurar
configuraciones previas a la integración.

Se compararon copias v4 en ambos sentidos con la WebApp `080ae8f`, utilizando
los mismos cinco escenarios sintéticos de ingresos anuales: 0, 18.000, 30.000,
40.000 y 310.000 €. Los estados restaurados y los resultados anuales coinciden.
La restauración del historial se comprueba además mediante el repositorio y la
interfaz; el JSON exporta el estado actual, no las veinte versiones internas.

## Validación local

- `npm test` → `npm run build` → `npm run test:e2e`: 104 pruebas unitarias y
  17 recorridos de navegador correctos. El total local incluye una comprobación
  previa del servidor que no forma parte de esta integración; Git contiene 16
  recorridos de navegador.
- Seis guardas locales del circuito Android correctas; actualización debug
  mediante `adb install -r`, conservando firma, fecha de primera instalación y
  huella de la base principal de la versión 1.0.1.
- Seis pruebas instrumentadas correctas en `Codex_API_36` / `emulator-5556`:
  recursos y permisos, Keystore, cancelación de documentos, validación de enlaces,
  transacciones SQLite y persistencia de calendario/fiscalidad con historial.
  Las pruebas usan bases temporales separadas. Ninguna prueba omitida.
- Recorrido adicional en el WebView Android: alta FJD, cinco pantallas,
  horarios de los tres centros y los dos festivos locales, duplicación y
  reaplicación de perfiles, Renta y reapertura del estado e historial. Se verificó
  Android sin red activa, con modo avión y Wi-Fi/datos desactivados, usando SQLite
  real en una base temporal. Se restauró la conectividad al terminar.
- Lint debug y release sin errores; 20 avisos sobre herramientas y recursos.
  `testDebugUnitTest` indica `NO-SOURCE`: no se cuenta como una prueba Java pasada.
- Firma del APK, identificador, versiones y coincidencia de recursos con `dist/`
  verificados. `zipalign -c -P 16 4` correcto y las cuatro bibliotecas SQLCipher
  tienen segmentos ELF alineados a 16 KB.

El emulador se ejecutó sin ventana con Lavapipe tras fallar otros renderizadores,
sin borrar ni restablecer su AVD. Los informes, registros y capturas permanecen
locales en `.test-artifacts/`; pueden contener información del dispositivo y no
se incluyen en Git.

Pendiente en teléfono físico: instalación efectiva sobre 1.0.1, documentos
reales, teclado, navegación Atrás, texto ampliado, modo avión y ejecución en un
dispositivo con páginas de memoria de 16 KB. La alineación estática de bibliotecas
no sustituye esa última prueba.

## Publicación

Esta entrega publica únicamente código de integración en `main`. El APK de
distribución y su archivo `.sha256` se generan en `releases/` y se entregan
localmente. No se crea una release pública ni se redespliega GitHub Pages.
