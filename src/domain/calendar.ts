import ICAL from 'ical.js';
import { classifyShiftDay, standardShiftHours, detectShiftTitle, normalizedShiftTitle, isGuardEventTitle } from './engine';
import { shiftSchema, type Shift, type Settings } from './model';

export type CalendarEvent={id:string;date:string;title:string;start:string;end:string;allDay:boolean;cancelled?:boolean};
const norm=normalizedShiftTitle;
export function eventToShift(event:CalendarEvent,s:Settings):Shift{
 const name=norm(event.title),detected=detectShiftTitle(event.title,s),centre=detected.centre,day=classifyShiftDay(event.date,centre,s);
 const type=day.type;let hours=standardShiftHours(centre,type,s,event.title);let hoursMode:Shift['hoursMode']='standard';
 let note='Día completo: horas propuestas. Revisa la duración y el tipo.';
 if(!event.allDay){const duration=(new Date(event.end).valueOf()-new Date(event.start).valueOf())/3600000;if(Number.isFinite(duration)&&duration>0&&duration<=48){hours=duration;hoursMode='custom';note='Horas calculadas del horario del evento. Revisa el tipo de guardia.';}}
 if(event.cancelled)note='El calendario marca este evento como cancelado.';
 if(/cambiar|pendiente|\?/.test(name))note+=' El título indica un cambio pendiente.';
 note+=` ${detected.reason} ${day.reason}`;
 return {id:crypto.randomUUID(),date:event.date,title:event.title.slice(0,180),centre,hours:Math.round(hours*100)/100,hoursMode,type,located:false,customRate:null,gradeOverride:null,status:event.cancelled?'excluded':'pending',sourceCalendar:'',sourceKey:event.id.replace(/@google.com(?=\||$)/,'').slice(0,400),sourceSignature:`${event.date}|${norm(event.title)}|${event.allDay?'day':new Date(event.start).toISOString()}`.slice(0,500),sourceNote:note.slice(0,300)};
}
export function parseCalendar(text:string,year:number,s:Settings){
 const relevant=(title:string)=>isGuardEventTitle(title,s);
 if(text.length>2000000)throw new Error('El calendario supera 2 MB. Exporta solo el calendario de guardias.');
 if(!text.includes('BEGIN:VCALENDAR'))throw new Error('Selecciona el archivo .ics que contiene el calendario. Si has descargado un ZIP, extráelo primero.');
 const root=new ICAL.Component(ICAL.parse(text));
 for(const zone of root.getAllSubcomponents('vtimezone')){const id=zone.getFirstPropertyValue('tzid');if(id)ICAL.TimezoneService.register(new ICAL.Timezone(zone),String(id));}
 const components=root.getAllSubcomponents('vevent');const notes:string[]=[];const shifts:Shift[]=[];const observations:{key:string;kind:string;date:string;shift?:Shift}[]=[];const seen=new Set<string>();
 const from=`${year-1}-12-01`,until=`${year+1}-01-01`;
 const exceptions=new Map<string,ICAL.Event[]>();
 for(const c of components){if(c.hasProperty('recurrence-id')){const e=new ICAL.Event(c);exceptions.set(e.uid,[...(exceptions.get(e.uid)??[]),e]);}}
 let iterations=0;
 function add(event:ICAL.Event,start:ICAL.Time,end:ICAL.Time,key:string){

  const explicitZone=!start.isDate&&start.zone.tzid!=='floating';
  const date=explicitZone?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(start.toJSDate()):start.toString().slice(0,10);
  const sourceKey=key.replace(/@google.com(?=\||$)/,'').slice(0,400);
  if(seen.has(sourceKey))return;seen.add(sourceKey);
  const cancelled=String(event.component.getFirstPropertyValue('status'))==='CANCELLED';
  observations.push({key:sourceKey,date,kind:cancelled?'cancelled':!relevant(event.summary??'')?'nonGuard':'guard'});
  if(!relevant(event.summary??''))return;
  const toStamp=(v:ICAL.Time)=>v.isDate?v.toString():v.zone.tzid==='floating'?v.toString():v.toJSDate().toISOString();
  const shift=eventToShift({id:key,date,title:event.summary,start:toStamp(start),end:toStamp(end),allDay:start.isDate,cancelled},s);observations[observations.length-1].shift=shift;if(date>=from&&date<until)shifts.push(shift);
 }
 for(const component of components){
  if(component.hasProperty('recurrence-id'))continue;
  const event=new ICAL.Event(component);if(!event.startDate){if(String(component.getFirstPropertyValue('status'))==='CANCELLED')observations.push({key:event.uid.replace(/@google.com(?=\||$)/,''),kind:'cancelled',date:''});continue;}
  for(const ex of exceptions.get(event.uid)??[]){if(ex.startDate){event.relateException(ex);}if(ex.startDate)add(ex,ex.startDate,ex.endDate,`${event.uid}|${ex.recurrenceId.toString()}`);else if(String(ex.component.getFirstPropertyValue('status'))==='CANCELLED')observations.push({key:`${event.uid}|${ex.recurrenceId.toString()}`.replace(/@google.com(?=\||$)/,''),kind:'cancelled',date:''});if(ex.component.getFirstProperty('recurrence-id')?.getParameter('range'))notes.push('Hay un cambio de recurrencia «esta y futuras»: revisa las fechas resultantes.');}
  if(!event.isRecurring()){add(event,event.startDate,event.endDate,event.uid);continue;}

  const iterator=event.iterator();let next:ICAL.Time|null;
  while((next=iterator.next())){
   if(++iterations>20000)throw new Error('La recurrencia es demasiado extensa. Exporta un calendario con menos eventos.');
   if(next.toString().slice(0,10)>=until)break;
   const cancelledException=(exceptions.get(event.uid)??[]).find(e=>e.recurrenceId.toString()===next!.toString()&&!e.startDate);if(cancelledException)continue;
   const occurrence=event.getOccurrenceDetails(next);
   add(occurrence.item,occurrence.startDate,occurrence.endDate,`${event.uid}|${next.toString()}`);
  }
 }
 for(const [uid,list] of exceptions){if(components.some(c=>!c.hasProperty('recurrence-id')&&c.getFirstPropertyValue('uid')===uid))continue;for(const ex of list){if(ex.startDate)add(ex,ex.startDate,ex.endDate,`${uid}|${ex.recurrenceId.toString()}`);else if(String(ex.component.getFirstPropertyValue('status'))==='CANCELLED')observations.push({key:`${uid}|${ex.recurrenceId.toString()}`.replace(/@google.com(?=\||$)/,''),kind:'cancelled',date:''});}}
 if(shifts.length>1500)throw new Error('Demasiadas guardias para un ejercicio. Revisa el calendario seleccionado.');
 const cancelled=shifts.filter(x=>x.status==='excluded').length;if(cancelled)notes.push(`${cancelled} eventos cancelados; comprueba si sustituyen guardias ya cargadas.`);
 const ambiguous=shifts.filter(x=>detectShiftTitle(x.title,s).ambiguous).length;if(ambiguous)notes.push(`${ambiguous} eventos tienen un horario ambiguo. Revisa sus horas antes de confirmarlos.`);
 if(year!==2026)notes.push('Festivos locales y autonómicos verificados solo para 2026. Revisa los de este ejercicio.');
 notes.push('Se importan guardias del año elegido y diciembre anterior. Los salientes no son guardias.');
 return {shifts:shifts.sort((a,b)=>a.date.localeCompare(b.date)),notes,observations,from,until};
}
export function mergeShifts(existing:Shift[],incoming:Shift[],replace=false){
 const result=[...existing];let added=0,skipped=0,updated=0;
 for(const item of incoming){const i=result.findIndex(x=>(item.sourceKey&&x.sourceKey===item.sourceKey)||(item.sourceSignature&&x.sourceSignature===item.sourceSignature));
  if(i>=0){if(replace){result[i]={...item,id:result[i].id};updated++;}else skipped++;}
  else {result.push(item);added++;}
 }
 if(result.length>1500)throw new Error('Se ha alcanzado el límite de guardias.');
 return {shifts:result.sort((a,b)=>a.date.localeCompare(b.date)),added,skipped,updated};
}

