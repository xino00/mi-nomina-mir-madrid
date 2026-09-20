# Mi nómina · MIR Madrid

Calculadora para **médicos internos residentes R1–R5 del Servicio Madrileño de Salud (SERMAS), en la Comunidad de Madrid**. Permite prever la nómina, registrar guardias y contrastar lo estimado con lo cobrado. Esta rama ofrece una **WebApp alternativa a la app Android**, con el mismo motor de cálculo y sin necesidad de cuenta.

**[Abrir Mi nómina WebApp](https://xino00.github.io/mi-nomina-mir-madrid/)** · [Uso web y funcionamiento sin conexión](docs/WEBAPP.md)

Los datos se guardan en el navegador utilizado y no se sincronizan con Android ni con otros dispositivos. Después de una primera carga completa con conexión, la WebApp permite abrir, calcular, editar e importar archivos sin conexión. Conserva una copia JSON externa para trasladar o recuperar tus datos.

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

1. Abre la [WebApp](https://xino00.github.io/mi-nomina-mir-madrid/) con conexión y deja que termine la carga inicial. Para la aplicación nativa, consulta [Android](docs/ANDROID.md).
2. Configura inicio y fin previstos de residencia, fechas de cambio R1–R5, centros y municipio. La app comienza sin nóminas ni guardias personales precargadas.
3. Revisa horarios, festivos, desfase de cobro e IRPF. Los calendarios incompletos requieren revisión; un centro no hereda automáticamente los festivos de Madrid capital.
4. Añade tus guardias o importa un archivo ICS. No es obligatorio que cada evento identifique el hospital. La regla inicial de horas es 17 h laborables y 24 h en fines de semana/festivos, con 11 h en Torrelodones laborable; Cercedilla usa el horario general. **Son ajustes operativos de la app, no una regla horaria universal del BOCM.** Comprueba tu jornada y corrige las horas necesarias; los cambios manuales se conservan.
5. Introduce lo cobrado o importa un PDF y revisa su extracción antes de guardarlo. El lector no hace OCR: los documentos escaneados o no reconocidos permiten entrada manual.
6. Exporta periódicamente una copia JSON desde **Ajustes → Copias e historial**. Hay veinte versiones anteriores recuperables dentro del navegador. **Borrar los datos del sitio elimina tanto los datos como ese historial**; la copia externa permite recuperarlos. Evita usar navegación privada para conservar tus registros.

Para recibir una actualización, guarda los cambios, cierra todas las pestañas de Mi nómina y vuelve a abrirla con conexión. Una versión nueva no fuerza la recarga de un formulario abierto.

## Conectar tus guardias de Google Calendar

**En la WebApp recomendamos importar un archivo ICS** desde **Guardias → Calendario → Importar archivo ICS**. Repite la importación cuando cambie tu calendario. El enlace directo de Google puede ser bloqueado por el navegador por las restricciones de acceso entre sitios (CORS); además, solo se conserva en memoria durante la sesión y se pierde al recargar o cerrar la página.

Si quieres probar la conexión, obtén el enlace desde un PC, abriendo Google Calendar en el navegador:

1. En el PC, abre [Google Calendar](https://calendar.google.com/) con la cuenta donde tienes tus guardias.
2. Pulsa la rueda dentada de arriba a la derecha y entra en **Configuración**.
3. En **Configuración de mis calendarios**, a la izquierda, selecciona el calendario de tus guardias.
4. Abre **Integrar el calendario** y copia la **Dirección secreta en formato iCal**. No necesitas hacer público el calendario. Si esa opción no aparece en una cuenta de trabajo o de estudios, puede estar restringida por su administrador. [Ayuda oficial de Google](https://support.google.com/calendar/answer/37648?hl=es).
5. Pasa el enlace a tu móvil por un medio privado. En Mi nómina, abre **Guardias → Calendario → Conectar Google Calendar por enlace** y pégalo en **Dirección secreta iCal**.
6. Pulsa **Conectar y revisar**. Comprueba las fechas, horas y decisiones propuestas; termina con **Guardar decisiones**.

El enlace permite leer ese calendario: trátalo como una contraseña y no lo publiques ni lo incluyas en capturas. Si lo compartes por error, cámbialo desde Google Calendar y vuelve a conectar la app.

Mi nómina solo lee el calendario; no modifica sus eventos. Mientras haya un enlace conectado, consulta los cambios al abrir o volver a la app, con un intervalo mínimo de cinco minutos. También puedes pulsar **Leer cambios** en esa misma pantalla. Si falla la conexión, tus datos guardados se conservan. No hay sincronización entre dispositivos ni actualización en segundo plano garantizada.

Si prefieres no conectar un enlace, utiliza **Guardias → Calendario → Importar archivo ICS**. Esta importación es puntual: tendrás que repetirla para incorporar cambios. Si llevas una copia a otro móvil, tendrás que conectar allí el enlace de nuevo; no se incluye en el JSON.

## Tablas y límites del cálculo

Las referencias retributivas son las publicaciones del **Boletín Oficial de la Comunidad de Madrid (BOCM)**: [orden de nóminas de 2026](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/09/BOCM-20260209-6.PDF) y [acuerdo de guardias de julio de 2026, que incluye tarifas para enero de 2027](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/07/30/BOCM-20260730-9.PDF). Cotizaciones e IRPF utilizan referencias de BOE, TGSS y AEAT. Consulta [fuentes, vigencias y supuestos](docs/FUENTES.md).

- **2027:** las tarifas ordinarias de guardia están publicadas; sueldo, cotizaciones y fiscalidad siguen usando parámetros de 2026 hasta su actualización.
- **IRPF:** estimación de un perfil básico, con alternativa de porcentaje manual. No reproduce todo el algoritmo oficial ni calcula la declaración de la Renta.
- **Casos especiales:** bajas, jornada parcial y liquidación final requieren ajustes manuales. En meses de inicio o fin parcial se prorratea el sueldo, pero los topes de cotización previstos siguen siendo mensuales.
- **Supuestos editables:** divisor vacacional de 22 y extrapolación de guardias especiales desde julio de 2026. Se identifican como estimaciones.

El repositorio utiliza tablas públicas y datos de prueba sintéticos. No incluye nóminas personales, calendarios privados, enlaces iCal reales ni claves de firma de distribución.

## Privacidad

Los cálculos se realizan en tu dispositivo y los datos web se guardan en IndexedDB del navegador. No hay cuenta, analítica ni servidor propio de datos. GitHub Pages sirve los archivos de la WebApp y recibe las peticiones normales de alojamiento; la aplicación no le envía tus nóminas, guardias ni copias JSON. Los PDF se procesan localmente y no se conserva su original ni el texto identificativo.

La lectura opcional del calendario solicita directamente a Google el enlace que configures. En web solo se conserva durante la sesión; en Android se protege con Android Keystore. No se incluye en copias JSON. Las fuentes externas se abren al solicitarlas. Las copias JSON/CSV sí contienen los datos que introduzcas: guárdalas como documentos privados. Más detalles en [privacidad](docs/PRIVACIDAD.md).

## Ayuda y contribuciones

Para comunicar un fallo o proponer mejoras, consulta [cómo contribuir](CONTRIBUIR.md). Usa ejemplos inventados y evita adjuntar nóminas, calendarios o copias personales.

La documentación técnica está separada: [WebApp y GitHub Pages](docs/WEBAPP.md), [desarrollo](docs/DESARROLLO.md), [compilación e instalación Android](docs/ANDROID.md), [pruebas realizadas](docs/VERIFICACION.md) y [publicación en GitHub](docs/PUBLICAR.md).

## Licencia

El código propio se distribuye bajo la [licencia MIT](LICENSE). Permite usar, modificar y distribuir el código, también con fines comerciales, conservando el aviso de autoría y la licencia. El software se ofrece sin garantía, según los términos de la licencia.

Las dependencias mantienen sus licencias; sus avisos están en [third-party-licenses.txt](src/third-party-licenses.txt) y en **Ajustes** dentro de la app. La licencia del código no modifica las condiciones de las publicaciones oficiales citadas como fuentes.
