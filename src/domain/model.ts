import { z } from 'zod';

const money = z.number().finite().min(0).max(1000000);
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export const dateSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/).refine(s => { const d=new Date(s+'T12:00:00Z'); return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10)===s; },'Fecha inválida');
const date = dateSchema;
const fiscalPresetSchema=z.literal('madrid-single-employee');
const rateRow = z.object({ labour: money.max(100), festive: money.max(100), special: money.max(200) });
export const rates2027=[{labour:13.78,festive:16.39,special:32.78},{labour:16.54,festive:19.14,special:38.28},{labour:19.28,festive:21.88,special:43.76},{labour:22.04,festive:24.62,special:49.24},{labour:22.04,festive:24.62,special:49.24}];
export const centreSchema = z.object({
  id:z.string().min(1).max(100), name:z.string().min(1).max(100), municipality:z.string().min(1).max(100),
  holidayMunicipality:z.string().trim().min(1).max(100).optional(),
  labourHours:z.number().finite().min(.25).max(48), festiveHours:z.number().finite().min(.25).max(48),
  scheduleMode:z.enum(['general','custom']).optional(),
  archived:z.boolean().optional(),
  aliases:z.array(z.string().min(1).max(100)).max(30),
  localHolidays:z.record(z.string().regex(/^20\d{2}$/),z.array(date).max(20)).default({}),
}).superRefine((c,ctx)=>{for(const [year,dates] of Object.entries(c.localHolidays))if(dates.some(d=>!d.startsWith(year+'-')))ctx.addIssue({code:'custom',message:'El festivo local no pertenece al año indicado'});});
export type Centre=z.infer<typeof centreSchema>;
export const workProfileSchema=z.object({
  id:z.string().trim().min(1).max(100),name:z.string().trim().min(1).max(100),
  residencyYears:z.union([z.literal(4),z.literal(5)]),centres:z.array(centreSchema).min(1).max(30),
  defaultLabourHours:z.number().finite().min(1).max(24),defaultFestiveHours:z.number().finite().min(1).max(24),
  payDelay:z.number().int().min(0).max(3),
  fiscalPreset:fiscalPresetSchema.optional(),
}).refine(p=>new Set(p.centres.map(c=>c.id)).size===p.centres.length,'Identificadores de centro duplicados en el perfil');
export type WorkProfile=z.infer<typeof workProfileSchema>;
export const gradeDateSchema=z.object({grade:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]),from:date});
export const settingsSchema = z.object({
  fiscalPreset:fiscalPresetSchema.nullable().default(null),
  savedWorkProfiles:z.array(workProfileSchema).max(20).default([]),activeWorkProfileId:z.string().min(1).max(100).nullable().default(null),
  profileComplete:z.boolean().default(false), residencyEnd:date.nullable().default(null),
  gradeDates:z.array(gradeDateSchema).max(5).default([]), centres:z.array(centreSchema).max(30).default([]),
  fiscalYear:z.number().int().min(2000).max(2099), residencyStart: date, salaryBase: money.max(10000), complements: z.array(money.max(10000)).length(5),
  ratesBefore: z.array(rateRow).length(5), ratesAfter: z.array(rateRow).length(5), rateChangeDate: date, rateVigencies:z.array(z.object({from:date,rates:z.array(rateRow).length(5)})).max(20).default([{from:"2027-01-01",rates:rates2027}]),
  payDelay: z.number().int().min(0).max(3), includePending: z.boolean(),
  expectedLabour: z.number().int().min(0).max(15), expectedFestive: z.number().int().min(0).max(15),
  defaultLabourHours: z.number().min(1).max(24), defaultFestiveHours: z.number().min(1).max(24),
  ccMin: money, atMin: money, contributionMax: money, ccPercent: money.max(10), meiPercent: money.max(5), unemploymentTrainingPercent: money.max(10),
  vacationDivisor: z.number().min(1).max(31), taxMode: z.enum(['estimate','manual']), manualTaxPercent: money.max(47),
  minimumTaxPercent: money.max(15), personalMinimum: money.max(30000), geographicalMobility: z.boolean(),
  annualGrossOverride: money.nullable(), annualSSOverride: money.nullable(),
  accumulatedThrough: month.nullable(), accumulatedGross: money, accumulatedWithheld: money, accumulatedSS:money.nullable().default(null),
}).superRefine((s,ctx)=>{
 if(new Set(s.savedWorkProfiles.map(p=>p.id)).size!==s.savedWorkProfiles.length||s.savedWorkProfiles.some(p=>p.id==='mfyc-fjd'))ctx.addIssue({code:'custom',message:'Los perfiles propios necesitan identificadores únicos y distintos de los predeterminados'});
 if(s.residencyEnd&&s.residencyEnd<s.residencyStart)ctx.addIssue({code:'custom',message:'El fin de residencia no puede preceder al inicio'});
 if(new Set(s.centres.map(c=>c.id)).size!==s.centres.length)ctx.addIssue({code:'custom',message:'Identificadores de centro duplicados'});
 const grades=[...s.gradeDates].sort((a,b)=>a.from.localeCompare(b.from));
 if(new Set(grades.map(g=>g.grade)).size!==grades.length||new Set(grades.map(g=>g.from)).size!==grades.length||grades.some((g,i)=>g.from<s.residencyStart||(i>0&&g.grade<=grades[i-1].grade)))ctx.addIssue({code:'custom',message:'Revisa las fechas y el orden de los años de residencia'});
 if(s.profileComplete&&(!s.centres.some(c=>!c.archived)||grades.length===0||grades[0]?.grade!==1||grades[0]?.from!==s.residencyStart))ctx.addIssue({code:'custom',message:'Completa al menos un centro activo y las fechas de residencia antes de calcular'});
}).refine(s=>new Set(s.rateVigencies.map(v=>v.from)).size===s.rateVigencies.length,'Cada vigencia debe comenzar en una fecha distinta').refine(s=>s.contributionMax>=s.ccMin && s.contributionMax>=s.atMin,'La base máxima debe superar a las mínimas');
export const shiftSchema = z.object({
  id:z.string().min(1).max(200), date, title:z.string().min(1).max(180), centre:z.string().min(1).max(100),
  hours:z.number().finite().min(0.25).max(48), hoursMode:z.enum(['standard','custom']).optional(), type:z.enum(['labour','festive','special']), located:z.boolean(),
  customRate:money.max(200).nullable(), gradeOverride:z.number().int().min(1).max(5).nullable(),
  status:z.enum(['pending','confirmed','excluded']), sourceKey:z.string().max(400), sourceSignature:z.string().max(500),
  sourceNote:z.string().max(300), sourceCalendar:z.string().max(100).default(''),
});
export const actualSchema = z.object({gross:money,ss:money,withheld:money,guardGross:money,otherDeductions:money.default(0),net:z.number().finite().min(-100000).max(1000000),source:z.string().max(250)})
  .refine(a=>a.guardGross<=a.gross,'Las guardias no pueden superar el bruto total')
  .refine(a=>Math.abs(a.gross-a.ss-a.withheld-a.otherDeductions-a.net)<0.025,'El neto debe coincidir con bruto menos cotizaciones, retención y otros descuentos');
