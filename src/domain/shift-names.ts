import type { Shift, Settings } from './model';

// Keep the historical signature normalizer stable for repeat imports.
export const normalizedShiftTitle=(title:string)=>title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function shiftTitleWords(title:string){
 const separated=title.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,'$1 $2');
 return normalizedShiftTitle(separated).replace(/[^a-z0-9]+/g,' ')
  .replace(/\b(guardias?|gdia|gda|grd)(?=curas?|med|box|poli|cerce|torre|sar|rural|r[1-5]|\d)/g,'$1 ')
  .trim().split(/\s+/).filter(Boolean);
}

// Bounded Damerau-Levenshtein distance also catches adjacent swapped letters.
function closeWord(a:string,b:string,max:number){
 if(a===b)return true;
 if(Math.abs(a.length-b.length)>max)return false;
 const rows=Array.from({length:a.length+1},(_,i)=>Array.from({length:b.length+1},(_,j)=>i===0?j:j===0?i:0));
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
 }
 return rows[a.length][b.length]<=max;
}

function configuredMatches(title:string,s:Pick<Settings,'centres'>){
 const normalized=' '+shiftTitleWords(title).join(' ')+' ';
 return s.centres.filter(c=>!c.archived&&[c.name,...c.aliases].some(alias=>{
  const word=shiftTitleWords(alias).join(' ');return word.length>0&&normalized.includes(' '+word+' ');
 }));
}
export function detectShiftTitle(title:string,s?:Pick<Settings,'centres'>):{centre:string;label:string;reason:string;ambiguous:boolean}{
 if(s){
  const activeCentres=s.centres.filter(c=>!c.archived);
  const matches=configuredMatches(title,s);
  if(matches.length>1)return {centre:'unassigned',label:'Centro por revisar',reason:'El título coincide con varios centros activos. Selecciona el centro para aplicar su horario y sus festivos.',ambiguous:true};
  // Keep a configured municipality when available, but a missing hospital
  // identity does not prevent applying the user's standard guard timetable.
  const historic=detectShiftTitle(title);
  if(matches.length===0&&!historic.ambiguous&&activeCentres.some(c=>c.id===historic.centre))return historic;
  if(matches.length===0&&!historic.ambiguous){
   const compatible=activeCentres.filter(c=>historic.centre==='Hospital'?c.aliases.some(alias=>normalizedShiftTitle(alias)==='hospital'):detectShiftTitle(c.name).centre===historic.centre);
   if(compatible.length===1)return {...historic,centre:compatible[0].id,label:compatible[0].name};
   if(compatible.length>1)return {centre:'unassigned',label:'Centro por revisar',reason:'Hay varios centros activos compatibles con el título: selecciona el centro de la guardia.',ambiguous:true};
  }
  if(matches.length===1)return {centre:matches[0].id,label:matches[0].name,reason:`Centro reconocido: ${matches[0].name}.`,ambiguous:false};
  if(historic.ambiguous)return {centre:'unassigned',label:'Horario por revisar',reason:'El título es ambiguo: revisa si se aplica el horario laborable de Torrelodones.',ambiguous:true};
  const rural=historic.centre==='SAR Torrelodones'||historic.centre==='SAR Cercedilla';
  return {centre:'unassigned',label:rural?historic.centre.replace('SAR ',''):'Horario de hospital',reason:historic.centre==='SAR Torrelodones'?'Torrelodones: 11 h laborables y horario de hospital en festivos.':'Horario de hospital; no es necesario identificar el hospital.',ambiguous:false};
 }
 const words=shiftTitleWords(title),candidates=[...words,...words.slice(0,-1).map((word,i)=>word+words[i+1])];
 const cercedilla=words.some(x=>['cerce','cerced','cercedi'].includes(x))||candidates.some(x=>closeWord(x,'cercedilla',2));
 const torrelodones=words.some(x=>['torrelo','torrelod','torrelodo'].includes(x))||candidates.some(x=>closeWord(x,'torrelodones',2));
 const weakC=words.some(x=>['cer','cerc'].includes(x)),weakT=words.some(x=>['torre','torr'].includes(x));
 const ambiguous=(cercedilla&&torrelodones)||(!cercedilla&&!torrelodones&&(weakC||weakT))||(cercedilla&&weakT&&!torrelodones)||(torrelodones&&weakC&&!cercedilla);
 const centre:Shift['centre']=ambiguous?'Otro':cercedilla?'SAR Cercedilla':torrelodones?'SAR Torrelodones':'Hospital';
 const areas=centre==='Hospital'?[
  ...(words.some(x=>x==='cura'||closeWord(x,'curas',1))?['Curas']:[]),
  ...(words.some(x=>['med','medicina','medboxes','medbox','box','boxs'].includes(x)||closeWord(x,'boxes',1))?['MED/BOXES']:[]),
  ...(words.some(x=>x==='poli'||closeWord(x,'polis',1))?['Polis']:[]),
 ]:[];
 const label=ambiguous?'Centro por revisar':areas.length?`${centre} · ${areas.join(' / ')}`:centre;
 const exact=centre==='SAR Cercedilla'?words.includes('cercedilla'):centre==='SAR Torrelodones'?candidates.includes('torrelodones'):false;
 const reason=ambiguous?(cercedilla&&torrelodones?'Aparecen variantes de ambos centros rurales: elige el centro.':'Abreviatura de centro ambigua: elige Cercedilla, Torrelodones u hospital.'):
  centre==='Hospital'?'Hospital: el título no menciona un centro rural ni una variante reconocida.':`${centre}: ${exact?'identificado en el título':'abreviatura o errata reconocida en el título'}.`;
 return {centre,label,reason,ambiguous};
}
export function shiftCentreLabel(shift:Shift,s?:Settings){
 const configured=s?.centres.find(c=>c.id===shift.centre);if(configured)return configured.name;
 if(shift.centre==='unassigned'){const named=detectShiftTitle(shift.title);return named.ambiguous?'Horario por revisar':named.centre==='Hospital'?'Horario de hospital':named.centre.replace('SAR ','');}
 const detected=detectShiftTitle(shift.title,s);return shift.centre===detected.centre?detected.label:shift.centre;
}

function guardWord(word:string){return ['g','gdia','gda','grd','sar'].includes(word)||closeWord(word,'guardia',1)||closeWord(word,'guardias',1);}
export function isGuardEventTitle(title:string,s?:Settings){
 const words=shiftTitleWords(title),index=words.findIndex(guardWord);
 if(index<0||words.some(word=>closeWord(word,'saliente',1)||closeWord(word,'salientes',1)))return false;
 if(words.some((word,i)=>guardWord(word)&&words.slice(Math.max(0,i-2),i).some(x=>x==='sin'||x==='no')))return false;
 if(words.slice(0,index).some(word=>['cambio','cambios','cambiar','elegir','eleccion'].includes(word)))return false;
 // A single-letter abbreviation needs a recognisable guard context.
 if(words[index]==='g'){
  if(s){const detected=detectShiftTitle(title,s),historic=detectShiftTitle(title);return configuredMatches(title,s).length>0||(!detected.ambiguous&&(detected.centre!=='unassigned'||(!historic.ambiguous&&historic.label!=='Hospital')));}
  return detectShiftTitle(title).label!=='Hospital';
 }
 return true;
}
