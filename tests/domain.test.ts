import { describe, expect, it } from 'vitest';
import { actualSchema, blankMonth, buildGradeDates, defaultState, stateSchema, type State, type Shift } from '../src/domain/model';
import { calculate, classifyShiftDay, contributions, extraFor, fixedFor, gradeOn, guardMonth, rateFor, simulateGuardChange, standardShiftHours, targetNet, updateShiftSchedule, yearCalculation } from '../src/domain/engine';
import { applyCalendarDecisions, eventToShift, parseCalendar, reconcileCalendar } from '../src/domain/calendar';
import { exportBackup, migrateLegacyState, parseBackup } from '../src/domain/backup';
import { parseReceipt, saveReceipt, type TextPiece } from '../src/domain/receipt';
import { detectShiftTitle, shiftCentreLabel } from '../src/domain/shift-names';

// Todos los perfiles, recibos y eventos de esta suite son inventados.
// Los importes de los recibos son sintéticos; las tarifas de guardia se contrastan con BOCM.
function profile():State {
 const state=defaultState();
 state.settings={...state.settings,profileComplete:true,residencyStart:'2024-07-01',residencyEnd:'2029-06-30',gradeDates:buildGradeDates('2024-07-01'),salaryBase:1000,complements:[100,200,300,400,500],centres:[{id:'general',name:'Hospital sintético',municipality:'Cercedilla',labourHours:17,festiveHours:24,aliases:['guardia','cerce'],localHolidays:{'2026':['2026-01-20','2026-09-08']}}]};
 return stateSchema.parse(state);
}
function shift(state:State,date='2026-09-14'):Shift {
 return {...eventToShift({id:date,date,title:'Guardia',start:date,end:date,allDay:true},state.settings),status:'confirmed'};
}
const actual={gross:3000,ss:200,withheld:450,guardGross:1000,otherDeductions:50,net:2300,source:'Recibo sintético revisado'};
const ics=(date='20260914',summary='Guardia',status='')=>`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:one\nDTSTART;VALUE=DATE:${date}\nSUMMARY:${summary}\n${status}\nEND:VEVENT\nEND:VCALENDAR`;