export const monthSchema = z.object({receiptHashes:z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(100).default([]),vacationDays:z.number().min(0).max(31),vacationOverride:money.nullable(),extraOverride:money.nullable(),otherGross:money,ssOverride:money.nullable(),taxOverride:money.max(47).nullable(),guardGrossOverride:money.nullable(),actual:actualSchema.nullable()});
export const stateSchema = z.object({appliedCalendarImports:z.array(z.string().min(1).max(200)).max(200).default([]),settings:settingsSchema,shifts:z.array(shiftSchema).max(1500),months:z.record(month,monthSchema),closedShiftMonths:z.array(month).max(120),importedAt:z.string().max(60)}).superRefine((s,ctx)=>{
 if(new Set(s.shifts.map(x=>x.id)).size!==s.shifts.length)ctx.addIssue({code:'custom',message:'Identificadores de guardia duplicados'});
 if(s.shifts.some(shift=>shift.status==='confirmed'&&shift.centre!=='unassigned'&&!s.settings.centres.some(c=>c.id===shift.centre)))ctx.addIssue({code:'custom',message:'Selecciona un centro configurado o el horario de hospital antes de confirmar la guardia'});
});
export type Settings=z.infer<typeof settingsSchema>;
export type Shift=z.infer<typeof shiftSchema>;
export type MonthInput=z.infer<typeof monthSchema>;
export type State=z.infer<typeof stateSchema>;
export const blankMonth=():MonthInput=>({receiptHashes:[],vacationDays:0,vacationOverride:null,extraOverride:null,otherGross:0,ssOverride:null,taxOverride:null,guardGrossOverride:null,actual:null});
export const defaultSettings:Settings={
  fiscalPreset:null,
  savedWorkProfiles:[],activeWorkProfileId:null,
  profileComplete:false,residencyEnd:null,gradeDates:[],centres:[],
  fiscalYear:2026,residencyStart:'2026-01-01',salaryBase:1387.24,complements:[138.31,249.29,388.01,526.74,665.46],
  ratesBefore:[{labour:12.50,festive:14.87,special:29.74},{labour:15,festive:17.36,special:34.72},{labour:17.49,festive:19.85,special:39.70},{labour:19.99,festive:22.33,special:44.66},{labour:19.99,festive:22.33,special:44.66}],
  ratesAfter:[{labour:13.13,festive:15.61,special:31.22},{labour:15.75,festive:18.23,special:36.46},{labour:18.36,festive:20.84,special:41.68},{labour:20.99,festive:23.45,special:46.90},{labour:20.99,festive:23.45,special:46.90}],
  rateVigencies:[{from:'2027-01-01',rates:rates2027}],rateChangeDate:'2026-07-01',payDelay:1,includePending:true,expectedLabour:0,expectedFestive:0,defaultLabourHours:17,defaultFestiveHours:24,
  ccMin:1989.30,atMin:1424.40,contributionMax:5101.20,ccPercent:4.7,meiPercent:0.15,unemploymentTrainingPercent:1.7,
  vacationDivisor:22,taxMode:'estimate',manualTaxPercent:20,minimumTaxPercent:15,personalMinimum:5550,geographicalMobility:false,
  annualGrossOverride:null,annualSSOverride:null,accumulatedThrough:null,accumulatedGross:0,accumulatedWithheld:0,accumulatedSS:null,
};
export function defaultState():State{return {appliedCalendarImports:[],settings:structuredClone(defaultSettings),shifts:[],months:{},closedShiftMonths:[],importedAt:''};}
export const sources=[
 {title:'Tarifas de guardia desde julio 2026 y enero 2027 · BOCM',url:'https://www.bocm.es/boletin/CM_Orden_BOCM/2026/07/30/BOCM-20260730-9.PDF',note:'Vigencia por fecha trabajada; el cobro se desplaza al mes siguiente. Festivos especiales: doble propuesto, revisable.'},
 {title:'Festivos locales de 2026 · BOCM 12/12/2025',url:'https://www.bocm.es/boletin/CM_Orden_BOCM/2025/12/12/BOCM-20251212-34.PDF',note:'Madrid: 15 de mayo y 9 de noviembre. Cercedilla: 20 de enero y 8 de septiembre. Torrelodones: 16 de julio y 14 de agosto.'},
 {title:'Calendario laboral de Madrid 2026',url:'https://www.comunidad.madrid/empleo/calendario-laboral-comunidad-madrid-municipios',note:'Festivos autonómicos y locales por municipio. La detección de otros ejercicios queda pendiente de revisar.'},
 {title:'Retribuciones MIR, extras y vacaciones · BOCM 09/02/2026',url:'https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/09/BOCM-20260209-6.PDF',note:'Artículo 28 y anexo V.6. Sueldo y tarifas previas verificados.'},
 {title:'Retenciones AEAT 2026',url:'https://sede.agenciatributaria.gob.es/Sede/Retenciones.shtml',note:'Previsión de retenciones para trabajador activo, menor de 65 años, situación familiar 3 sin descendientes. Se calcula por separado de la Renta anual.'},
 {title:'IRPF estatal · Ley 35/2006',url:'https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764',note:'Renta 2026 básica: arts. 19, 20, 57 y 63 y DA 61. Solo rendimientos del trabajo, declaración individual y menor de 65 años.'},
 {title:'IRPF de Madrid · Decreto Legislativo 1/2010',url:'https://www.boe.es/buscar/act.php?id=BOCM-m-2010-90068',note:'Arts. 1 y 2: escala autonómica y mínimo personal madrileño. Sin deducciones personales adicionales.'},
 {title:'Cotizaciones 2026 · BOE 31/03/2026',url:'https://www.boe.es/boe/dias/2026/03/31/pdfs/BOE-A-2026-7296.pdf',note:'Bases mínima/máxima, CC, MEI y solidaridad. Desempleo y formación según modalidad contractual; confirma los porcentajes aplicables.'},
 {title:'Exportar Google Calendar',url:'https://support.google.com/calendar/answer/37111?hl=es',note:'Importación por archivo .ics o dirección secreta iCal. El enlace privado se conecta por separado y no se incluye en las copias.'},
];

