# Perfil MFyC · FJD: calendario y fiscalidad 2026

Revisado el 20 de septiembre de 2026. Los ejemplos y pruebas utilizan datos ficticios.

## Condiciones y límites

FJD incluye tres centros con su ubicación real, pero aplica en todos el calendario
de Comunidad de Madrid y Madrid capital. Los locales son 15/05 y 09/11/2026.
Esta es la política solicitada para el perfil; no afirma que sea el calendario
oficial de los municipios de Cercedilla o Torrelodones.

La fiscalidad básica supone trabajador activo, soltero, menor de 65 años,
sin hijos, discapacidad ni ascendientes a cargo, residente fiscal en Madrid,
declaración individual y únicamente salarios. No incluye movilidad geográfica,
otras rentas, aportaciones a planes, cuotas colegiales/sindicales ni deducciones
adicionales (alquiler, donativos, etc.). No prepara ni presenta una declaración.

## Fuentes y cálculo

- [Calendario Comunidad y municipios](https://www.comunidad.madrid/empleo/calendario-laboral-comunidad-madrid-municipios).
- [Algoritmo AEAT desde 10/09/2026](https://sede.agenciatributaria.gob.es/static_files/Sede/Programas_ayuda/Retenciones/2026/Algoritmo%20Retenciones-2026_10sept.pdf):
  páginas 22–23, 24 y 30–33 para gastos, reducción, mínimo, escala y límites.
  El cálculo existente `annualTax` es de retenciones, no de Renta. Sus parámetros
  aplicables al perfil básico se mantienen: mínimo personal 5.550 €, escala
  19–47 %, truncamiento del porcentaje a dos decimales y suelo MIR del 15 %.
  La actualización de septiembre trata La Palma, fuera del perfil madrileño.
- [RD 1146/2006, art. 1](https://www.boe.es/buscar/act.php?id=BOE-A-2006-17498#a1):
  relación laboral especial MIR, también en centros privados.
- [Ley 35/2006](https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764):
  arts. 19 y 20 para gastos/reducción; 57 y 63 para mínimo y escala estatal;
  74 para la cuota autonómica; DA 61 con efectos desde 01/01/2026 para deducción
  por trabajo. El importe inicial es 590,89 €, decrece desde 17.094 € de bruto
  hasta 20.048,45 € y no supera la cuota correspondiente al trabajo.
- [Decreto Legislativo Madrid 1/2010](https://www.boe.es/buscar/act.php?id=BOCM-m-2010-90068):
  arts. 1 y 2, cinco tramos del 8,5 al 20,5 % y mínimo personal 5.956,65 €.
  La escala vigente se contrastó también con la [tabla AEAT publicada para 2025](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-general/gravamen-autonomico/comunidad-madrid.html);
  su aplicación a 2026 se basa en el texto legal vigente, no en asumir que el manual de 2025 siga vigente.

`income-tax.ts` calcula Renta separadamente. Descuenta SS, hasta 2.000 € de
gastos generales y reducción por trabajo, sin base negativa. Aplica cada escala
a la base y resta la cuota de su mínimo, después aplica la deducción DA 61.
Usa las cuotas acumuladas publicadas para evitar diferencias de céntimos al
integrar todos los tramos. Redondea importes monetarios a dos decimales.
No aplica el suelo del 15 % ni el límite del 43 % del cálculo de retenciones.

Ejemplos calculados independientemente con aritmética decimal:

| Bruto | SS | Base | Cuota estatal | Cuota Madrid | Deducción trabajo | Impuesto |
|---:|---:|---:|---:|---:|---:|---:|
| 30.000 | 2.000 | 26.000 | 2.455,50 | 2.128,62 | 0 | 4.584,12 |
| 40.000 | 2.600 | 35.400 | 3.872,50 | 3.331,82 | 0 | 7.204,32 |
| 17.094 | 1.100 | 8.690,50 | 298,35 | 232,37 | 530,72 | 0 |
| 18.000 | 1.200 | 10.907 | 508,92 | 420,78 | 409,69 | 520,01 |

El saldo anual resta retenciones registradas y proyectadas; se etiqueta como
previsión al cierre. No se suma al neto cobrado. Los importes fiscales manuales
solo afectan al ejercicio seleccionado, sin inventar cobros. Los acumulados
se concilian con los recibos mediante el motor existente, sin duplicarlos.
Ante un conflicto de acumulados no se muestra un saldo de Renta. Otros años
sin reglas verificadas y entradas fiscales incoherentes no ofrecen una cifra.

## Compatibilidad y aplicación

Copias v4: incluyen `holidayMunicipality` opcional y `fiscalPreset` opcional
en plantillas / nullable en ajustes. Ausencia de calendario independiente usa
el municipio del centro. Perfiles sin bloque fiscal mantienen el IRPF actual.
Se leen copias v1–v3; las apps antiguas rechazan v4 para no perder campos.

La actualización no reaplica FJD sola. En Ajustes → Seleccionar o crear perfil,
revisar MFyC · FJD y pulsar Aplicar perfil. Los centros usados por guardias
previas se conservan con sus calendarios y horarios; las nuevas guardias usan
los centros activos. Se mantienen fechas personales, recibos, acumulados,
importes anuales y porcentajes manuales, aunque aplicar FJD activa el modo
estimado. Los perfiles duplicados copian el bloque fiscal y se puede quitar.

Validación: pruebas de umbrales, ejemplos independientes, cuotas bajas y cero,
retención MIR, acumulados, migración, calendarios, historial y recorridos de UI.
La verificación matemática no equivale a validar fiscalmente una declaración
personal ni a conocer circunstancias no incluidas en la aplicación.
