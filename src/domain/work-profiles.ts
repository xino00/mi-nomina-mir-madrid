import {legacyCentres,stateSchema,workProfileSchema,type Centre,type Settings,type State,type WorkProfile} from './model';
import {resolveShiftHours,standardShiftHours} from './engine';

export const builtinWorkProfiles:WorkProfile[]=[workProfileSchema.parse({
 id:'mfyc-fjd',name:'MFyC · FJD',residencyYears:4,payDelay:1,defaultLabourHours:17,defaultFestiveHours:24,
 fiscalPreset:'madrid-single-employee',
 centres:structuredClone(legacyCentres.slice(0,3)).map(c=>({...c,scheduleMode:'general',holidayMunicipality:'Madrid',localHolidays:{'2026':['2026-05-15','2026-11-09']},...(c.id==='Hospital'?{
  name:'Fundación Jiménez Díaz',aliases:[...c.aliases,'fjd','fundacion jimenez diaz','jimenez diaz'],
 }:{})})),
})];

/** Optional: old/custom templates without fiscal conditions retain current settings. */
export function fiscalSettingsForProfile(profile:WorkProfile):Partial<Settings>{
 return profile.fiscalPreset?{fiscalPreset:profile.fiscalPreset,taxMode:'estimate',minimumTaxPercent:15,personalMinimum:5550,geographicalMobility:false}:{};
}
function fiscalMatches(profile:WorkProfile,settings:Settings){
 return Object.entries(fiscalSettingsForProfile(profile)).every(([key,value])=>settings[key as keyof Settings]===value);
}