describe('Perfil y continuidad del motor',()=>{
 it('parte sin fechas personales activas, centros ni patrón y no genera sueldo',()=>{
  const s=defaultState();expect(s.settings.profileComplete).toBe(false);expect(s.settings.centres).toEqual([]);
  expect(s.settings.expectedLabour+s.settings.expectedFestive).toBe(0);expect(yearCalculation(s,2026).gross).toBe(0);
 });
 it('aplica las cinco fechas efectivas y el último día inclusivo',()=>{
  const s=profile().settings;s.gradeDates[1].from='2025-07-08';
  expect(gradeOn('2024-06-30',s)).toBe(0);expect(gradeOn('2025-07-07',s)).toBe(1);expect(gradeOn('2025-07-08',s)).toBe(2);
  for(let grade=3;grade<=5;grade++)expect(gradeOn(`${2023+grade}-07-01`,s)).toBe(grade);
  expect(gradeOn('2029-06-30',s)).toBe(5);expect(gradeOn('2029-07-01',s)).toBe(0);
 });
 it('calcula fijo, extra y cotización con importes totalmente sintéticos',()=>{
  const s=profile();
  expect(fixedFor('2026-06',s.settings)).toBe(1200);expect(extraFor('2026-06',s.settings)).toBe(1200);
  s.settings.gradeDates[2].from='2026-07-16';
  // Quince días a 1200 y dieciséis a 1300; la extra pondera los seis meses anteriores.
  expect(fixedFor('2026-07',s.settings)).toBe(1251.61);expect(extraFor('2026-12',s.settings)).toBe(1275.41);
  Object.assign(s.settings,{ccMin:0,atMin:0,ccPercent:4.7,meiPercent:0.15,unemploymentTrainingPercent:1.7});
  // Base 1200 + prorrata 200 + guardias 500 = 1900; 6,55 % = 124,45.
  expect(contributions(1200,500,1200,0,s.settings)).toMatchObject({ccBase:1400,atBase:1400,guardCC:500,guardAT:500,total:124.45});
 });
 it('respeta límites de bases y no genera fijo después del fin',()=>{
  const s=profile();s.settings.residencyEnd='2026-12-31';
  expect(contributions(20000,0,20000,0,s.settings).ccBase).toBe(5101.2);
  expect(fixedFor('2027-01',s.settings)).toBe(0);expect(extraFor('2027-06',s.settings)).toBe(0);
 });
 it('advierte cotización aproximada en meses de alta o baja parcial',()=>{
  const s=profile();Object.assign(s.settings,{residencyStart:'2024-07-11',gradeDates:buildGradeDates('2024-07-11')});
  expect(calculate(s,'2024-07').warnings.join(' ')).toMatch(/cotización.*aproximada/);
  s.settings.residencyEnd='2026-09-17';expect(calculate(s,'2026-09').warnings.join(' ')).toMatch(/finiquito/);
  s.months['2026-09']=saveReceipt(blankMonth(),actual);expect(calculate(s,'2026-09').warnings.join(' ')).not.toMatch(/cotización.*aproximada/);
 });
 it('avisa también si las guardias cobradas proceden de un mes de alta parcial',()=>{
  const s=profile();Object.assign(s.settings,{residencyStart:'2024-07-11',gradeDates:buildGradeDates('2024-07-11')});s.shifts=[shift(s,'2024-07-12')];
  expect(calculate(s,'2024-08').warnings.join(' ')).toMatch(/cotización.*aproximada/);
 });
 it('mantiene cobros diferidos en enero tras terminar en diciembre',()=>{
  const s=profile();s.settings.residencyEnd='2026-12-31';s.shifts=[shift(s,'2026-12-30')];
  const january=calculate(s,'2027-01');expect(january.fixed).toBe(0);expect(january.guards.gross).toBe(312.12);
  expect(january.workedMonth).toBe('2026-12');
 });
 it('admite residencia de cinco años iniciada en 2026 y cobro pendiente en 2031',()=>{
  const s=profile();Object.assign(s.settings,{residencyStart:'2026-06-01',residencyEnd:'2031-05-31',gradeDates:buildGradeDates('2026-06-01'),fiscalYear:2031});
  s.shifts=[shift(s,'2031-05-30')];const saved=stateSchema.parse(s);
  expect(gradeOn('2031-05-31',saved.settings)).toBe(5);expect(gradeOn('2031-06-01',saved.settings)).toBe(0);
  expect(calculate(saved,'2031-06')).toMatchObject({fixed:0,guards:{gross:374.68}});
  expect(calculate(saved,'2031-06').warnings.join(' ')).toMatch(/parámetros 2026/);
 });
 it('limita patrón a meses completos de residencia y no inventa guardias por defecto',()=>{
  const s=profile();expect(guardMonth(s,'2026-09',true).gross).toBe(0);
  s.settings.expectedLabour=3;s.settings.residencyEnd='2026-09-17';
  expect(guardMonth(s,'2026-08',true).count).toBe(3);expect(guardMonth(s,'2026-09',true).count).toBe(0);expect(guardMonth(s,'2026-10',true).count).toBe(0);
 });
 it('tarifas 2027 dependen de actividad y no cobro',()=>{
  const s=profile();expect(rateFor(shift(s,'2026-12-30'),s.settings)).toBe(18.36);
  expect(rateFor(shift(s,'2027-01-04'),s.settings)).toBe(19.28);
 });
 it('rechaza perfiles y fechas inválidos y soporta aniversario bisiesto',()=>{
  const s=profile();s.settings.residencyEnd='2024-01-01';expect(stateSchema.safeParse(s).success).toBe(false);
  expect(buildGradeDates('2024-02-29')[1].from).toBe('2025-02-28');expect(()=>buildGradeDates('2026-02-31')).toThrow();
 });
});

