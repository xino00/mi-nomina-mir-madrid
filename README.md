# Mi nómina · MIR Madrid

Calculadora Android para **médicos internos residentes R1–R5 del Servicio Madrileño de Salud (SERMAS), en la Comunidad de Madrid**. Permite prever la nómina, registrar guardias y contrastar lo estimado con lo cobrado. Funciona sin cuenta y permite calcular y editar sin conexión.

El ámbito actual es la residencia de **Medicina, a jornada completa y en situación ordinaria**. No incluye EIR, FIR, PIR, otras titulaciones, otras comunidades autónomas ni regímenes salariales ajenos al SERMAS. Es un proyecto independiente, sin afiliación oficial al SERMAS, al BOCM o a la AEAT.

## Qué incluye

| Pantalla | Funciones |
|---|---|
| **Nómina** | Previsión mensual, desglose, recibos reales y revisión de PDF. |
| **Guardias** | Registro, importación ICS y conexión opcional con un enlace iCal de Google Calendar. |
| **Año** | Acumulados y previsión anual, pagas extra y vacaciones. |
| **Simular** | Comparación de escenarios y objetivo neto. |
| **Ajustes** | Perfil, fechas R1–R5, centros, horarios, festivos, IRPF, fuentes, copias e historial. |

Las previsiones y los recibos confirmados se conservan por separado: cambiar una tarifa o el IRPF no modifica lo que se registró como cobrado. El neto introducido se mantiene, incluidos otros descuentos y diferencias de redondeo. Se pueden sumar varios recibos por mes; el hash del PDF permite detectar duplicados.

## Empezar a usarla

1. Instala un APK de una procedencia en la que confíes, o compílalo siguiendo [Android](docs/ANDROID.md). Requiere **Android 8 o posterior** y **Android System WebView/Chrome 119 o posterior**.
2. Configura inicio y fin previstos de residencia, fechas de cambio R1–R5, centros y municipio. La app comienza sin nóminas ni guardias personales precargadas.
3. Revisa horarios, festivos, desfase de cobro e IRPF. Los calendarios incompletos requieren revisión; un centro no hereda automáticamente los festivos de Madrid capital.
4. Añade tus guardias o importa un archivo ICS. No es obligatorio que cada evento identifique el hospital. La regla inicial de horas es 17 h laborables y 24 h en fines de semana/festivos, con 11 h en Torrelodones laborable; Cercedilla usa el horario general. **Son ajustes operativos de la app, no una regla horaria universal del BOCM.** Comprueba tu jornada y corrige las horas necesarias; los cambios manuales se conservan.
5. Introduce lo cobrado o importa un PDF y revisa su extracción antes de guardarlo. El lector no hace OCR: los documentos escaneados o no reconocidos permiten entrada manual.
6. Exporta periódicamente una copia JSON desde **Ajustes → Copias e historial**. Hay veinte versiones anteriores recuperables dentro del dispositivo. **Desinstalar elimina los datos locales**; la copia externa permite recuperarlos.

La conexión iCal se consulta al abrir o volver a la app, con intervalo mínimo de cinco minutos, y mediante botón. Necesita internet; su fallo no borra los datos guardados. No hay sincronización entre dispositivos ni actualización en segundo plano garantizada.

## Tablas y límites del cálculo

Las referencias retributivas son las publicaciones del **Boletín Oficial de la Comunidad de Madrid (BOCM)**: [orden de nóminas de 2026](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/09/BOCM-20260209-6.PDF) y [acuerdo de guardias de julio de 2026, que incluye tarifas para enero de 2027](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/07/30/BOCM-20260730-9.PDF). Cotizaciones e IRPF utilizan referencias de BOE, TGSS y AEAT. Consulta [fuentes, vigencias y supuestos](docs/FUENTES.md).

- **2027:** las tarifas ordinarias de guardia están publicadas; sueldo, cotizaciones y fiscalidad siguen usando parámetros de 2026 hasta su actualización.
- **IRPF:** estimación de un perfil básico, con alternativa de porcentaje manual. No reproduce todo el algoritmo oficial ni calcula la declaración de la Renta.
- **Casos especiales:** bajas, jornada parcial y liquidación final requieren ajustes manuales. En meses de inicio o fin parcial se prorratea el sueldo, pero los topes de cotización previstos siguen siendo mensuales.
- **Supuestos editables:** divisor vacacional de 22 y extrapolación de guardias especiales desde julio de 2026. Se identifican como estimaciones.

