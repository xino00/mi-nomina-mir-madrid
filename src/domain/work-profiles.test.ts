import {describe,expect,it} from 'vitest';
import {blankMonth,buildGradeDates,defaultState,legacyCentres,stateSchema,workProfileSchema,type Centre,type Shift,type State,type WorkProfile} from './model';
import {applyCalendarDecisions,eventToShift,parseCalendar,reconcileCalendar} from './calendar';
import {classifyShiftDay,normalizeShiftHours,standardShiftHours,updateShiftSchedule} from './engine';
import {exportBackup,parseBackup} from './backup';
import {applyWorkProfile,builtinWorkProfiles,profileFromSettings,profileMatchesSettings} from './work-profiles';
import {detectShiftTitle} from './shift-names';

function ready():State {
 const state=defaultState();
 Object.assign(state.settings,{profileComplete:true,residencyStart:'2025-06-04',residencyEnd:'2029-06-03',gradeDates:buildGradeDates('2025-06-04',4),centres:structuredClone(legacyCentres.slice(0,3))});
 return stateSchema.parse(state);
}
function guard(state:State,patch:Partial<Shift>={}):Shift {
 return {...eventToShift({id:'event-1',date:'2026-09-14',title:'Guardia hospital',start:'2026-09-14',end:'2026-09-15',allDay:true},state.settings),status:'confirmed',...patch};
}
function own(patch:Partial<WorkProfile>={}):WorkProfile {
 return workProfileSchema.parse({...structuredClone(builtinWorkProfiles[0]),id:'own-profile',name:'Centro de pruebas',...patch});
}