describe('Centros, calendarios y conciliación',()=>{
 it('un hospital fuera de Madrid no hereda San Isidro',()=>{
  const s=profile().settings;expect(classifyShiftDay('2026-05-15','general',s).type).toBe('labour');
  expect(classifyShiftDay('2026-09-08','general',s).type).toBe('festive');expect(classifyShiftDay('2027-09-08','general',s).needsReview).toBe(true);
 });
 it('centro desconocido y calendario local sin revisar quedan señalados',()=>{
  const s=profile().settings;s.centres[0].localHolidays={};
  expect(classifyShiftDay('2026-09-14','general',s).needsReview).toBe(true);
  expect(detectShiftTitle('Guardia otro lugar',{...s,centres:[]})).toMatchObject({centre:'unassigned',ambiguous:false,label:'Horario de hospital'});
  s.centres[0].localHolidays={'2026':[]};expect(classifyShiftDay('2026-09-14','general',s).needsReview).toBe(true);
 });
 it('una guardia con horario de hospital se puede confirmar sin identificar hospital',()=>{
  const s=profile();s.shifts=[{...shift(s),centre:'unassigned',status:'pending'}];
  expect(stateSchema.safeParse(s).success).toBe(true);s.shifts[0].status='confirmed';expect(stateSchema.safeParse(s).success).toBe(true);
  s.shifts[0].centre='centro-inexistente';expect(stateSchema.safeParse(s).success).toBe(false);
 });
 it('aplica el horario general de hospital conservando duración manual',()=>{
  const s=profile();s.settings.centres[0].labourHours=12;
  expect(standardShiftHours('general','labour',s.settings)).toBe(17);
  const standard=shift(s);expect(updateShiftSchedule(standard,{date:'2026-09-19'},s.settings).hours).toBe(24);
  expect(updateShiftSchedule({...standard,hours:10,hoursMode:'custom'},{date:'2026-09-19'},s.settings).hours).toBe(10);
 });
 it('reimportar conserva correcciones y exclusiones',()=>{
  const s=profile(),parsed=parseCalendar(ics(),2026,s.settings);
  const old={...parsed.shifts[0],hours:10,hoursMode:'custom' as const,status:'excluded' as const};
  const result=applyCalendarDecisions([old],reconcileCalendar([old],parsed,'feed'));
  expect(result.shifts).toHaveLength(1);expect(result.shifts[0]).toMatchObject({hours:10,status:'excluded'});
 });
 it('una guardia genérica se añade pendiente sin exigir hospital ni duplicarse al reimportar',()=>{
  const s=profile();s.settings.centres[0].aliases=[];
  const parsed=parseCalendar(ics(),2026,s.settings);const p=reconcileCalendar([],parsed,'feed');
  expect(p[0]).toMatchObject({kind:'new',action:'add',incoming:{centre:'unassigned',hours:17,status:'pending'}});
  const imported=applyCalendarDecisions([],p);expect(imported.added).toBe(1);
  expect(applyCalendarDecisions(imported.shifts,reconcileCalendar(imported.shifts,parsed,'feed'))).toMatchObject({added:0,updated:0,shifts:imported.shifts});
  expect(classifyShiftDay('2026-05-15','unassigned',s.settings)).toMatchObject({type:'labour',needsReview:true});
 });
 it('Torrelodones usa 11 h laborables aunque no haya centro configurado; resto 17 o 24 h',()=>{
  const s=profile();s.settings.centres[0].aliases=[];
  for(const [title,date,hours] of [['Guardia','20260914',17],['Guardia Cercedilla','20260914',17],['Guardia Torrelodones','20260914',11],['Guardia torrelo','20260914',11],['Guardia Torrelodones','20260919',24],['Guardia Torrelodones','20261012',24],['Guardia Cercedilla','20260919',24]] as const){
   const parsed=parseCalendar(ics(date,title),2026,s.settings),proposal=reconcileCalendar([],parsed,'feed')[0];
   expect(proposal).toMatchObject({kind:'new',action:'add',incoming:{centre:'unassigned',hours,hoursMode:'standard'}});
  }
  const torrel=parseCalendar(ics('20260914','Guardia Torrelodones'),2026,s.settings).shifts[0];
  expect(shiftCentreLabel(torrel,s.settings)).toBe('Torrelodones');
  const weekend=updateShiftSchedule(torrel,{date:'2026-09-19'},s.settings);expect(weekend).toMatchObject({hours:24,type:'festive'});
  expect(updateShiftSchedule(weekend,{date:'2026-09-21'},s.settings)).toMatchObject({hours:11,type:'labour'});
 });
 it('el horario expreso del ICS y las correcciones de horas prevalecen sobre Torrelodones',()=>{
  const s=profile();s.settings.centres[0].aliases=[];
  const timed=eventToShift({id:'timed',date:'2026-09-14',title:'Guardia Torrelodones',start:'2026-09-14T08:00:00Z',end:'2026-09-14T15:30:00Z',allDay:false},s.settings);
  expect(timed).toMatchObject({hours:7.5,hoursMode:'custom'});
  expect(updateShiftSchedule(timed,{date:'2026-09-19'},s.settings)).toMatchObject({hours:7.5,hoursMode:'custom',type:'festive'});
  const parsed=parseCalendar(ics('20260914','Guardia Torrelodones'),2026,s.settings);
  const corrected={...parsed.shifts[0],hours:13,hoursMode:'custom' as const,status:'confirmed' as const};
  expect(applyCalendarDecisions([corrected],reconcileCalendar([corrected],parsed,'feed')).shifts[0]).toMatchObject({hours:13,hoursMode:'custom',status:'confirmed'});
 });
 it('títulos contradictorios mantienen revisión y una guardia manual conserva sus ajustes',()=>{
  const s=profile();s.settings.centres[0].aliases=[];
  const ambiguous=parseCalendar(ics('20260914','Guardia Torrelodones Cercedilla'),2026,s.settings);
  expect(reconcileCalendar([],ambiguous,'feed')[0]).toMatchObject({kind:'ambiguous',action:'keep'});
  const parsed=parseCalendar(ics(),2026,s.settings);
  const manual={...parsed.shifts[0],id:'manual',centre:'general',sourceKey:'',sourceSignature:'',hours:11.5,hoursMode:'custom' as const,status:'confirmed' as const};
  const p=reconcileCalendar([manual],parsed,'feed');expect(p[0]).toMatchObject({kind:'manualMatch',action:'keep',existingId:'manual'});
  expect(applyCalendarDecisions([manual],[{...p[0],action:'link'}])).toMatchObject({added:0,updated:0,linked:1,shifts:[{id:'manual',centre:'general',hours:11.5,status:'confirmed'}]});
 });
 it('abreviatura G admite los alias del centro configurado',()=>{
  const s=profile();s.settings.centres[0].aliases=['getafe'];
  const parsed=parseCalendar(ics('20260914','G. Getafe'),2026,s.settings);
  expect(parsed.shifts).toHaveLength(1);expect(parsed.shifts[0].centre).toBe('general');
  expect(parseCalendar(ics('20260914','G. reunión'),2026,s.settings).shifts).toHaveLength(0);
 });
 it('cancelaciones requieren decisión y mantienen el estado durante revisión',()=>{
  const s=profile(),old=parseCalendar(ics(),2026,s.settings).shifts;
  const parsed=parseCalendar(ics('20260914','Guardia','STATUS:CANCELLED'),2026,s.settings);
  const p=reconcileCalendar(old,parsed,'feed');expect(p[0].kind).toBe('cancelled');
  expect(applyCalendarDecisions(old,p).shifts[0].status).toBe('pending');
  expect(applyCalendarDecisions(old,[{...p[0],action:'exclude'}]).shifts[0].status).toBe('excluded');
 });
});

