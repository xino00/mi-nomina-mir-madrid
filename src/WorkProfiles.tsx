import {useState} from 'react';
import {Copy,Plus,Save,Trash2,Pencil} from 'lucide-react';
import {defaultSettings,workProfileSchema,type Centre,type Settings,type WorkProfile} from './domain/model';
import {builtinWorkProfiles,profileFromSettings,profileMatchesSettings} from './domain/work-profiles';
import {standardShiftHours} from './domain/engine';
import {CentreEditor} from './CentreEditor';
import {Field,NumberField,Notice,SafeForm,Submit,ErrorText,errorMessage} from './ui';

export const allWorkProfiles=(settings:Settings)=>[...builtinWorkProfiles,...settings.savedWorkProfiles];
export function workProfileLabel(settings:Settings){
 const active=allWorkProfiles(settings).find(p=>p.id===settings.activeWorkProfileId);
 return active?active.name+(profileMatchesSettings(active,settings)?'':' · personalizado'):'Configuración propia';
}
const newCentre=():Centre=>({id:crypto.randomUUID(),name:'',municipality:'',labourHours:17,festiveHours:24,scheduleMode:'general',aliases:[],localHolidays:{}});

export function WorkProfileSummary({profile}:{profile:WorkProfile}){
 const conditions={...defaultSettings,...profile};
 return <section className="work-profile-summary" aria-label={`Condiciones de ${profile.name}`}>
  <h3>{profile.name}</h3>
  <p className="muted">{profile.residencyYears} años de referencia · Cobro de guardias: {profile.payDelay===0?'mismo mes':`${profile.payDelay} mes(es) después`}</p>
  <dl className="profile-centres">{profile.centres.map(c=><div key={c.id}>
   <dt>{c.name}<small>{c.municipality}</small></dt>
   <dd><strong>{standardShiftHours(c.id,'labour',conditions)} h / {standardShiftHours(c.id,'festive',conditions)} h</strong><small>laborable / festiva</small></dd>
  </div>)}</dl>
  {profile.id==='mfyc-fjd'&&<p className="muted">Curas, MED/BOXES y Polis se reconocen como FJD; Cerce y Torrelo, como sus centros. Incluye festivos locales de 2026. Horarios configurables según tu jornada.</p>}
 </section>;
}

