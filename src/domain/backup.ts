import { buildGradeDates, legacyCentres, stateSchema, type State } from './model';

export const BACKUP_FORMAT='mi-nomina-guardias';
// Older Android versions reject v3 instead of silently dropping custom profiles.
export const BACKUP_VERSION=3;
export function migrateLegacyState(input:unknown):State {
 if(!input||typeof input!=='object')throw new Error('La copia no contiene un estado válido.');
 const legacy=structuredClone(input) as Record<string,unknown>;
 const settings=legacy.settings as Record<string,unknown>|undefined;
 if(!settings||typeof settings.residencyStart!=='string')throw new Error('La copia no contiene las fechas de residencia.');
 const gradeDates=buildGradeDates(settings.residencyStart);
 const end=new Date(gradeDates[4].from+'T12:00:00Z');end.setUTCFullYear(end.getUTCFullYear()+1);end.setUTCDate(end.getUTCDate()-1);
 const centres=structuredClone(legacyCentres);
 const other=centres.find(c=>c.id==='Otro')!;
 other.labourHours=Number(settings.defaultLabourHours);other.festiveHours=Number(settings.defaultFestiveHours);
 return stateSchema.parse({...legacy,settings:{...settings,profileComplete:true,gradeDates,residencyEnd:end.toISOString().slice(0,10),centres}});
}

function cleanState(state:State):State {
 const parsed=stateSchema.parse(state);
 // Connections are stored separately. A legacy feed URL must not leak via provenance.
 return {...parsed,shifts:parsed.shifts.map(shift=>({...shift,sourceCalendar:/^(https?|webcal):/i.test(shift.sourceCalendar)?'':shift.sourceCalendar}))};
}

export function exportBackup(state:State):string {
 return JSON.stringify({format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt:new Date().toISOString(),state:cleanState(state)},null,2);
}

export function parseBackup(input:string|unknown):{state:State;version:1|2|3;migrated:boolean;summary:{shifts:number;receipts:number};warnings:string[]} {
 if(typeof input==='string'&&new TextEncoder().encode(input).length>2_100_000)throw new Error('La copia supera 2 MB.');
 let parsed:unknown;
 try{parsed=typeof input==='string'?JSON.parse(input):input;}catch{throw new Error('El archivo no contiene JSON válido.');}
 if(!parsed||typeof parsed!=='object')throw new Error('Formato de copia no compatible.');
 const document=parsed as Record<string,unknown>;
 if(document.format!==BACKUP_FORMAT||(document.version!==1&&document.version!==2&&document.version!==3))throw new Error('Versión de copia no compatible; no se ha cambiado ningún dato.');
 const state=cleanState(document.version===1?migrateLegacyState(document.state):stateSchema.parse(document.state));
 return {state,version:document.version,migrated:document.version!==3,summary:{shifts:state.shifts.length,receipts:Object.values(state.months).filter(m=>m.actual).length},warnings:document.version===1?['Se han conservado los centros originales. Revisa municipio y fechas efectivas de cambio de año.','La copia anterior no incluía fin de residencia: se proponen cinco años. Corrige la fecha en Ajustes.']:document.version===2?['La copia v2 conserva los horarios generales anteriores. Los perfiles propios y horarios por centro se guardan a partir de la versión 3.']:[]};
}
