import { blankMonth, type State, type Settings, type Shift } from './model';
import { detectShiftTitle } from './shift-names';
export const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const eur=(n:number)=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n);
export const monthName=(s:string)=>new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'-15T12:00:00Z'));
export const shortDate=(s:string)=>s.split('-').reverse().join('/');
export function addMonth(s:string,n:number){const [y,m]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,15)).toISOString().slice(0,7);}
const daysIn=(m:string)=>new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate();
export function gradeOn(date:string,s:Settings){
 if(!s.profileComplete||date<s.residencyStart||(s.residencyEnd&&date>s.residencyEnd))return 0;
 const effective=[...s.gradeDates].filter(g=>g.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
 return effective?.grade??0;
}
export function fixedAt(date:string,s:Settings){const grade=gradeOn(date,s);return grade?s.salaryBase+s.complements[grade-1]:0;}
export function fixedFor(month:string,s:Settings){let total=0;const days=daysIn(month);for(let d=1;d<=days;d++)total+=fixedAt(`${month}-${String(d).padStart(2,'0')}`,s);return round(total/days);}
export function extraFor(month:string,s:Settings){const m=Number(month.slice(5));if((m!==6&&m!==12)||!s.profileComplete||month<s.residencyStart.slice(0,7)||(s.residencyEnd&&month>s.residencyEnd.slice(0,7)))return 0;let total=0,days=0;for(let k=-6;k<0;k++){const x=addMonth(month,k);for(let d=1;d<=daysIn(x);d++){total+=fixedAt(`${x}-${String(d).padStart(2,'0')}`,s);days++;}}return round(total/days);}
export { normalizedShiftTitle, detectShiftTitle, shiftCentreLabel, isGuardEventTitle } from './shift-names';
// Official 2026 regional and local calendars; other years remain provisional.
const regional2026=['01-01','01-06','04-02','04-03','05-01','05-02','08-15','10-12','11-02','12-07','12-08','12-25'];
export function classifyShiftDay(date:string,centre:string,s?:Settings):{type:Shift['type'];reason:string;needsReview:boolean}{
 const md=date.slice(5),year=date.slice(0,4),day=new Date(date+'T12:00:00Z').getUTCDay();
 const configured=s?.centres.find(c=>c.id===centre);
 const dates=configured?.localHolidays[year];
 const needsReview=year!=='2026'||!configured||!dates?.length;
 const review=needsReview?' Calendario municipal incompleto: revisa el tipo de guardia.':'';
 if(['01-01','01-06','12-24','12-25','12-31'].includes(md))return {type:'special',reason:'Fecha propuesta como festivo especial; revisa la tarifa.'+review,needsReview:true};
 if(dates?.includes(date))return {type:'festive',reason:`Festivo local de ${configured!.municipality} (${year}).`+review,needsReview};
 if(year==='2026'&&regional2026.includes(md))return {type:'festive',reason:'Festivo de la Comunidad de Madrid (2026).'+review,needsReview};
 if(day===0||day===6)return {type:'festive',reason:(day===6?'Sábado.':'Domingo.')+review,needsReview};
 return {type:'labour',reason:'Día entre semana.'+review,needsReview};
}
export function suggestedType(date:string,centre:string,s?:Settings):Shift['type']{return classifyShiftDay(date,centre,s).type;}
export function standardShiftHours(centre:Shift['centre'],type:Shift['type'],s:Settings,title=''){
 const configured=s.centres.find(c=>c.id===centre);
 if(configured?.scheduleMode==='custom')return type==='labour'?configured.labourHours:configured.festiveHours;
 const named=detectShiftTitle(title),selected=detectShiftTitle(configured?.name??centre);
 const torrelodones=(!named.ambiguous&&named.centre==='SAR Torrelodones')||(!selected.ambiguous&&selected.centre==='SAR Torrelodones');
 // The only timetable exception is Torrelodones on working days. Centre
 // identity remains optional and is still used independently for local holidays.
 return type==='labour'?(torrelodones?11:s.defaultLabourHours):s.defaultFestiveHours;
}
export function resolveShiftHours(shift:Shift,s:Settings):Shift{
 if(shift.hoursMode==='custom')return shift;
 const standard=standardShiftHours(shift.centre,shift.type,s,shift.title);
 if(shift.hoursMode==='standard')return {...shift,hours:standard};
 // Upgrade untouched, pending all-day proposals from the first importer.
 // Confirmed/manual differences and explicit event times keep their hours.
 const oldHours=shift.type==='labour'?(shift.centre.startsWith('SAR')?11:s.defaultLabourHours):s.defaultFestiveHours;
 const untouched=shift.status==='pending'&&!!shift.sourceKey&&shift.sourceSignature.endsWith('|day')&&shift.sourceNote.startsWith('Día completo: horas propuestas.')&&shift.hours===oldHours&&shift.type===suggestedType(shift.date,shift.centre,s);
 const useStandard=untouched||(shift.hours===standard&&!shift.sourceNote.startsWith('Horas calculadas del horario'));
 return {...shift,hours:useStandard?standard:shift.hours,hoursMode:useStandard?'standard':'custom'};
}
export function normalizeShiftHours(state:State):State{return {...state,shifts:state.shifts.map(shift=>resolveShiftHours(shift,state.settings))};}
export function updateShiftSchedule(shift:Shift,patch:Partial<Pick<Shift,'date'|'centre'|'type'>>,s:Settings):Shift{
 const next={...resolveShiftHours(shift,s),...patch};
 const validDate=/^20\d{2}-\d{2}-\d{2}$/.test(next.date)&&Number.isFinite(new Date(next.date+'T12:00:00Z').valueOf());
 // Retain an explicitly selected local holiday when only the centre changes.
 if(validDate&&patch.type===undefined&&(patch.date!==undefined||(patch.centre!==undefined&&shift.type===suggestedType(shift.date,shift.centre,s))))next.type=suggestedType(next.date,next.centre,s);
 return next.hoursMode==='standard'?{...next,hours:standardShiftHours(next.centre,next.type,s,next.title)}:next;
}
export function rateTable(date:string,s:Settings){const next=[...(s.rateVigencies??[])].filter(v=>v.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];return next?.rates??(date>=s.rateChangeDate?s.ratesAfter:s.ratesBefore);}
export function rateFor(shift:Shift,s:Settings){if(shift.customRate!==null)return shift.customRate;const grade=shift.gradeOverride??gradeOn(shift.date,s);if(!grade)return 0;const table=rateTable(shift.date,s);return table[grade-1][shift.type]*(shift.located?.5:1);}
export function shiftGross(shift:Shift,s:Settings){return round(shift.hours*rateFor(shift,s));}
export function guardMonth(state:State,workedMonth:string,pattern=false){
 const s=state.settings;const all=state.shifts.filter(x=>x.date.startsWith(workedMonth));
 const counted=all.filter(x=>x.status==='confirmed'||(s.includePending&&x.status==='pending'));
 const pending=all.filter(x=>x.status==='pending').length;
 const override=state.months[addMonth(workedMonth,s.payDelay)]?.guardGrossOverride;
 if(override!==null&&override!==undefined)return {gross:override,hours:counted.reduce((a,b)=>a+b.hours,0),count:counted.length,pending,source:'manual' as const,items:counted};
 if(!all.length&&pattern&&!state.closedShiftMonths.includes(workedMonth)&&gradeOn(workedMonth+'-01',s)>0&&gradeOn(`${workedMonth}-${daysIn(workedMonth)}`,s)>0&&(s.expectedLabour+s.expectedFestive)>0){
   const date=workedMonth+'-15';const grade=gradeOn(date,s);const table=rateTable(date,s)[Math.max(0,grade-1)];
   return {gross:grade?round(s.expectedLabour*s.defaultLabourHours*table.labour+s.expectedFestive*s.defaultFestiveHours*table.festive):0,hours:grade?s.expectedLabour*s.defaultLabourHours+s.expectedFestive*s.defaultFestiveHours:0,count:grade?s.expectedLabour+s.expectedFestive:0,pending:0,source:'pattern' as const,items:[] as Shift[]};
 }
 return {gross:round(counted.reduce((a,b)=>a+shiftGross(b,s),0)),hours:round(counted.reduce((a,b)=>a+b.hours,0)),count:counted.length,pending,source:all.length?'calendar' as const:'empty' as const,items:counted};
}
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
function solidarity(raw:number,s:Settings){const cap=s.contributionMax;return round(Math.max(0,Math.min(raw,cap*1.1)-cap)*.0019+Math.max(0,Math.min(raw,cap*1.5)-cap*1.1)*.0021+Math.max(0,raw-cap*1.5)*.0024);}
export function contributions(fixed:number,guards:number,priorFixed:number,other:number,s:Settings){
 const prorata=round(fixed/6),priorProrata=round(priorFixed/6),raw=fixed+prorata+other,priorRaw=priorFixed+priorProrata;
 const ccBase=raw?clamp(raw,s.ccMin,s.contributionMax):0,atBase=raw?clamp(raw,s.atMin,s.contributionMax):0;
 const guardCC=Math.max(0,clamp(priorRaw+guards,s.ccMin,s.contributionMax)-clamp(priorRaw,s.ccMin,s.contributionMax));
 const guardAT=Math.max(0,clamp(priorRaw+guards,s.atMin,s.contributionMax)-clamp(priorRaw,s.atMin,s.contributionMax));
 const common=round(ccBase*s.ccPercent/100)+round(guardCC*s.ccPercent/100);
 const mei=round(ccBase*s.meiPercent/100)+round(guardCC*s.meiPercent/100);
 const otherSS=round(atBase*s.unemploymentTrainingPercent/100)+round(guardAT*s.unemploymentTrainingPercent/100);
 const extraSolidarity=round(solidarity(raw,s)+solidarity(priorRaw+guards,s)-solidarity(priorRaw,s));
 return {total:round(common+mei+otherSS+extraSolidarity),common,mei,otherSS,solidarity:extraSolidarity,ccBase,atBase,guardCC,guardAT,prorata};
}
function vacation(state:State,month:string){const input=state.months[month]??blankMonth();if(input.vacationOverride!==null)return {gross:input.vacationOverride,complete:true,reference:[] as number[]};if(!input.vacationDays)return {gross:0,complete:true,reference:[] as number[]};const reference:number[]=[];let complete=true;for(let k=-6;k<0;k++){const m=addMonth(month,k);const actual=state.months[m]?.actual;const guards=guardMonth(state,addMonth(m,-state.settings.payDelay));if(actual)reference.push(actual.guardGross);else {reference.push(guards.gross);if(guards.pending||(!guards.count&&!state.closedShiftMonths.includes(addMonth(m,-state.settings.payDelay))))complete=false;}}return {gross:round(reference.reduce((a,b)=>a+b,0)/6/state.settings.vacationDivisor*input.vacationDays),complete,reference};}
export function monthRaw(state:State,month:string,pattern=false){const s=state.settings,input=state.months[month]??blankMonth(),workedMonth=addMonth(month,-s.payDelay);const guards=guardMonth(state,workedMonth,pattern);const fixed=fixedFor(month,s),extra=input.extraOverride??extraFor(month,s),vac=vacation(state,month);const contrib=contributions(fixed,guards.gross,fixedFor(workedMonth,s),vac.gross+input.otherGross,s);const gross=round(fixed+guards.gross+extra+vac.gross+input.otherGross);return {month,workedMonth,fixed,guards,extra,vacation:vac.gross,vacationComplete:vac.complete,vacationReference:vac.reference,other:input.otherGross,gross,ss:input.ssOverride??contrib.total,contrib,actual:input.actual};}
const taxBands=[{cap:12450,rate:.19},{cap:20200,rate:.24},{cap:35200,rate:.30},{cap:60000,rate:.37},{cap:300000,rate:.45},{cap:Infinity,rate:.47}];
export function scaleTax(base:number){let total=0,last=0;for(const band of taxBands){total+=Math.max(0,Math.min(base,band.cap)-last)*band.rate;last=band.cap;if(base<=band.cap)break;}return round(total);}
export function annualTax(gross:number,ss:number,s:Settings){
 const netWork=Math.max(0,gross-ss);const generalExpenses=Math.min(netWork,2000+(s.geographicalMobility?2000:0));
 const reduction=round(netWork<=14852?7302:netWork<=17673.52?7302-1.75*(netWork-14852):netWork<19747.5?2364.34-1.14*(netWork-17673.52):0);
 const base=round(Math.max(0,netWork-generalExpenses-reduction));
 let quota=Math.max(0,scaleTax(base)-scaleTax(Math.min(base,s.personalMinimum)));
 if(gross<=35200)quota=Math.min(quota,Math.max(0,(gross-15876)*.43));
 const percent=gross?Math.max(s.minimumTaxPercent,Math.floor((quota/gross*100+1e-8)*100)/100):0;
 return {gross,ss,base,quota:round(quota),percent,annualWithheld:round(gross*percent/100),generalExpenses,reduction};
}
// One cash projection supplies both the monthly view and annual totals.
export function yearCalculation(state:State,year:number){
 const s=state.settings;
 const raw=Array.from({length:12},(_,i)=>monthRaw(state,`${year}-${String(i+1).padStart(2,'0')}`,true));
 const through=s.accumulatedThrough?.startsWith(`${year}-`)?s.accumulatedThrough:null;
 const past=through?raw.filter(m=>m.month<=through):[];
 const unresolved=past.filter(m=>!m.actual);
 const confirmed=(key:'gross'|'ss'|'withheld')=>round(past.reduce((n,m)=>n+(m.actual?.[key]??0),0));
 const estimatedSS=round(past.reduce((n,m)=>n+(m.actual?.ss??m.ss),0));
 const totals={gross:s.accumulatedGross,ss:s.accumulatedSS??estimatedSS,withheld:s.accumulatedWithheld};
 // Distribute only the undisclosed portion. The UI labels these as an allocation,
 // never as individually confirmed payslips. Rounding residue goes to the last row.
 const allocated=new Map<string,{gross:number;ss:number;withheld:number}>();
 if(through&&unresolved.length){
  for(const key of ['gross','ss','withheld'] as const){
   const remaining=Math.max(0,round(totals[key]-confirmed(key)));
   const weight=unresolved.reduce((n,m)=>n+(key==='ss'?m.ss:m.gross),0);let used=0;
   unresolved.forEach((m,i)=>{const value=i===unresolved.length-1?round(remaining-used):Math.min(round(remaining-used),round(remaining*(weight?(key==='ss'?m.ss:m.gross)/weight:1/unresolved.length)));used=round(used+value);allocated.set(m.month,{gross:0,ss:0,withheld:0,...allocated.get(m.month),[key]:value});});
  }
 }
 const cashGross=round(raw.reduce((n,m)=>n+(m.actual?.gross??allocated.get(m.month)?.gross??m.gross),0));
 const cashSS=round(raw.reduce((n,m)=>n+(m.actual?.ss??allocated.get(m.month)?.ss??m.ss),0));
 const tax=annualTax((s.fiscalYear===year?s.annualGrossOverride:null)??cashGross,(s.fiscalYear===year?s.annualSSOverride:null)??cashSS,s);
 const basePercent=s.taxMode==='manual'?s.manualTaxPercent:tax.percent;
 let received=0,retained=0,complete=true;
 const months=raw.map((m,i)=>{
  const allocation=allocated.get(m.month),input=state.months[m.month]??blankMonth();
  const known=!!m.actual||!!allocation;
  let percent=basePercent,regularized=false;
  if(s.taxMode==='estimate'&&i>0&&complete&&tax.gross>received){percent=clamp(Math.floor(Math.max(0,(tax.quota-retained)/(tax.gross-received)*100)*100+1e-8)/100,s.minimumTaxPercent,47);regularized=true;}
  if(input.taxOverride!==null)percent=input.taxOverride;
  const forecastWithheld=round(m.gross*percent/100),forecastNet=round(m.gross-m.ss-forecastWithheld);
  const gross=m.actual?.gross??allocation?.gross??m.gross,ss=m.actual?.ss??allocation?.ss??m.ss;
  const withheld=m.actual?.withheld??allocation?.withheld??forecastWithheld;
  const result={...m,cashGross:gross,cashSS:ss,otherDeductions:m.actual?.otherDeductions??0,withheld,net:m.actual?.net??round(gross-ss-withheld),forecastWithheld,forecastNet,percent,regularized,received,retained,allocated:!!allocation};
  received=round(received+gross);retained=round(retained+withheld);
  // Once a complete cumulative checkpoint is reached, future projections can
  // regularize using that checkpoint and projected subsequent withholding.
  if(!known&&!regularized)complete=false;
  if(through===m.month)complete=true;
  return result;
 });
 const withheld=round(months.reduce((n,m)=>n+m.withheld,0));
 return {year,months,gross:cashGross,ss:cashSS,otherDeductions:round(months.reduce((n,m)=>n+m.otherDeductions,0)),tax,percent:basePercent,withheld,net:round(months.reduce((n,m)=>n+m.net,0)),effectivePercent:cashGross?round(withheld/cashGross*100):0,actualMonths:months.filter(m=>m.actual).length,patternMonths:months.filter(m=>!m.actual&&!m.allocated&&m.guards.source==='pattern').length,accumulatedSSIsEstimate:!!through&&s.accumulatedSS===null,accumulationConflict:!!through&&((!unresolved.length&&(Math.abs(confirmed('gross')-s.accumulatedGross)>.025||Math.abs(confirmed('withheld')-s.accumulatedWithheld)>.025||(s.accumulatedSS!==null&&Math.abs(confirmed('ss')-s.accumulatedSS)>.025)))||confirmed('gross')>s.accumulatedGross||confirmed('withheld')>s.accumulatedWithheld||(s.accumulatedSS!==null&&confirmed('ss')>s.accumulatedSS))};
}
export function calculate(state:State,month:string){
 const annual=yearCalculation(state,Number(month.slice(0,4))),raw=annual.months.find(m=>m.month===month)!,s=state.settings,input=state.months[month]??blankMonth();
 const warnings:string[]=[];
 if(!s.profileComplete)warnings.push('Completa tu perfil de residencia para comenzar a calcular.');
 const partial=(m:string)=>s.profileComplete&&((m===s.residencyStart.slice(0,7)&&s.residencyStart.slice(8)!=='01')||(s.residencyEnd&&m===s.residencyEnd.slice(0,7)&&Number(s.residencyEnd.slice(8))!==daysIn(m)));
 if(!raw.actual&&(partial(month)||(raw.guards.gross>0&&partial(raw.workedMonth))))warnings.push(`Alta o baja parcial en el mes de cobro o de las guardias (${raw.workedMonth}): el sueldo se prorratea, pero la cotización mantiene bases mensuales y es aproximada. Ajusta manualmente la cuota de Seguridad Social con el recibo. El finiquito no se calcula automáticamente.`);
 if(raw.guards.items.some(g=>classifyShiftDay(g.date,g.centre,s).needsReview))warnings.push('Hay guardias con calendario municipal incompleto o tarifa especial por revisar.');
 if(raw.guards.pending)warnings.push(`${raw.guards.pending} guardias pendientes de revisar ${s.includePending?'incluidas con horas propuestas':'excluidas del cálculo'}.`);
 if(raw.guards.source==='empty'&&!state.closedShiftMonths.includes(raw.workedMonth))warnings.push('No hay guardias cargadas para este mes trabajado; no equivale a un mes sin guardias.');
 if(raw.guards.source==='pattern')warnings.push('Este mes utiliza el patrón de guardias de Ajustes: todavía no hay guardias cargadas.');
 if(raw.guards.source==='calendar'&&!state.closedShiftMonths.includes(raw.workedMonth))warnings.push('Mes trabajado abierto: el cálculo solo cuenta las guardias cargadas; marca el mes completo cuando estén todas.');
 if(annual.patternMonths)warnings.push(`${annual.patternMonths} meses del IRPF anual utilizan el patrón de guardias de Ajustes; son un escenario.`);
 if(raw.allocated)warnings.push('Importes repartidos a partir del acumulado: falta el recibo individual de este mes.');
 if(annual.accumulatedSSIsEstimate)warnings.push('El acumulado no incluye cotizaciones reales: se utiliza una estimación. Puedes completarlas en Ajustes.');
 if(annual.accumulationConflict)warnings.push('El acumulado no cuadra con los recibos confirmados. Revisa los importes acumulados en Ajustes.');
 if(!raw.vacationComplete)warnings.push('El promedio vacacional usa meses incompletos o sin revisar. Introduce el importe confirmado para cerrarlo.');
 if(input.vacationDays&&input.vacationOverride===null)warnings.push(`Vacaciones: promedio de seis meses dividido entre ${s.vacationDivisor}. Revisa si los días son laborables o naturales.`);
 if(Number(month.slice(0,4))!==2026)warnings.push('Tarifas de guardia con vigencia 2027; sueldo, cotizaciones e IRPF mantienen parámetros 2026. Revisa también los festivos de este ejercicio.');
 if(s.taxMode==='estimate'&&!raw.regularized&&Number(month.slice(5))>1&&!raw.actual)warnings.push('IRPF anual orientativo: falta el acumulado completo de bruto y retenciones para regularizar.');
 return {...raw,annual,warnings};
}
// Compare the same forecast basis on both sides; a saved receipt stays untouched.
export function simulateGuardChange(state:State,month:string,deltaGross:number){
 const baseline=structuredClone(state);const input=baseline.months[month]??blankMonth();
 const original=monthRaw(state,month,true).guards.gross;
 baseline.months[month]={...input,actual:null,guardGrossOverride:original};
 const changed=structuredClone(baseline);changed.months[month].guardGrossOverride=Math.max(0,round(original+deltaGross));
 const before=calculate(baseline,month),after=calculate(changed,month);
 return {before:{...before,net:before.forecastNet},after:{...after,net:after.forecastNet},delta:round(after.forecastNet-before.forecastNet),gross:round(after.guards.gross-before.guards.gross)};
}

/** Smallest additional gross guard amount reaching the chosen cash forecast. */
export function targetNet(state:State,month:string,target:number){
 if(!Number.isFinite(target)||target<0)throw new Error('El objetivo neto debe ser un importe positivo.');
 const current=simulateGuardChange(state,month,0).before.forecastNet;
 if(target<=current)return {additionalGross:0,net:current,reached:true};
 let low=0,high=100000;
 if(simulateGuardChange(state,month,high).after.forecastNet<target)return {additionalGross:high,net:simulateGuardChange(state,month,high).after.forecastNet,reached:false};
 for(let i=0;i<28;i++){const mid=(low+high)/2;if(simulateGuardChange(state,month,mid).after.forecastNet>=target)high=mid;else low=mid;}
 const additionalGross=Math.ceil(high*100)/100;
 return {additionalGross,net:simulateGuardChange(state,month,additionalGross).after.forecastNet,reached:true};
}