El repositorio utiliza tablas públicas y datos de prueba sintéticos. No incluye nóminas personales, calendarios privados, enlaces iCal reales ni claves de firma de distribución.

## Privacidad

El cálculo y el almacenamiento son locales: SQLite en Android e IndexedDB en la vista de desarrollo del navegador. No hay cuenta, analítica ni servidor propio; no depende de ChatGPT, Sites ni Cloudflare. Los PDF se procesan localmente y no se conserva su original ni el texto identificativo.

La única conexión opcional de datos es la lectura del calendario de Google que configures. Su enlace se protege con Android Keystore y no se incluye en copias JSON. Las fuentes externas se abren en el navegador al solicitarlas. Las copias JSON/CSV sí contienen los datos que introduzcas: guárdalas como documentos privados. Más detalles en [privacidad](docs/PRIVACIDAD.md).

## Desarrollo

React, TypeScript y Vite; Capacitor 8 para Android; SQLite, PDF.js con worker local y una tipografía incluida en el paquete. **Node 22.13 o posterior** y npm. El empaquetado del ZIP también necesita Python 3. Ejecuta los comandos desde la raíz de este repositorio:

```sh
npm ci
npm run dev
```

La vista de navegador facilita el desarrollo, pero usa un almacenamiento separado y no sustituye la prueba de los selectores de documentos, Keystore o SQLite de Android.

```sh
npm test
npm run build
npm run test:e2e
npm run check:public
```

Las pruebas de navegador usan Chrome en `/usr/bin/google-chrome`; si está instalado en otro lugar, define `NOMINA_CHROME_PATH`. `test:e2e` necesita la compilación de `npm run build`. El worker PDF también puede probarse desde `/tests/pdf-integration.html?legacy=1` con el servidor de desarrollo activo.

Para Android instala **JDK 21, Android SDK Platform 36, Build Tools 35.0.0 y Platform Tools**. Configura `JAVA_HOME` y `ANDROID_HOME`:

```sh
npm run build
npx cap sync android
npm run android:build
```

El último comando genera un APK de depuración. La firma de distribución se configura aparte y permanece fuera del repositorio: [compilación, firma e instalación](docs/ANDROID.md).

## Organización

```text
src/domain/     Cálculo, calendario, reglas, recibos y migración
src/services/   Operaciones locales, documentos e historial
src/platform/   Persistencia Android y navegador
src/           Pantallas y estilos
android/       Proyecto nativo y puente de documentos/Keystore
tests/         Casos sintéticos y recorridos de navegador
scripts/       Compilación y comprobaciones de distribución
docs/          Fuentes, privacidad y documentación Android
```

## Compartir y contribuir

Publica el contenido de esta carpeta como raíz del repositorio. `npm run check:public` revisa patrones sensibles y archivos excluidos; `npm run package:public` prepara un ZIP del código publicable dentro de `releases/`. Revisa también lo que hayas añadido: una comprobación automática no identifica todos los datos personales posibles.

Los pasos para crear el repositorio y subirlo están en [publicar en GitHub](docs/PUBLICAR.md).

Consulta [cómo contribuir](CONTRIBUIR.md) antes de aportar ejemplos o cambios de cálculo. Los resultados ejecutados y las comprobaciones pendientes se recogen en [verificación](docs/VERIFICACION.md). Las pruebas de navegador y el análisis del APK no acreditan por sí solos el funcionamiento en todos los teléfonos.

## Licencia

El código propio se distribuye bajo la [licencia MIT](LICENSE). Permite usar, modificar y distribuir el código, también con fines comerciales, conservando el aviso de autoría y la licencia. El software se ofrece sin garantía, según los términos de la licencia.

Las dependencias mantienen sus licencias; sus avisos están en [third-party-licenses.txt](src/third-party-licenses.txt) y en **Ajustes** dentro de la app. La licencia del código no modifica las condiciones de las publicaciones oficiales citadas como fuentes.