const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const holidays=(c:Centre)=>Object.entries(c.localHolidays).sort(([a],[b])=>a.localeCompare(b)).map(([year,dates])=>[year,[...dates].sort()]);
function hours(c:Centre,s:Settings){
 const settings={...s,centres:[c]};
 return [standardShiftHours(c.id,'labour',settings),standardShiftHours(c.id,'festive',settings)];
}
function sameIdentity(a:Centre,b:Centre){
 if(normalized(a.municipality)!==normalized(b.municipality))return false;
 if(normalized(a.name)===normalized(b.name))return true;
 const fjdNames=['hospital','fjd','hospital fjd','fundacion jimenez diaz','hospital fundacion jimenez diaz','jimenez diaz'];
 return a.id==='Hospital'&&b.id==='Hospital'&&normalized(a.municipality)==='madrid'&&fjdNames.includes(normalized(a.name))&&fjdNames.includes(normalized(b.name));
}
function safeReplacement(a:Centre,old:Settings,b:Centre,next:Settings){
 return sameIdentity(a,b)&&normalized(a.holidayMunicipality??a.municipality)===normalized(b.holidayMunicipality??b.municipality)&&JSON.stringify(hours(a,old))===JSON.stringify(hours(b,next))&&JSON.stringify(holidays(a))===JSON.stringify(holidays(b));
}
function definition(c:Centre,s:Settings){
 // Keep the old signature when the calendar is local to the physical centre.
 // Previously remapped centres then retain their IDs across the schema upgrade.
 const calendar=normalized(c.holidayMunicipality??c.municipality);
 return JSON.stringify({name:normalized(c.name),municipality:normalized(c.municipality),...(calendar!==normalized(c.municipality)?{holidayMunicipality:calendar}:{}),mode:c.scheduleMode??'general',hours:hours(c,s),aliases:[...new Set(c.aliases.map(normalized))].sort(),holidays:holidays(c)});
}
// A stable, bounded ID lets repeated application reuse a protected definition.
function hash(value:string){let n=2166136261;for(let i=0;i<value.length;i++){n^=value.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(36);}

/** Apply working conditions without replacing personal dates, receipts or history. */
export function applyWorkProfile(state:State,input:WorkProfile):State {
 const current=stateSchema.parse(structuredClone(state)),profile=workProfileSchema.parse(structuredClone(input));
 const settings:Settings={...current.settings,...fiscalSettingsForProfile(profile),activeWorkProfileId:profile.id,defaultLabourHours:profile.defaultLabourHours,defaultFestiveHours:profile.defaultFestiveHours,payDelay:profile.payDelay};
 const referenced=new Set(current.shifts.map(s=>s.centre)),centres:Centre[]=[];
 const existing=new Map(current.settings.centres.map(c=>[c.id,c]));
 for(const desired of profile.centres){
  const stableId=`wp-${hash(profile.id+'|'+desired.id)}-${hash(definition(desired,settings))}`;
  let chosen:string|undefined;
  // Prefer a previous remapping even when its original conflicting ID disappeared.
  for(let suffix=0;suffix<=30;suffix++){
   const candidate=suffix?`${stableId}-${suffix}`:stableId,found=existing.get(candidate);
   if(found&&!centres.some(c=>c.id===candidate)&&definition(found,settings)===definition(desired,settings)){chosen=candidate;break;}
  }
  const original=existing.get(desired.id);
  if(!chosen&&!centres.some(c=>c.id===desired.id)&&(!original||(sameIdentity(original,desired)&&(!referenced.has(original.id)||safeReplacement(original,current.settings,desired,settings)))))chosen=desired.id;
  if(!chosen){
   for(let suffix=0;suffix<=30;suffix++){
    const candidate=suffix?`${stableId}-${suffix}`:stableId;
    if(!existing.has(candidate)&&!centres.some(c=>c.id===candidate)){chosen=candidate;break;}
   }
  }
  if(!chosen)throw new Error('No se puede asignar un identificador al centro sin modificar un centro anterior.');
  const {archived:_archived,...active}=desired;
  centres.push({...active,id:chosen});
 }
 for(const old of current.settings.centres){
  if(!referenced.has(old.id)||centres.some(c=>c.id===old.id))continue;
  const before=hours(old,current.settings),after=hours(old,settings);
  // A retained centre also retains its schedule when the new general hours differ.
  centres.push({...old,archived:true,...(JSON.stringify(before)===JSON.stringify(after)?{}:{scheduleMode:'custom' as const,labourHours:before[0],festiveHours:before[1]})});
 }
 if(centres.length>30)throw new Error('El perfil y los centros con guardias superan el límite de 30 centros. Conserva los datos y reduce los centros del perfil.');
 settings.centres=centres;
 const shifts=current.shifts.map(shift=>{
  const previous=resolveShiftHours(shift,current.settings),next=resolveShiftHours(previous,settings);
  return next.hours===previous.hours?previous:{...previous,hoursMode:'custom' as const};
 });
 return stateSchema.parse({...current,settings,shifts});
}

/** Capture reusable conditions only; personal financial records stay in the state. */
export function profileFromSettings(settings:Settings,name:string,id:string):WorkProfile {
 return workProfileSchema.parse(structuredClone({id,name,residencyYears:settings.gradeDates.length===5?5:4,centres:settings.centres.filter(c=>!c.archived),defaultLabourHours:settings.defaultLabourHours,defaultFestiveHours:settings.defaultFestiveHours,payDelay:settings.payDelay,...(fiscalMatches(builtinWorkProfiles[0],settings)?{fiscalPreset:settings.fiscalPreset}:{})}));
}

/** Preserved historical centres do not make the applied profile look modified. */
export function profileMatchesSettings(profile:WorkProfile,settings:Settings):boolean {
 if(!fiscalMatches(profile,settings))return false;
 if(profile.payDelay!==settings.payDelay||profile.defaultLabourHours!==settings.defaultLabourHours||profile.defaultFestiveHours!==settings.defaultFestiveHours)return false;
 const available=settings.centres.filter(c=>!c.archived);
 if(available.length!==profile.centres.length)return false;
 return profile.centres.every(c=>{
  const index=available.findIndex(active=>definition(active,settings)===definition(c,settings));
  if(index<0)return false;
  available.splice(index,1);return true;
 });
}
