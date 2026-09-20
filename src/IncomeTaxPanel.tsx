import type {yearCalculation} from './domain/engine';
import {incomeTaxSources} from './domain/income-tax';
import {Panel,Line,Notice,ExternalLink} from './ui';

export function IncomeTaxPanel({annual}:{annual:ReturnType<typeof yearCalculation>}){
 const tax=annual.incomeTax;
 if(!tax)return null;
 return <div className="income-tax-panel"><Panel title={`Renta Madrid · ${annual.year}`}>
  <p className="muted">Estimación individual: asalariado soltero, sin hijos, menor de 65 años, sin discapacidad ni familiares a cargo. Residente fiscal en Madrid; solo ingresos del trabajo de esta aplicación.</p>
  {!tax.available?<Notice>{tax.reason}</Notice>:annual.accumulationConflict?<Notice>El acumulado no cuadra con los recibos confirmados. Revisa los importes en Ajustes antes de estimar el saldo de la Renta.</Notice>:<>
   <Line label="IRPF anual estimado" value={tax.liability} strong/>
   <Line label="Retenciones registradas (recibos / acumulado)" value={annual.recordedWithholding}/>
   <Line label="Retenciones previstas restantes" value={annual.forecastWithholding}/>
   <Line label="Retenciones totales al cierre" value={tax.withheld}/>
   <Line label={tax.balance<0?'Saldo previsto a devolver':tax.balance>0?'Saldo previsto a ingresar':'Saldo previsto equilibrado'} value={Math.abs(tax.balance)} strong/>
   <p className="muted">Previsión al cierre del año, no devolución confirmada. El saldo no se suma al neto de tus nóminas.</p>
   <details className="rate-table"><summary>Cómo se calcula la Renta</summary>
    <Line label="Bruto anual fiscal" value={tax.gross}/><Line label="Seguridad Social" value={-tax.ss}/>
    <Line label="Gastos generales" value={tax.generalExpenses?-tax.generalExpenses:0}/><Line label="Reducción por trabajo" value={tax.reduction?-tax.reduction:0}/>
    <Line label="Base liquidable general" value={tax.base} strong/>
    <Line label="Mínimo personal estatal" value={tax.stateMinimum}/><Line label="Mínimo personal de Madrid" value={tax.madridMinimum}/>
    <Line label="Cuota estatal tras mínimo" value={tax.stateQuota}/><Line label="Cuota de Madrid tras mínimo" value={tax.madridQuota}/>
    <Line label="Deducción por trabajo (DA 61)" value={tax.employmentDeduction?-tax.employmentDeduction:0}/>
    <p className="muted">Cada mínimo reduce la cuota de su escala. Se incluyen gastos generales y beneficios por trabajo aplicables. Sin movilidad geográfica, otras rentas ni deducciones adicionales como alquiler, donativos o cuotas colegiales. Los ajustes del mínimo para retenciones no cambian estos supuestos de Renta.</p>
   </details>
   {(tax.gross!==annual.gross||tax.ss!==annual.ss)&&<Notice>La Renta utiliza los importes fiscales anuales de Ajustes; difieren de los cobros del resumen. Las retenciones comparadas siguen siendo las registradas y previstas en la aplicación.</Notice>}
   {annual.accumulatedSSIsEstimate&&<Notice>El acumulado no incluye cotizaciones reales: parte de la Seguridad Social es estimada.</Notice>}
   {!!annual.patternMonths&&<p className="muted">{annual.patternMonths} meses utilizan el patrón de guardias y pueden cambiar el resultado.</p>}
  </>}
  <p className="muted">Reglas 2026 contrastadas el 20/09/2026. Estimación básica, no una declaración completa.</p>
  <div className="actions"><ExternalLink href={incomeTaxSources.state}>Normativa estatal</ExternalLink><ExternalLink href={incomeTaxSources.madrid}>Normativa de Madrid</ExternalLink></div>
 </Panel></div>;
}