describe('Plantillas de condiciones de trabajo',()=>{
 it('incluye MFyC FJD de cuatro años con Madrid, Cercedilla y Torrelodones',()=>{
  const profile=builtinWorkProfiles[0],state=applyWorkProfile(defaultState(),profile);
  expect(profile).toMatchObject({id:'mfyc-fjd',name:'MFyC · FJD',residencyYears:4,defaultLabourHours:17,defaultFestiveHours:24,payDelay:1});
  expect(state.settings.centres.map(c=>[c.id,c.municipality])).toEqual([['Hospital','Madrid'],['SAR Cercedilla','Cercedilla'],['SAR Torrelodones','Torrelodones']]);
  expect(state.settings.centres[0].name).toBe('Fundación Jiménez Díaz');
  expect(state.settings.centres[0].aliases).toContain('fjd');
  for(const centre of state.settings.centres){
   expect(standardShiftHours(centre.id,'labour',state.settings)).toBe(centre.id==='SAR Torrelodones'?11:17);
   expect(standardShiftHours(centre.id,'festive',state.settings)).toBe(24);
   expect(centre.localHolidays['2026']).toHaveLength(2);
  }
  state.settings.defaultFestiveHours=20;
  expect(standardShiftHours('SAR Torrelodones','festive',state.settings)).toBe(20);
  expect(state.settings.profileComplete).toBe(false);
 });

 it('un centro propio define sus horas y prevalece sobre el título de la guardia',()=>{
  const state=ready();
  state.settings.centres[0]={...state.settings.centres[0],scheduleMode:'custom',labourHours:12.5,festiveHours:19};
  expect(standardShiftHours('Hospital','labour',state.settings,'Guardia Torrelodones')).toBe(12.5);
  expect(standardShiftHours('Hospital','special',state.settings)).toBe(19);
  expect(eventToShift({id:'custom',date:'2026-09-14',title:'Guardia hospital',start:'2026-09-14',end:'2026-09-15',allDay:true},state.settings).hours).toBe(12.5);
 });

 it('mantiene el significado de las horas generales en estados anteriores',()=>{
  const old=ready();old.settings.defaultLabourHours=16;old.settings.defaultFestiveHours=20;
  const legacy=JSON.parse(JSON.stringify(old));delete legacy.settings.savedWorkProfiles;delete legacy.settings.activeWorkProfileId;
  const parsed=stateSchema.parse(legacy);
  expect(parsed.settings.savedWorkProfiles).toEqual([]);expect(parsed.settings.activeWorkProfileId).toBeNull();
  expect(parsed.settings.centres[0].scheduleMode).toBeUndefined();
  expect(standardShiftHours('Hospital','labour',parsed.settings)).toBe(16);
  expect(standardShiftHours('SAR Cercedilla','festive',parsed.settings)).toBe(20);
  expect(standardShiftHours('unassigned','labour',parsed.settings,'Guardia Torrelodones')).toBe(11);
 });

 it('captura condiciones sin fechas personales, acumulados ni registros financieros',()=>{
  const state=ready();state.settings.accumulatedGross=9876;state.settings.taxMode='manual';state.settings.manualTaxPercent=23;
  const profile=profileFromSettings(state.settings,'Mi perfil','my-profile');
  expect(Object.keys(profile).sort()).toEqual(['centres','defaultFestiveHours','defaultLabourHours','id','name','payDelay','residencyYears'].sort());
  expect(profile.residencyYears).toBe(4);
  profile.centres[0].aliases.push('solo en copia');profile.centres[0].localHolidays['2026'].push('2026-09-15');
  expect(state.settings.centres[0].aliases).not.toContain('solo en copia');expect(state.settings.centres[0].localHolidays['2026']).toHaveLength(2);
  state.settings.gradeDates=buildGradeDates(state.settings.residencyStart,5);
  expect(profileFromSettings(state.settings,'Cinco años','five').residencyYears).toBe(5);
 });

 it('selecciona condiciones preservando residencia, IRPF, sueldo, nóminas y biblioteca',()=>{
  const state=ready();state.settings.savedWorkProfiles=[own()];
  Object.assign(state.settings,{taxMode:'manual',manualTaxPercent:23,salaryBase:1999,accumulatedThrough:'2026-08',accumulatedGross:10000,accumulatedWithheld:2000});
  state.shifts=[guard(state,{hours:13,hoursMode:'custom',customRate:25,gradeOverride:2,sourceNote:'Horas confirmadas'})];
  state.months['2026-09']={...blankMonth(),guardGrossOverride:500,actual:{gross:3000,ss:200,withheld:400,guardGross:500,otherDeductions:0,net:2400,source:'Sintético'}};
  state.appliedCalendarImports=['consumed'];state.closedShiftMonths=['2026-08'];state.importedAt='2026-09-01';
  const original=structuredClone(state),next=applyWorkProfile(state,own({payDelay:2,fiscalPreset:undefined}));
  expect(next.settings.activeWorkProfileId).toBe('own-profile');expect(next.settings.payDelay).toBe(2);
  for(const key of ['residencyStart','residencyEnd','gradeDates','taxMode','manualTaxPercent','salaryBase','accumulatedThrough','accumulatedGross','accumulatedWithheld','savedWorkProfiles'] as const)expect(next.settings[key]).toEqual(state.settings[key]);
  for(const key of ['shifts','months','appliedCalendarImports','closedShiftMonths','importedAt'] as const)expect(next[key]).toEqual(state[key]);
  expect(state).toEqual(original);
 });

 it('cambiar el horario general conserva guardias previas y nuevos eventos usan el nuevo horario',()=>{
  const state=ready();state.shifts=[guard(state),guard(state,{id:'unassigned',centre:'unassigned',title:'Guardia'})];
  const profile=own({defaultLabourHours:19,defaultFestiveHours:20}),next=applyWorkProfile(state,profile);
  expect(next.settings.centres[0].id).not.toBe('Hospital');
  expect(next.settings.centres.find(c=>c.id==='Hospital')).toMatchObject({scheduleMode:'custom',labourHours:17,festiveHours:24});
  expect(next.shifts[0]).toMatchObject({centre:'Hospital',hours:17,hoursMode:'standard'});
  expect(next.shifts[1]).toMatchObject({hours:17,hoursMode:'custom'});
  expect(normalizeShiftHours(next).shifts.map(s=>s.hours)).toEqual([17,17]);
  expect(standardShiftHours(next.settings.centres[0].id,'labour',next.settings)).toBe(19);
  expect(profileMatchesSettings(profile,next.settings)).toBe(true);
  expect(applyWorkProfile(next,profile)).toEqual(next);
 });

 it('no secuestra el ID Hospital de otro municipio y la asignación es idempotente',()=>{
  const state=ready();state.settings.centres=[{...state.settings.centres[0],name:'Hospital de pruebas',municipality:'Getafe'}];state.shifts=[guard(state)];
  const next=applyWorkProfile(state,builtinWorkProfiles[0]);
  expect(next.settings.centres[0]).toMatchObject({name:'Fundación Jiménez Díaz',municipality:'Madrid'});expect(next.settings.centres[0].id).not.toBe('Hospital');
  expect(next.settings.centres.find(c=>c.id==='Hospital')).toEqual({...state.settings.centres[0],archived:true});expect(next.shifts).toEqual(state.shifts);
  expect(applyWorkProfile(next,builtinWorkProfiles[0])).toEqual(next);
 });

 it('no confunde otro hospital madrileño con FJD aunque su ID sea Hospital',()=>{
  const state=ready();state.settings.centres[0].name='Hospital Gregorio Marañón';state.shifts=[guard(state)];
  const next=applyWorkProfile(state,builtinWorkProfiles[0]);
  expect(next.settings.centres[0].id).not.toBe('Hospital');expect(next.settings.centres.find(c=>c.id==='Hospital')?.name).toBe('Hospital Gregorio Marañón');
 });

 it('mantiene centros con pendientes o excluidas y protege cambios de festivos locales',()=>{
  const state=ready();state.shifts=[guard(state,{status:'pending'}),guard(state,{id:'excluded',centre:'SAR Cercedilla',status:'excluded'})];
  const profile=own({centres:[{...state.settings.centres[0],localHolidays:{'2026':['2026-01-20']}}]});
  const next=applyWorkProfile(state,profile);
  expect(next.settings.centres.map(c=>c.id)).toContain('SAR Cercedilla');expect(next.settings.centres[0].id).not.toBe('Hospital');
  expect(next.settings.centres.find(c=>c.id==='Hospital')?.localHolidays).toEqual(state.settings.centres[0].localHolidays);
  expect(next.shifts).toEqual(state.shifts);
 });

 it('los cambios propios se detectan sin confundir centros históricos adicionales',()=>{
  const state=ready(),profile=own();state.settings.centres[0].name='Hospital ajeno';state.shifts=[guard(state)];
  const next=applyWorkProfile(state,profile);
  expect(profileMatchesSettings(profile,next.settings)).toBe(true);
  const extra={...next.settings.centres[0],id:'extra-active'};next.settings.centres.push(extra);
  expect(profileMatchesSettings(profile,next.settings)).toBe(false);next.settings.centres.pop();
  next.settings.centres[0].aliases.push('nuevo alias');expect(profileMatchesSettings(profile,next.settings)).toBe(false);
 });

 it('reconoce el centro activo al releer un calendario sin confundir centros conservados',()=>{
  const state=ready();state.shifts=[guard(state),guard(state,{id:'rural',centre:'SAR Torrelodones',title:'Guardia Torrelodones',hours:11})];
  const next=applyWorkProfile(state,own({defaultLabourHours:19}));
  expect(next.settings.centres.find(c=>c.id==='Hospital')?.archived).toBe(true);
  const detected=detectShiftTitle('Guardia hospital',next.settings);
  expect(detected).toMatchObject({centre:next.settings.centres[0].id,ambiguous:false});
  expect(eventToShift({id:'reimport',date:'2026-09-15',title:'Guardia hospital',start:'2026-09-15',end:'2026-09-16',allDay:true},next.settings)).toMatchObject({centre:next.settings.centres[0].id,hours:19});
  expect(profileFromSettings(next.settings,'Activos','active').centres).toHaveLength(3);
  expect(detectShiftTitle('Guardia',next.settings)).toMatchObject({centre:next.settings.centres[0].id,ambiguous:false});
  const differentWeekend=applyWorkProfile(next,own({defaultLabourHours:19,defaultFestiveHours:20}));
  const activeRural=differentWeekend.settings.centres.find(c=>!c.archived&&c.name==='SAR Torrelodones')!;
  expect(activeRural.id).not.toBe('SAR Torrelodones');
  expect(detectShiftTitle('Guardia Torrelodnes',differentWeekend.settings)).toMatchObject({centre:activeRural.id,ambiguous:false});
 });

 it('la aplicación es pura, de modo que cancelar una selección conserva el estado',()=>{
  const state=ready(),profile=own(),before=structuredClone(state),beforeProfile=structuredClone(profile);
  const draft=applyWorkProfile(state,profile);draft.settings.centres[0].name='Borrador';
  expect(state).toEqual(before);expect(profile).toEqual(beforeProfile);
 });

 it('rechaza más de treinta centros sin modificar guardias ni ajustes',()=>{
  const state=ready(),base=state.settings.centres[0];
  state.settings.centres=Array.from({length:20},(_,i)=>({...base,id:`old-${i}`,name:`Anterior ${i}`}));
  state.shifts=state.settings.centres.map((c,i)=>guard(state,{id:`shift-${i}`,centre:c.id}));
  const profile=own({centres:Array.from({length:20},(_,i)=>({...base,id:`new-${i}`,name:`Nuevo ${i}`}))}),before=structuredClone(state);
  expect(()=>applyWorkProfile(state,profile)).toThrow(/30 centros/);expect(state).toEqual(before);
 });

 it('rechaza identificadores de perfiles repetidos, reservados y centros duplicados',()=>{
  const state=ready();state.settings.savedWorkProfiles=[own(),own()];expect(()=>stateSchema.parse(state)).toThrow();
  state.settings.savedWorkProfiles=[structuredClone(builtinWorkProfiles[0])];expect(()=>stateSchema.parse(state)).toThrow();
  expect(()=>own({centres:[legacyCentres[0],legacyCentres[0]]})).toThrow();
 });

 it('no permite una residencia completa con solo centros conservados',()=>{
  const state=ready();state.shifts=[guard(state)];
  const next=applyWorkProfile(state,own({defaultLabourHours:19}));
  next.settings.centres=next.settings.centres.filter(c=>c.archived);
  expect(next.settings.centres).toHaveLength(1);
  expect(()=>stateSchema.parse(next)).toThrow(/centro activo/);
 });
});