describe('Neto cobrado, documentos y simulación',()=>{
 it('guarda el neto revisado sin reconstruirlo y exige otros descuentos para cuadre',()=>{
  const month=saveReceipt(blankMonth(),{...actual,net:2300.01});expect(month.actual?.net).toBe(2300.01);
  expect(actualSchema.safeParse({...actual,otherDeductions:0}).success).toBe(false);
 });
 it('agrega PDF de un mes y bloquea su hash repetido',()=>{
  const first=saveReceipt(blankMonth(),actual,'a'.repeat(64));
  const combined=saveReceipt(first,actual,'b'.repeat(64),'add');
  expect(combined.actual).toMatchObject({net:4600,otherDeductions:100,gross:6000});expect(combined.receiptHashes).toHaveLength(2);
  expect(()=>saveReceipt(combined,actual,'a'.repeat(64),'add')).toThrow(/ya está/);
 });
 it('recibos posteriores al fin permanecen iguales tras cambiar reglas',()=>{
  const s=profile();s.settings.residencyEnd='2026-06-30';s.months['2026-10']=saveReceipt(blankMonth(),actual);
  s.settings.salaryBase=8000;s.settings.manualTaxPercent=47;
  expect(calculate(s,'2026-10')).toMatchObject({net:2300,cashGross:3000,otherDeductions:50});
 });
 it('sumas de neto mensual y anual respetan los descuentos reales',()=>{
  const s=profile();for(let m=1;m<=12;m++)s.months[`2026-${String(m).padStart(2,'0')}`]=saveReceipt(blankMonth(),actual);
  const year=yearCalculation(s,2026);expect(year.net).toBe(27600);expect(year.otherDeductions).toBe(600);expect(year.net).toBe(year.months.reduce((n,m)=>n+m.net,0));
 });
 it('simulación cero conserva recibos y objetivo neto alcanza resultado',()=>{
  const s=profile();s.months['2026-09']=saveReceipt(blankMonth(),actual);
  expect(simulateGuardChange(s,'2026-09',0).delta).toBe(0);
  expect(s.months['2026-09'].actual?.net).toBe(2300);
  const target=targetNet(s,'2026-09',2200);expect(target.reached).toBe(true);expect(target.net).toBeGreaterThanOrEqual(2200);
 });
 it('acumulados distribuyen bruto, SS y retenciones sin inventar recibos',()=>{
  const s=profile();Object.assign(s.settings,{accumulatedThrough:'2026-08',accumulatedGross:24000,accumulatedSS:1600,accumulatedWithheld:3600});
  const months=yearCalculation(s,2026).months.slice(0,8);
  expect(Math.round(months.reduce((n,m)=>n+m.cashGross,0))).toBe(24000);expect(months.every(m=>m.allocated&&!m.actual)).toBe(true);
 });
 it('extrae importes y otros descuentos sin conservar texto personal',()=>{
  const pieces:TextPiece[]=[{text:'TOTAL DEVENGOS',x:0,y:100,width:100},{text:'3.000,00',x:50,y:115,width:50},{text:'TOTAL DESCUENTOS',x:200,y:100,width:100},{text:'700,00',x:250,y:115,width:50},{text:'LIQUIDO',x:400,y:100,width:100},{text:'2.300,00',x:450,y:115,width:50},{text:'RETENCION I.R.P.F. 450,00',x:0,y:30,width:100},{text:'COTIZ EMPLEADO 200,00',x:0,y:50,width:100},{text:'GUA PRES FIS 1.000,00',x:0,y:70,width:100},{text:'PERIODO DE PAGO',x:0,y:140,width:100},{text:'SEPTIEMBRE 2026',x:0,y:155,width:100}];
  expect(parseReceipt(pieces)).toMatchObject({gross:3000,ss:200,withheld:450,net:2300,guardGross:1000,otherDeductions:50,paymentMonth:'2026-09'});
 });
 it('PDF escaneado entrega borrador vacío y advertencias para entrada manual',()=>{
  const draft=parseReceipt([]);expect(draft.net).toBeNull();expect(draft.warnings.length).toBeGreaterThan(0);
 });
});

