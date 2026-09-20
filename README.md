# Mi nómina · MIR Madrid

Calculadora Android para **médicos internos residentes R1–R5 del Servicio Madrileño de Salud (SERMAS), en la Comunidad de Madrid**. Permite prever la nómina, registrar guardias y contrastar lo estimado con lo cobrado. Funciona sin cuenta y permite calcular y editar sin conexión.

El ámbito actual es la residencia de **Medicina, a jornada completa y en situación ordinaria**. No incluye EIR, FIR, PIR, otras titulaciones, otras comunidades autónomas ni regímenes salariales ajenos al SERMAS. Es un proyecto independiente, sin afiliación oficial al SERMAS, al BOCM o a la AEAT.

## Qué incluye

| Pantalla | Funciones |
|---|---|
| **Nómina** | Previsión mensual, desglose, recibos reales y revisión de PDF. |
| **Guardias** | Registro, importación ICS y conexión opcional con un enlace iCal de Google Calendar. |
| **Año** | Acumulados y previsión anual, pagas extra, vacaciones y estimación independiente de Renta Madrid 2026. |
| **Simular** | Comparación de escenarios y objetivo neto. |
| **Ajustes** | Perfil, fechas R1–R5, centros, horarios, festivos, IRPF, fuentes, copias e historial. |

Las previsiones y los recibos confirmados se conservan por separado: cambiar una tarifa o el IRPF no modifica lo que se registró como cobrado. El neto introducido se mantiene, incluidos otros descuentos y diferencias de redondeo. Se pueden sumar varios recibos por mes; el hash del PDF permite detectar duplicados.

## Empezar a usarla

1. Instala un APK de una procedencia en la que confíes, o compílalo siguiendo [Android](docs/ANDROID.md). Requiere **Android 8 o posterior** y **Android System WebView/Chrome 119 o posterior**.
2. Elige **MFyC · FJD** en **Perfil inicial** o configura tus centros desde cero. Completa inicio y fin de residencia y fechas de cambio R1–R5. La app comienza sin nóminas ni guardias personales precargadas.
3. Revisa horarios, festivos, desfase de cobro e IRPF. Los calendarios incompletos requieren revisión; un centro no hereda automáticamente los festivos de Madrid capital.
4. Añade tus guardias o importa un archivo ICS. No es obligatorio que cada evento identifique el hospital. La regla inicial de horas es 17 h laborables y 24 h en fines de semana/festivos, con 11 h en Torrelodones laborable; Cercedilla usa el horario general. **Son ajustes operativos de la app, no una regla horaria universal del BOCM.** Comprueba tu jornada y corrige las horas necesarias; los cambios manuales se conservan.
5. Introduce lo cobrado o importa un PDF y revisa su extracción antes de guardarlo. El lector no hace OCR: los documentos escaneados o no reconocidos permiten entrada manual.
6. Exporta periódicamente una copia JSON desde **Ajustes → Copias e historial**. Hay veinte versiones anteriores recuperables dentro del dispositivo. **Desinstalar elimina los datos locales**; la copia externa permite recuperarlos.

## Perfiles, calendario y Renta en Android 1.1.0

En **Ajustes → Perfiles de condiciones → Seleccionar o crear perfil** puedes revisar y aplicar MFyC · FJD, duplicarlo, guardar tus condiciones actuales o crear una plantilla propia. FJD configura cuatro años de referencia, cobro un mes después, FJD y Cercedilla a 17/24 h y Torrelodones a 11/24 h. Aplica el calendario de Comunidad y Madrid capital en los tres centros, incluidos 15/05 y 09/11/2026, conservando su municipio físico.

El perfil incluye retención AEAT estimada con mínimo MIR del 15 % y una estimación separada de **Renta Madrid 2026** para asalariado soltero menor de 65 años, sin hijos, discapacidad ni familiares a cargo, declaración individual y solo ingresos laborales. **Año → Renta Madrid** muestra impuesto anual, retenciones registradas y previstas y saldo a ingresar o devolver; ese saldo no cambia el neto de las nóminas. [Fuentes, supuestos y cálculo](docs/IRPF-MADRID-2026.md).

Actualizar la app conserva la configuración existente. Para incorporar estas condiciones, revisa FJD y pulsa **Aplicar perfil**. Se mantienen fechas personales, recibos, acumulados y condiciones de guardias históricas. Los perfiles sin fiscalidad mantienen tus ajustes fiscales actuales.