describe('Copias v4 con perfiles y horarios propios',()=>{
 it('reutiliza identificadores de centros protegidos generados por v3',()=>{
  const centre={...structuredClone(builtinWorkProfiles[0].centres[0]),holidayMunicipality:undefined};
  const profile=own({defaultLabourHours:19,centres:[centre]}),state=ready();
  state.settings.defaultLabourHours=19;
  // ID produced by v3 for this synthetic profile and definition, before adding calendar jurisdiction.
  const legacyId='wp-18yy5zn-9a5lu4';
  state.settings.centres=[{...centre,id:legacyId}];
  state.shifts=[guard(state,{centre:legacyId,hours:19})];
  const next=applyWorkProfile(state,profile);
  expect(next.settings.centres).toHaveLength(1);expect(next.settings.centres[0].id).toBe(legacyId);
  expect(next.shifts).toEqual(state.shifts);
 });

 it('v3 conserva fiscalidad y festivos antiguos hasta reaplicar FJD; v4 conserva las nuevas condiciones',()=>{
  const old=JSON.parse(JSON.stringify(ready()));delete old.settings.fiscalPreset;
  old.settings.activeWorkProfileId='mfyc-fjd';old.settings.taxMode='manual';old.settings.manualTaxPercent=23;
  const loaded=parseBackup({format:'mi-nomina-guardias',version:3,state:old});
  expect(loaded.migrated).toBe(true);expect(loaded.state.settings.fiscalPreset).toBeNull();
  expect(loaded.state.settings.taxMode).toBe('manual');
  expect(loaded.state.settings.centres[1].localHolidays['2026']).toContain('2026-09-08');
  expect(profileMatchesSettings(builtinWorkProfiles[0],loaded.state.settings)).toBe(false);
  const next=applyWorkProfile(loaded.state,builtinWorkProfiles[0]);
  next.settings.savedWorkProfiles=[profileFromSettings(next.settings,'FJD propia','saved')];
  expect(next.settings.savedWorkProfiles[0].fiscalPreset).toBe('madrid-single-employee');
  expect(parseBackup(exportBackup(next))).toMatchObject({version:4,migrated:false,state:next});
 });

 it('exporta y restaura perfiles propios, selección, horarios y registros sin pérdida',()=>{
  const state=ready();state.settings.centres[0].scheduleMode='custom';state.settings.centres[0].labourHours=12;
  const profile=profileFromSettings(state.settings,'Mi centro','custom');state.settings.savedWorkProfiles=[profile];state.settings.activeWorkProfileId=profile.id;state.shifts=[guard(state)];
  const result=parseBackup(exportBackup(state));
  expect(result.version).toBe(4);expect(result.migrated).toBe(false);expect(result.state).toEqual(state);
  expect(standardShiftHours('Hospital','labour',result.state.settings)).toBe(12);
 });

 it('importa v2 sin atribuir horarios por centro a campos que antes no se utilizaban',()=>{
  const state=ready();state.settings.defaultLabourHours=16;
  const old=JSON.parse(JSON.stringify(state));delete old.settings.savedWorkProfiles;delete old.settings.activeWorkProfileId;
  const result=parseBackup({format:'mi-nomina-guardias',version:2,state:old});
  expect(result.migrated).toBe(true);expect(result.warnings).toHaveLength(1);expect(result.state.settings.savedWorkProfiles).toEqual([]);
  expect(standardShiftHours('Hospital','labour',result.state.settings)).toBe(16);
 });

 it('rechaza versiones futuras antes de interpretar o reemplazar el estado',()=>{
  expect(()=>parseBackup({format:'mi-nomina-guardias',version:5,state:ready()})).toThrow(/Versión/);
 });
});