describe('Copias versionadas',()=>{
 it('exporta e importa v2 sin cambios',()=>{
  const s=profile();s.shifts=[shift(s)];s.months['2026-09']=saveReceipt(blankMonth(),actual);
  const result=parseBackup(exportBackup(s));expect(result.version).toBe(2);expect(result.state).toEqual(s);expect(result.summary).toEqual({shifts:1,receipts:1});
 });
 it('migra v1 conservando recibos, fechas y centros originales',()=>{
  const source=profile();const legacy=JSON.parse(JSON.stringify(source));delete legacy.settings.centres;delete legacy.settings.gradeDates;delete legacy.settings.residencyEnd;delete legacy.settings.profileComplete;
  legacy.months['2026-09']={...blankMonth(),actual:{...actual,otherDeductions:0,net:2350}};delete legacy.months['2026-09'].actual.otherDeductions;
  const result=parseBackup({format:'mi-nomina-guardias',version:1,state:legacy});
  expect(result.state.settings.centres[0].municipality).toBe('Madrid');expect(result.state.settings.centres[1].municipality).toBe('Cercedilla');
  expect(result.state.settings.profileComplete).toBe(true);expect(result.state.months['2026-09'].actual?.net).toBe(2350);
  expect(result.warnings).toHaveLength(2);expect(migrateLegacyState(legacy).settings.residencyEnd).toBe('2029-06-30');
 });
 it('rechaza versiones futuras, estructura inválida y JSON incompleto',()=>{
  expect(()=>parseBackup({format:'mi-nomina-guardias',version:3,state:profile()})).toThrow(/Versión/);
  expect(()=>parseBackup({format:'mi-nomina-guardias',version:2,state:{}})).toThrow();expect(()=>parseBackup('{')).toThrow(/JSON/);
 });
 it('excluye enlaces privados incluso en procedencia heredada',()=>{
  const s=profile();s.shifts=[{...shift(s),sourceCalendar:'https://calendar.google.com/calendar/ical/private/basic.ics'}];
  expect(exportBackup(s)).not.toContain('private/basic.ics');
 });
});
