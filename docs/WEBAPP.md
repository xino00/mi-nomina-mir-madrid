# Mi nómina en el navegador

**[Abrir la WebApp](https://xino00.github.io/mi-nomina-mir-madrid/)**

La WebApp es una alternativa a Android que comparte su motor de cálculo. Permite gestionar nóminas, guardias, previsiones, archivos ICS y PDF, copias JSON e historial desde el navegador, sin cuenta.

## Tus datos

Los datos se guardan en IndexedDB del navegador que utilices. Android, otros navegadores, otros perfiles del navegador y otros dispositivos tienen almacenamientos separados. No existe sincronización automática.

Para trasladar tus registros, exporta **Ajustes → Copias e historial → Guardar copia JSON** y utiliza **Restaurar copia** en el destino. Revisa la copia antes de confirmar: la restauración sustituye los datos actuales del destino y conserva una versión anterior en su historial. El enlace privado de calendario no viaja en el JSON.

Exporta copias periódicas fuera del navegador. Borrar los datos del sitio elimina tus registros y su historial local; evita la navegación privada para conservarlos. Consulta [privacidad](PRIVACIDAD.md).

## Perfiles de condiciones

Un perfil es una plantilla de trabajo; todos comparten tus registros de esta instalación. Selecciona **MFyC · FJD** durante el alta, o abre **Ajustes → Perfiles de condiciones → Seleccionar o crear perfil**. Puedes duplicar una plantilla, guardar las condiciones actuales o empezar desde cero, hasta veinte perfiles propios.

Cada perfil contiene centros, municipios, alias de calendario, festivos locales, horarios generales o propios por centro, retraso de cobro y una duración de residencia de referencia. Esta duración se usa durante el alta; aplicar un perfil a una residencia existente conserva sus fechas efectivas. El IRPF, sueldo, acumulados y recibos se mantienen aparte.

| MFyC · FJD | Laborable | Sábado, domingo o festivo | Festivos locales 2026 |
|---|---|---|---|
| Fundación Jiménez Díaz · Madrid | 17 h | 24 h | 15/05 y 09/11 |
| SAR Cercedilla | 17 h | 24 h | 20/01 y 08/09 |
| SAR Torrelodones | 11 h | 24 h | 16/07 y 14/08 |

Los horarios reproducen la configuración de trabajo indicada por el usuario y son editables; no se presentan como un régimen oficial de FJD. El cobro está configurado con un mes de retraso y la residencia de referencia dura cuatro años. Curas, MED/BOXES y Polis se reconocen como hospital; los alias incluyen FJD, Cerce y Torrelo. Los seis festivos de 2026 están contrastados con el [BOCM del 12/12/2025, páginas PDF 2–3](https://www.bocm.es/boletin/CM_Orden_BOCM/2025/12/12/BOCM-20251212-34.PDF); los demás ejercicios requieren revisión.

**Aplicar perfil** conserva las guardias existentes, sus horas, correcciones manuales y los recibos. Si un centro ya utilizado necesita otras condiciones, se conserva la definición anterior para el histórico y se activa la nueva para futuras entradas. Cambiar el desfase de cobro puede cambiar las previsiones mensuales. Editar o eliminar una plantilla guardada no modifica por sí solo las condiciones aplicadas.

Se mantiene al menos un centro activo. Si un evento coincide con alias de varios centros, la revisión del calendario pide seleccionar el centro antes de añadirlo o actualizarlo; así se aplica su horario y sus festivos locales. Las horas explícitas del archivo ICS se conservan.

Los perfiles propios se incluyen en las **copias JSON de versión 3**. Esta WebApp sigue leyendo las copias anteriores v1 y v2. La app Android anterior, que solo conoce copias v2, **no puede abrir las nuevas copias v3**; necesita una actualización compatible con perfiles. Así se evita que un lector antiguo pierda silenciosamente las plantillas o los horarios propios.

## Sin conexión y actualizaciones

La primera apertura necesita conexión y debe completar la descarga de los recursos. Después, la WebApp puede abrir, calcular, editar e importar archivos sin conexión, incluido el lector PDF. Leer un calendario por enlace y abrir fuentes externas siguen necesitando Internet.

La caché offline contiene los archivos de la aplicación; tus datos se conservan por separado en IndexedDB. Si el navegador elimina esa caché, será necesario abrir la WebApp con conexión para descargarla de nuevo.

Para aplicar una actualización, guarda tus cambios, cierra todas las pestañas de Mi nómina y vuelve a abrirla con conexión. La actualización espera a que dejen de usarse las páginas anteriores y no fuerza una recarga durante la edición.

## Calendario

Recomendamos **Guardias → Calendario → Importar archivo ICS**. La importación permite revisar decisiones antes de guardar y debe repetirse para incorporar cambios posteriores.

El enlace directo de Google Calendar puede estar bloqueado por el navegador por las restricciones de acceso entre sitios (CORS). Si llega a conectarse, solo se conserva en memoria durante esa sesión: recargar o cerrar la página lo elimina. Las guardias ya guardadas permanecen. La WebApp no ofrece la protección del enlace con Android Keystore de la aplicación nativa.

## Desarrollo y GitHub Pages

Esta alternativa se mantiene en la rama `webapp` del mismo repositorio. Comparte `src/domain/` con la versión Android; conserva el nombre existente de la base IndexedDB para mantener los datos guardados anteriormente bajo el mismo origen web.

Con las dependencias instaladas, ejecuta:

```sh
npm test
npm run build
npm run test:e2e
npm run build:web
npm run test:e2e:web
npm run check:public
```

`build:web` genera `dist-web/` con rutas relativas (`--base=./`) para servirla bajo `/mi-nomina-mir-madrid/`, el manifiesto y el service worker. La precarga incluye los recursos compilados y el módulo y worker PDF, aunque no se hayan usado todavía. El service worker no utiliza `skipWaiting`: deja terminar la sesión de la versión anterior antes de activarse.

GitHub Pages utiliza **GitHub Actions** como origen de publicación. El workflow de Pages de esta rama compila y publica `dist-web/`; el directorio generado no se añade al código fuente. La aplicación se sirve en la [URL pública](https://xino00.github.io/mi-nomina-mir-madrid/). Revisa que el despliegue finalice correctamente antes de dar una actualización por publicada.

Las pruebas web deben comprobar la subruta de Pages, conservación de datos, recarga offline y primera importación PDF sin conexión. No acreditan la instalación como aplicación, el funcionamiento en Safari ni la validación de la aplicación Android en un dispositivo físico.

Verificación local del 20 de septiembre de 2026: **89 pruebas unitarias, 13 recorridos generales y 5 pruebas WebApp superadas** en Chrome. Incluyen perfiles, conservación de guardias y recibos, restauración de copias v3 y selección de centros ante alias compartidos. Compilaciones normal y web correctas, y comprobación pública sin patrones privados detectados. Interfaz revisada a 320, 390 y 1280 px, sin desbordamiento horizontal. Las pruebas WebApp también verifican que una actualización conserva el formulario abierto y que se reconstruye una caché eliminada sin perder los datos de IndexedDB. Todos los perfiles y documentos utilizados en las pruebas son sintéticos.