describe('Calendario y fiscalidad del perfil FJD',()=>{
 it('aplica Comunidad y Madrid capital en los tres centros, manteniendo sus municipios físicos',()=>{
  const {settings}=applyWorkProfile(ready(),builtinWorkProfiles[0]);
  for(const c of settings.centres){
   expect(c.holidayMunicipality).toBe('Madrid');
   for(const date of ['2026-05-15','2026-11-09']){
    expect(classifyShiftDay(date,c.id,settings)).toEqual({type:'festive',reason:'Festivo local de Madrid (2026).',needsReview:false});
    expect(standardShiftHours(c.id,'festive',settings)).toBe(24);
   }
   for(const md of ['01-01','01-06','04-02','04-03','05-01','05-02','08-15','10-12','11-02','12-07','12-08','12-25'])expect(classifyShiftDay(`2026-${md}`,c.id,settings).type).not.toBe('labour');
   for(const date of ['2026-01-20','2026-09-08','2026-07-16','2026-08-14'])expect(classifyShiftDay(date,c.id,settings).type).toBe('labour');
   expect(classifyShiftDay('2026-12-24',c.id,settings)).toMatchObject({type:'special',needsReview:true});
   expect(classifyShiftDay('2027-05-15',c.id,settings).needsReview).toBe(true);
  }
  expect(settings.centres.map(c=>c.municipality)).toEqual(['Madrid','Cercedilla','Torrelodones']);
 });

 it('conserva el calendario y las horas de guardias anteriores y activa fiscalidad sin borrar importes',()=>{
  const state=ready();
  state.shifts=[guard(state,{centre:'SAR Cercedilla',date:'2026-09-08',type:'festive',hours:24})];
  Object.assign(state.settings,{taxMode:'manual',manualTaxPercent:23,minimumTaxPercent:2,personalMinimum:7000,geographicalMobility:true,annualGrossOverride:45000,annualSSOverride:3000,accumulatedThrough:'2026-08',accumulatedGross:28000,accumulatedWithheld:5000,accumulatedSS:1800});
  state.months['2026-08']={...blankMonth(),actual:{gross:3000,ss:200,withheld:400,guardGross:500,otherDeductions:0,net:2400,source:'Synthetic'}};
  const next=applyWorkProfile(state,builtinWorkProfiles[0]);
  expect(next.settings).toMatchObject({fiscalPreset:'madrid-single-employee',taxMode:'estimate',minimumTaxPercent:15,personalMinimum:5550,geographicalMobility:false,manualTaxPercent:23,annualGrossOverride:45000,annualSSOverride:3000,accumulatedThrough:'2026-08',accumulatedGross:28000,accumulatedWithheld:5000,accumulatedSS:1800});
  expect(next.shifts).toEqual(state.shifts);expect(next.months).toEqual(state.months);
  expect(next.settings.centres.find(c=>c.id==='SAR Cercedilla')).toMatchObject({archived:true,localHolidays:{'2026':['2026-01-20','2026-09-08']}});
  const active=next.settings.centres.find(c=>!c.archived&&c.municipality==='Cercedilla')!;
  expect(classifyShiftDay('2026-09-08',active.id,next.settings).type).toBe('labour');
  expect(profileMatchesSettings(builtinWorkProfiles[0],next.settings)).toBe(true);
  expect(applyWorkProfile(next,builtinWorkProfiles[0])).toEqual(next);
  next.settings.taxMode='manual';expect(profileMatchesSettings(builtinWorkProfiles[0],next.settings)).toBe(false);
  expect(profileFromSettings(next.settings,'Manual','manual').fiscalPreset).toBeUndefined();
 });
});