Las copias **JSON v4** son compatibles con la [WebApp actual](https://xino00.github.io/mi-nomina-mir-madrid/); Android también restaura v1–v3 sin reaplicar FJD. Android 1.0.1 y anteriores no abren v4. El intercambio se realiza mediante archivos, sin sincronización automática. Para actualizar el APK conservando datos, instala encima con la misma firma y no desinstales. [Entrega y validación 1.1.0](docs/ANDROID-1.1.0.md).

## Conectar tus guardias de Google Calendar

**Obtén el enlace desde un PC, abriendo Google Calendar en el navegador.** Después lo conectarás en Mi nómina desde el móvil.

1. En el PC, abre [Google Calendar](https://calendar.google.com/) con la cuenta donde tienes tus guardias.
2. Pulsa la rueda dentada de arriba a la derecha y entra en **Configuración**.
3. En **Configuración de mis calendarios**, a la izquierda, selecciona el calendario de tus guardias.
4. Abre **Integrar el calendario** y copia la **Dirección secreta en formato iCal**. No necesitas hacer público el calendario. Si esa opción no aparece en una cuenta de trabajo o de estudios, puede estar restringida por su administrador. [Ayuda oficial de Google](https://support.google.com/calendar/answer/37648?hl=es).
5. Pasa el enlace a tu móvil por un medio privado. En Mi nómina, abre **Guardias → Calendario → Conectar Google Calendar por enlace** y pégalo en **Dirección secreta iCal**.
6. Pulsa **Conectar y revisar**. Comprueba las fechas, horas y decisiones propuestas; termina con **Guardar decisiones**.

El enlace permite leer ese calendario: trátalo como una contraseña y no lo publiques ni lo incluyas en capturas. Si lo compartes por error, cámbialo desde Google Calendar y vuelve a conectar la app.

Mi nómina solo lee el calendario; no modifica sus eventos. Consulta los cambios al abrir o volver a la app, con un intervalo mínimo de cinco minutos. También puedes pulsar **Leer cambios** en esa misma pantalla. Si falla la conexión, tus datos guardados se conservan. No hay sincronización entre dispositivos ni actualización en segundo plano garantizada.

Si prefieres no conectar un enlace, utiliza **Guardias → Calendario → Importar archivo ICS**. Esta importación es puntual: tendrás que repetirla para incorporar cambios. Si llevas una copia a otro móvil, tendrás que conectar allí el enlace de nuevo; no se incluye en el JSON.

## Tablas y límites del cálculo

Las referencias retributivas son las publicaciones del **Boletín Oficial de la Comunidad de Madrid (BOCM)**: [orden de nóminas de 2026](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/09/BOCM-20260209-6.PDF) y [acuerdo de guardias de julio de 2026, que incluye tarifas para enero de 2027](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/07/30/BOCM-20260730-9.PDF). Cotizaciones e IRPF utilizan referencias de BOE, TGSS y AEAT. Consulta [fuentes, vigencias y supuestos](docs/FUENTES.md).

- **2027:** las tarifas ordinarias de guardia están publicadas; sueldo, cotizaciones y fiscalidad siguen usando parámetros de 2026 hasta su actualización.
- **IRPF:** retención del perfil básico, con alternativa manual, y estimación independiente de Renta Madrid 2026. No cubre todas las circunstancias fiscales ni prepara una declaración; otros ejercicios muestran la Renta como no disponible.
- **Casos especiales:** bajas, jornada parcial y liquidación final requieren ajustes manuales. En meses de inicio o fin parcial se prorratea el sueldo, pero los topes de cotización previstos siguen siendo mensuales.
- **Supuestos editables:** divisor vacacional de 22 y extrapolación de guardias especiales desde julio de 2026. Se identifican como estimaciones.

El repositorio utiliza tablas públicas y datos de prueba sintéticos. No incluye nóminas personales, calendarios privados, enlaces iCal reales ni claves de firma de distribución.

## Privacidad

Los cálculos y los datos se guardan en tu dispositivo. No hay cuenta, analítica ni servidor propio. Los PDF se procesan localmente y no se conserva su original ni el texto identificativo.

La única conexión opcional de datos es la lectura del calendario de Google que configures. Su enlace se protege con Android Keystore y no se incluye en copias JSON. Las fuentes externas se abren en el navegador al solicitarlas. Las copias JSON/CSV sí contienen los datos que introduzcas: guárdalas como documentos privados. Más detalles en [privacidad](docs/PRIVACIDAD.md).

## Ayuda y contribuciones

Para comunicar un fallo o proponer mejoras, consulta [cómo contribuir](CONTRIBUIR.md). Usa ejemplos inventados y evita adjuntar nóminas, calendarios o copias personales.

La documentación técnica está separada: [desarrollo](docs/DESARROLLO.md), [compilación e instalación Android](docs/ANDROID.md), [pruebas realizadas](docs/VERIFICACION.md) y [publicación en GitHub](docs/PUBLICAR.md).

## Licencia

El código propio se distribuye bajo la [licencia MIT](LICENSE). Permite usar, modificar y distribuir el código, también con fines comerciales, conservando el aviso de autoría y la licencia. El software se ofrece sin garantía, según los términos de la licencia.

Las dependencias mantienen sus licencias; sus avisos están en [third-party-licenses.txt](src/third-party-licenses.txt) y en **Ajustes** dentro de la app. La licencia del código no modifica las condiciones de las publicaciones oficiales citadas como fuentes.
