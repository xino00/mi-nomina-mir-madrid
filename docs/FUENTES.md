# Fuentes y alcance de las reglas

Revisión de enlaces y publicaciones: **17 de septiembre de 2026**. Esta documentación describe las referencias del cálculo para **médicos internos residentes R1–R5 del SERMAS, Comunidad de Madrid**. Que una tabla oficial comprenda otros colectivos no amplía el alcance de la aplicación.

Las cantidades de referencia son datos públicos. Los importes de prueba que no proceden de esas tablas son sintéticos; no representan una nómina individual.

## Retribuciones: BOCM

| Regla | Publicación y localización | Vigencia de referencia |
|---|---|---|
| Sueldo y complemento de grado R1–R5 | [Orden de 3 de febrero de 2026](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/09/BOCM-20260209-6.PDF), anexo V, 6.1.1; PDF p. 52, impresa 78. | 2026. |
| Guardias iniciales, especiales de 24 h y localizadas | Misma orden, anexo V, 6.2.1; PDF p. 52. | Enero–junio de 2026 para las tarifas ordinarias previas al acuerdo. |
| Guardias desde julio de 2026 | [Acuerdo publicado el 30 de julio de 2026](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/07/30/BOCM-20260730-9.PDF), tabla MIR; PDF p. 4, impresa 52. | Desde julio de 2026. |
| Guardias desde enero de 2027 | Mismo acuerdo, tabla MIR; PDF p. 7, impresa 55. Efectos temporales en apartado 3.º, PDF p. 8. | Actividad desde el 1 de enero de 2027; no actualiza los demás conceptos. |
| Pagas extra y promedio vacacional | Orden de febrero, art. 28; PDF p. 17, impresa 43. | Referencia 2026. |

El sueldo mensual de referencia es 1.387,24 €; los complementos de grado son 138,31 / 249,29 / 388,01 / 526,74 / 665,46 € para R1–R5, respectivamente. Se transcriben de la tabla pública, no de un recibo personal. [BOCM, anexo V.6.1.1](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/09/BOCM-20260209-6.PDF).

La app tarifa las guardias por fecha trabajada y aplica el desfase configurado para prever el cobro. El acuerdo establece el pago a mes vencido. Los especiales posteriores a junio se estiman como el doble de la tarifa festiva: el acuerdo no contiene una columna MIR específica que valide esa extrapolación. [BOCM, acuerdo y vigencias](https://www.bocm.es/boletin/CM_Orden_BOCM/2026/07/30/BOCM-20260730-9.PDF).

## Cotización e IRPF

| Fuente | Uso en la app | Límite |
|---|---|---|
| [BOE: Orden de cotización de 2026](https://www.boe.es/boe/dias/2026/03/31/pdfs/BOE-A-2026-7296.pdf), arts. 2–4, 16–17 y 33 | Bases, contingencias comunes, MEI, solidaridad, desempleo y formación profesional. | Las cifras corresponden a 2026. El tipo de desempleo depende del contrato. |
| [TGSS: control de bases con ajuste mensual](https://www.seg-social.es/descarga/es/Reglas_control_bases_ajuste_mensual) | Referencia para identificar los límites del cálculo en meses parciales. | El motor no implementa una liquidación completa por tramos de alta. |
| [AEAT: retenciones 2026](https://sede.agenciatributaria.gob.es/Sede/Retenciones.shtml) | Escala y parámetros de una estimación básica de IRPF. | Hay algoritmos con vigencia hasta el 9 de septiembre y desde el 10 de septiembre. La app no reproduce todas sus situaciones. |

El modelo de IRPF presupone trabajador activo menor de 65 años, situación familiar 3 y sin descendientes. El mínimo configurado del 15 % presupone la relación especial aplicable; no es un mínimo universal. Para otras situaciones se puede introducir un porcentaje manual obtenido con la herramienta oficial o de la nómina correspondiente.

Android 1.1.0 incorpora además **Renta Madrid 2026**, independiente de las retenciones. Incluye las escalas estatal y madrileña, sus mínimos personales, gastos generales, reducción y deducción por trabajo del perfil básico. El mínimo MIR no se aplica al impuesto anual. Las fuentes legales, vigencias, ejemplos y límites revisados el **20/09/2026** están en [IRPF-MADRID-2026.md](IRPF-MADRID-2026.md).

## Supuestos y pendientes

- **Meses parciales:** el sueldo previsto se prorratea; los límites de cotización siguen siendo mensuales completos. La regla documental de cotización diaria utiliza divisor 30 y días cotizados por tramo, con excepciones. No es equivalente a dividir por los días naturales de cada mes.
- **Vacaciones:** el promedio toma los seis meses anteriores. El divisor de 22 para días sueltos es un supuesto editable que debe contrastarse con el criterio de nóminas.
- **Horarios:** 17/24 h como valores generales y 11 h para Torrelodones laborable son convenciones de configuración de esta app. No se atribuyen al BOCM como jornadas obligatorias para todos los centros. Cercedilla sigue la regla general; cada guardia permite revisión manual.
- **Festivos:** revisar municipio y año. Un calendario local incompleto y los años sin calendario regional contrastado requieren validación manual.
- **2027 y posteriores:** disponer de guardias publicadas para 2027 no verifica el sueldo, la cotización, el IRPF ni los festivos de ese ejercicio. Las previsiones posteriores conservan las últimas referencias incluidas y deben revisarse.
- **Situaciones no automatizadas:** incapacidad temporal, jornada parcial, liquidaciones finales, atrasos complejos y modalidades distintas de la residencia ordinaria requieren ajustes manuales.

Las etiquetas de [src/domain/rules.ts](../src/domain/rules.ts) distinguen parámetros contrastados y estimaciones. «Verificado» se refiere al dato y ámbito documentados, no a una certificación integral de una nómina. Las modificaciones del usuario no adquieren ese estado por editar una tabla.

## Actualizar una referencia

Para proponer un cambio, aporta el enlace oficial, artículo o anexo, fecha de efectos, colectivo y unidades. Cambia conjuntamente valores, metadatos de vigencia y pruebas de las fechas anterior y posterior. No deduzcas una tabla nueva a partir de una nómina personal ni extiendas una tarifa MIR a otro colectivo.