/** Generate anniversaries; users may replace each date with their actual progression. */
export function buildGradeDates(start:string,years=5):Settings['gradeDates'] {
 date.parse(start);
 return Array.from({length:Math.min(5,Math.max(1,years))},(_,i)=>{
  const year=Number(start.slice(0,4))+i;
  // A 29 February anniversary falls on 28 February in non-leap years.
  const proposed=`${year}${start.slice(4)}`;
  const from=date.safeParse(proposed).success?proposed:`${year}-02-28`;
  return {grade:(i+1) as 1|2|3|4|5,from};
 });
}
export const legacyCentres:Centre[]=[
 {id:'Hospital',name:'Hospital',municipality:'Madrid',labourHours:17,festiveHours:24,aliases:['hospital','curas','med','boxes','polis'],localHolidays:{'2026':['2026-05-15','2026-11-09']}},
 {id:'SAR Cercedilla',name:'SAR Cercedilla',municipality:'Cercedilla',labourHours:17,festiveHours:24,aliases:['cercedilla','cerce'],localHolidays:{'2026':['2026-01-20','2026-09-08']}},
 {id:'SAR Torrelodones',name:'SAR Torrelodones',municipality:'Torrelodones',labourHours:11,festiveHours:24,aliases:['torrelodones','torrelo'],localHolidays:{'2026':['2026-07-16','2026-08-14']}},
 {id:'Otro',name:'Otro (revisar municipio)',municipality:'Por revisar',labourHours:17,festiveHours:24,aliases:[],localHolidays:{}},
];
export type Actual=z.infer<typeof actualSchema>;