describe('Centros propios con alias compartidos',()=>{
 function shared(){
  const state=ready(),base=state.settings.centres[0];
  state.settings.centres=[{...base,id:'first',name:'Centro A',aliases:['hospital'],scheduleMode:'custom',labourHours:12},{...base,id:'second',name:'Centro B',aliases:['hospital'],scheduleMode:'custom',labourHours:16}];
  return state;
 }
 const feed=(title='Guardia hospital',timed=false)=>`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:shared\n${timed?'DTSTART:20260914T080000Z\nDTEND:20260914T153000Z':'DTSTART;VALUE=DATE:20260914'}\nSUMMARY:${title}\nEND:VEVENT\nEND:VCALENDAR`;

 it('propone revisión para alias compartidos, abreviatura G y fallback hospital sin añadir horas generales',()=>{
  const state=shared();
  for(const title of ['Guardia hospital','G. Hospital','Guardia']){
   const parsed=parseCalendar(feed(title),2026,state.settings),proposal=reconcileCalendar([],parsed,'feed')[0];
   expect(parsed.shifts).toHaveLength(1);
   expect(proposal).toMatchObject({kind:'ambiguous',action:'keep',needsCentreReview:true,incoming:{centre:'unassigned'}});
   expect(parsed.notes.some(note=>note.includes('ambiguo'))).toBe(true);
   expect(applyCalendarDecisions([], [proposal]).shifts).toEqual([]);
   expect(()=>applyCalendarDecisions([],[{...proposal,action:'add'}])).toThrow(/Selecciona el centro/);
  }
 });

 it('elegir centro aplica su horario antes de añadir y conserva duraciones explícitas',()=>{
  const state=shared();
  for(const timed of [false,true]){
   const parsed=parseCalendar(feed('Guardia hospital',timed),2026,state.settings),proposal=reconcileCalendar([],parsed,'feed')[0];
   const incoming=updateShiftSchedule(proposal.incoming!,{centre:'second'},state.settings);
   expect(incoming).toMatchObject({centre:'second',hours:timed?7.5:16,hoursMode:timed?'custom':'standard'});
   expect(applyCalendarDecisions([],[{...proposal,incoming,action:'add'}]).shifts[0]).toEqual(incoming);
  }
 });

 it('mantiene la revisión de eventos ya vinculados y protege actualizaciones y duplicados por identidad',()=>{
  const state=shared(),parsed=parseCalendar(feed(),2026,state.settings);
  const current={...parsed.shifts[0],id:'saved',centre:'first',hours:13,hoursMode:'custom' as const,status:'confirmed' as const};
  const proposal=reconcileCalendar([current],parsed,'feed')[0];
  expect(proposal).toMatchObject({kind:'ambiguous',action:'keep',needsCentreReview:true,existingId:'saved'});
  expect(applyCalendarDecisions([current],[proposal]).shifts[0]).toMatchObject({centre:'first',hours:13,hoursMode:'custom',status:'confirmed'});
  expect(applyCalendarDecisions([current],[{...proposal,action:'link'}]).shifts[0]).toMatchObject({centre:'first',hours:13,hoursMode:'custom',status:'confirmed'});
  expect(()=>applyCalendarDecisions([current],[{...proposal,action:'update'}])).toThrow(/Selecciona el centro/);
  expect(reconcileCalendar([parsed.shifts[0]],parsed,'feed')[0].kind).toBe('ambiguous');
  const duplicate={...current,id:'duplicate'},duplicates=reconcileCalendar([current,duplicate],parsed,'feed')[0];
  expect(duplicates).toMatchObject({kind:'ambiguous',action:'keep',needsCentreReview:true});
  expect(()=>applyCalendarDecisions([current,duplicate],[{...duplicates,action:'add'}])).toThrow(/Selecciona el centro/);
 });

 it('usa el contexto de centros capturado al leer y no incluye centros conservados',()=>{
  const state=shared(),parsed=parseCalendar(feed(),2026,state.settings);
  state.settings.centres[1].archived=true;
  expect(reconcileCalendar([],parsed,'feed')[0]).toMatchObject({kind:'ambiguous',needsCentreReview:true});
  const reread=parseCalendar(feed(),2026,state.settings);
  expect(reconcileCalendar([],reread,'feed')[0]).toMatchObject({kind:'new',action:'add',needsCentreReview:false,incoming:{centre:'first',hours:12}});
 });
});