export type Proposal={id:string;kind:'new'|'modified'|'cancelled'|'missing'|'manualMatch'|'ambiguous'|'unchanged';existingId?:string;incoming?:Shift;current?:Shift;detail:string;action:'keep'|'add'|'update'|'link'|'exclude'};
function reconcileIncoming(existing:Shift[],incoming:Shift):Proposal{
 const byKey=existing.filter(x=>incoming.sourceKey&&x.sourceKey===incoming.sourceKey);
 const candidates=byKey.length?byKey:existing.filter(x=>!x.sourceKey&&incoming.sourceSignature&&x.sourceSignature===incoming.sourceSignature);
 if(candidates.length>1)return {id:incoming.id,kind:'ambiguous',incoming,detail:'Varios registros comparten la identidad de este evento. Revisa las guardias existentes antes de importarlo.',action:'keep'};
 const current=candidates[0];
 if(current){
  const changes=(['date','title','centre','hours','type'] as const).filter(k=>current[k]!==incoming[k]);
  const kind=incoming.status==='excluded'&&current.status!=='excluded'?'cancelled':changes.length?'modified':'unchanged';
  return {id:incoming.id,kind,existingId:current.id,current,incoming,detail:changes.map(k=>`${k}: ${current[k]} → ${incoming[k]}`).join(' · '),action:'keep'};
 }
 // An unspecified hospital cannot rule out a manual guard on the same day.
 const manual=existing.filter(x=>!x.sourceKey&&x.date===incoming.date&&(x.centre===incoming.centre||x.centre==='unassigned'||incoming.centre==='unassigned'));
 const candidate=manual.length===1?manual[0]:undefined;
 const uncertainHours=incoming.centre==='unassigned'&&detectShiftTitle(incoming.title).ambiguous;
 return {id:incoming.id,kind:manual.length>1||uncertainHours?'ambiguous':candidate?'manualMatch':'new',existingId:candidate?.id,current:candidate,incoming,detail:manual.length?'Hay una guardia manual el mismo día. Vincular conserva sus correcciones.':uncertainHours?'El título no permite decidir si se aplica el horario laborable de Torrelodones. Revisa las horas.':'Nueva guardia detectada.',action:manual.length||incoming.status==='excluded'||uncertainHours?'keep':'add'};
}