export function WorkProfiles({settings,busy,onSave,onApply}:{settings:Settings;busy:boolean;onSave:(settings:Settings)=>Promise<void>;onApply:(profile:WorkProfile)=>Promise<void>}){
 const profiles=allWorkProfiles(settings);
 const [selected,setSelected]=useState(settings.activeWorkProfileId??builtinWorkProfiles[0].id);
 const [draft,setDraft]=useState<WorkProfile|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const profile=profiles.find(p=>p.id===selected)??builtinWorkProfiles[0];
 const own=settings.savedWorkProfiles.some(p=>p.id===profile.id);
 const full=settings.savedWorkProfiles.length>=20;
 const edit=(value:WorkProfile)=>{setError('');setNotice('');setDraft(structuredClone(value));};
 async function store(value:WorkProfile){
  const parsed=workProfileSchema.parse({...value,name:value.name.trim()});
  if(profiles.some(p=>p.id!==parsed.id&&p.name.trim().toLocaleLowerCase('es')===parsed.name.toLocaleLowerCase('es')))throw new Error('Ya existe un perfil con ese nombre. Elige otro.');
  const exists=settings.savedWorkProfiles.some(p=>p.id===parsed.id);
  await onSave({...settings,savedWorkProfiles:exists?settings.savedWorkProfiles.map(p=>p.id===parsed.id?parsed:p):[...settings.savedWorkProfiles,parsed]});
  setSelected(parsed.id);setDraft(null);setNotice('Perfil guardado en este dispositivo. Puedes aplicarlo cuando quieras.');
 }
 if(draft)return <WorkProfileEditor initial={draft} busy={busy} onCancel={()=>setDraft(null)} onSave={store}/>;
 return <div className="stack">
  <p className="muted">En uso: <strong>{workProfileLabel(settings)}</strong>. Los perfiles guardan centros, horarios y retraso de cobro. Tus fechas, IRPF, sueldo y recibos se mantienen aparte.</p>
  <Field label="Perfil de condiciones"><select value={profile.id} onChange={e=>{setSelected(e.target.value);setError('');setNotice('');}}>
   <optgroup label="Predeterminados">{builtinWorkProfiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
   {!!settings.savedWorkProfiles.length&&<optgroup label="Mis perfiles">{settings.savedWorkProfiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
  </select></Field>
  <WorkProfileSummary profile={profile}/>
  <Notice>Al aplicar, conservas tus guardias registradas, sus horas y los recibos cobrados. Se mantienen los centros que ya estén usados. El retraso de cobro sí puede cambiar las previsiones mensuales.</Notice>
  <ErrorText error={error}/>{notice&&<p role="status" className="success">{notice}</p>}
  <button className="primary" disabled={busy} onClick={async()=>{setError('');try{await onApply(profile);}catch(e){setError(errorMessage(e));}}}>Aplicar perfil</button>
  <div className="button-grid">
   <button disabled={busy||full} onClick={()=>edit({...structuredClone(profile),id:crypto.randomUUID(),name:`${profile.name} · copia`})}><Copy size={18}/>Duplicar y personalizar</button>
   <button disabled={busy||full} onClick={()=>{try{edit(profileFromSettings(settings,'Mis condiciones',crypto.randomUUID()));}catch(e){setError(errorMessage(e));}}}><Save size={18}/>Guardar condiciones actuales como perfil</button>
   <button disabled={busy||full} onClick={()=>edit({id:crypto.randomUUID(),name:'',residencyYears:4,centres:[newCentre()],defaultLabourHours:17,defaultFestiveHours:24,payDelay:1})}><Plus size={18}/>Crear perfil desde cero</button>
  </div>
  {full&&<p className="muted">Has alcanzado los veinte perfiles propios. Puedes editar uno existente.</p>}
  {own&&<div className="actions">
   <button disabled={busy} onClick={()=>edit(profile)}><Pencil size={18}/>Editar perfil guardado</button>
   <button disabled={busy} onClick={async()=>{
    if(!window.confirm(`¿Eliminar el perfil «${profile.name}»? Tus condiciones actuales y registros se conservan.`))return;
    try{setError('');await onSave({...settings,savedWorkProfiles:settings.savedWorkProfiles.filter(p=>p.id!==profile.id),activeWorkProfileId:settings.activeWorkProfileId===profile.id?null:settings.activeWorkProfileId});setSelected(builtinWorkProfiles[0].id);setNotice('Perfil eliminado. Las condiciones actuales se conservan.');}catch(e){setError(errorMessage(e));}
   }}><Trash2 size={18}/>Eliminar perfil guardado</button>
  </div>}
  <p className="muted">Los perfiles propios viajan en tu copia JSON y quedan en el historial local. No se publican en GitHub.</p>
 </div>;
}

function WorkProfileEditor({initial,busy,onSave,onCancel}:{initial:WorkProfile;busy:boolean;onSave:(profile:WorkProfile)=>Promise<void>;onCancel:()=>void}){
 const [draft,setDraft]=useState(structuredClone(initial)),[error,setError]=useState('');
 const set=<K extends keyof WorkProfile>(key:K,value:WorkProfile[K])=>setDraft({...draft,[key]:value});
 return <SafeForm onSubmit={async()=>{setError('');try{await onSave(draft);}catch(e){setError(errorMessage(e));}}}>
  <h3>Personalizar condiciones</h3><p className="muted">Guardar modifica esta plantilla. Para usar sus condiciones, aplícala después.</p>
  <Field label="Nombre del perfil"><input required maxLength={100} autoFocus value={draft.name} onChange={e=>set('name',e.target.value)}/></Field>
  <Field label="Duración de referencia"><select value={draft.residencyYears} onChange={e=>set('residencyYears',Number(e.target.value) as 4|5)}><option value={4}>4 años</option><option value={5}>5 años</option></select></Field>
  <NumberField label="Horas generales en laborable" value={draft.defaultLabourHours} min={1} max={24} onChange={v=>set('defaultLabourHours',v??0)}/>
  <NumberField label="Horas generales en festivo" value={draft.defaultFestiveHours} min={1} max={24} onChange={v=>set('defaultFestiveHours',v??0)}/>
  <NumberField label="Retraso de cobro del perfil (meses)" value={draft.payDelay} min={0} max={3} onChange={v=>set('payDelay',v??0)}/>
  {draft.centres.map((c,i)=><CentreEditor key={c.id} centre={c} onChange={value=>set('centres',draft.centres.map((old,j)=>j===i?value:old))} canRemove={draft.centres.length>1} onRemove={()=>set('centres',draft.centres.filter((_,j)=>j!==i))}/>)}
  <button type="button" disabled={draft.centres.length>=30} onClick={()=>set('centres',[...draft.centres,newCentre()])}><Plus size={18}/>Añadir centro al perfil</button>
  <ErrorText error={error}/><div className="actions"><button type="button" disabled={busy} onClick={onCancel}>Cancelar edición</button><Submit busy={busy}>Guardar plantilla</Submit></div>
 </SafeForm>;
}