export function reconcileCalendar(existing:Shift[],parsed:ReturnType<typeof parseCalendar>,sourceCalendar=''):Proposal[]{
 const proposals:Proposal[]=[],matched=new Set<string>();
 const moved=parsed.observations.filter(o=>o.shift&&(o.date<parsed.from||o.date>=parsed.until)&&existing.some(x=>x.sourceKey===o.key)).map(o=>o.shift!);
 for(const original of [...parsed.shifts,...moved]){
  const incoming={...original,sourceCalendar};
  const proposal=reconcileIncoming(existing,incoming);
  if(proposal.existingId)matched.add(proposal.existingId);
  proposals.push(proposal);
 }
 for(const current of existing){
  if(!current.sourceKey||matched.has(current.id))continue;
  const observation=parsed.observations.find(o=>o.key===current.sourceKey||(o.kind==='cancelled'&&!o.key.includes('|')&&current.sourceKey.startsWith(o.key+'|')));
  const cancelled=observation&&(observation.kind!=='guard');
  const absent=!observation&&current.date>=parsed.from&&current.date<parsed.until&&sourceCalendar&&current.sourceCalendar===sourceCalendar;
  if((cancelled||absent)&&current.status!=='excluded')proposals.push({id:'old-'+current.id,kind:cancelled?'cancelled':'missing',existingId:current.id,current,detail:cancelled?'El evento fue cancelado, movido fuera del periodo o dejó de ser guardia.':'No aparece en esta lectura del mismo calendario. Revisa antes de excluir.',action:'keep'});
 }
 return proposals;
}
export function applyCalendarDecisions(existing:Shift[],decisions:Proposal[]){
 const result=[...existing],used=new Set<string>();let added=0,updated=0,linked=0,excluded=0;
 for(const d of decisions){
  if(d.action==='keep'){const i=existing.findIndex(x=>x.id===d.existingId);if(i>=0&&d.incoming?.sourceCalendar&&d.incoming.sourceKey===existing[i].sourceKey&&!existing[i].sourceCalendar){result[i]={...result[i],sourceCalendar:d.incoming.sourceCalendar};linked++;}continue;}
  const index=d.existingId?result.findIndex(x=>x.id===d.existingId):-1;
  if(d.existingId&&(index<0||used.has(d.existingId)))throw new Error('Una guardia se ha seleccionado más de una vez. Revisa la importación.');
  if(d.existingId)used.add(d.existingId);
  if(d.action==='exclude'&&index>=0){result[index]={...result[index],status:'excluded'};excluded++;continue;}
  if(!d.incoming)throw new Error('Falta la propuesta de calendario.');
  const incoming=shiftSchema.parse(d.incoming);if((d.action==='link'||d.action==='update')&&incoming.sourceKey&&result.some((x,i)=>i!==index&&x.sourceKey===incoming.sourceKey))throw new Error('El evento ya está vinculado a otra guardia.');
  if(d.action==='add'){
   if(result.some(x=>x.id===incoming.id||(incoming.sourceKey&&x.sourceKey===incoming.sourceKey)))throw new Error('Este evento ya está vinculado. Lee de nuevo el calendario.');
   result.push(incoming);added++;
  }else if(d.action==='link'&&index>=0){result[index]={...result[index],sourceKey:incoming.sourceKey,sourceSignature:incoming.sourceSignature,sourceCalendar:incoming.sourceCalendar};linked++;}
  else if(d.action==='update'&&index>=0){result[index]={...incoming,id:result[index].id,status:result[index].status==='excluded'?'excluded':incoming.status};updated++;}
  else throw new Error('Decisión de calendario inválida.');
 }
 if(result.length>1500)throw new Error('Se ha alcanzado el límite de guardias.');
 return {shifts:result.sort((a,b)=>a.date.localeCompare(b.date)),added,updated,linked,excluded};
}
