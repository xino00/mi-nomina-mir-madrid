import {useState} from 'react';
import {ArrowRight,Download,ShieldCheck} from 'lucide-react';
import {settingsSchema,buildGradeDates,type Settings,type Centre} from './domain/model';
import {allWorkProfiles,WorkProfileSummary} from './WorkProfiles';
import {Field,NumberField,Notice,SafeForm,Submit,ErrorText,errorMessage} from './ui';

export function Profile({initial,onSave,busy,onImport,onCancel}:{initial:Settings;onSave:(s:Settings)=>Promise<void>;busy:boolean;onImport?:()=>void;onCancel?:()=>void}){
 const fresh=!initial.profileComplete;
 const [s,set]=useState<Settings>(structuredClone(initial));
 const [selected,setSelected]=useState('');
 const selectedProfile=allWorkProfiles(initial).find(p=>p.id===selected);
 const [start,setStart]=useState(fresh?'':initial.residencyStart),[end,setEnd]=useState(initial.residencyEnd??'');
 const [years,setYears]=useState(initial.gradeDates.length===5?5:4),[error,setError]=useState('');
 const [centre,setCentre]=useState<Centre>(initial.centres[0]??{id:crypto.randomUUID(),name:'',municipality:'',labourHours:17,festiveHours:24,aliases:[],localHolidays:{}});
 function resetDates(date:string,count:number){setStart(date);if(date){const dates=buildGradeDates(date,count);set({...s,gradeDates:dates});const d=new Date(`${date}T12:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()+count);d.setUTCDate(d.getUTCDate()-1);setEnd(d.toISOString().slice(0,10));}}
 return <div className={fresh?'onboarding':'profile-form'}>{fresh&&<><div className="wordmark">Mi nómina<span>Medicina · SERMAS Madrid</span></div><p className="eyebrow">En tu dispositivo</p><h1>Tu guardia.<br/>Tu nómina.<br/><em>Tus cuentas.</em></h1><p className="intro">Para médicos residentes MIR R1–R5 del SERMAS, en la Comunidad de Madrid. Calcula tu previsión y compárala con tu recibo. Sin cuenta, también sin conexión.</p>{onImport&&<button type="button" className="secondary import-start" onClick={onImport}><Download size={18}/>Ya tengo una copia JSON</button>}</>}
 <SafeForm onSubmit={async()=>{setError('');try{if(!start||!end)throw new Error('Indica las fechas de inicio y fin.');const next=settingsSchema.parse({...s,residencyStart:start,residencyEnd:end,gradeDates:s.gradeDates.length?s.gradeDates:buildGradeDates(start,years),profileComplete:true,centres:fresh&&!selectedProfile?[centre]:s.centres});await onSave(next);}catch(e){setError(errorMessage(e));}}}>
 <h2>{fresh?'Configura tu residencia':'Perfil de residencia'}</h2><p className="muted">Jornada completa. Puedes ajustar las fechas reales de cambio de año.</p>
 {fresh&&<><Field label="Perfil inicial"><select value={selected} onChange={e=>{
 const id=e.target.value,profile=allWorkProfiles(initial).find(p=>p.id===id);setSelected(id);
 if(profile){const count=profile.residencyYears;setYears(count);let gradeDates=s.gradeDates;
 if(start){gradeDates=buildGradeDates(start,count);const d=new Date(`${start}T12:00:00Z`);d.setUTCFullYear(d.getUTCFullYear()+count);d.setUTCDate(d.getUTCDate()-1);setEnd(d.toISOString().slice(0,10));}
 set({...s,centres:structuredClone(profile.centres),defaultLabourHours:profile.defaultLabourHours,defaultFestiveHours:profile.defaultFestiveHours,payDelay:profile.payDelay,activeWorkProfileId:profile.id,gradeDates});
 }else set({...s,activeWorkProfileId:null});
 }}><option value="">Configurar desde cero</option>{allWorkProfiles(initial).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
 {selectedProfile&&<WorkProfileSummary profile={selectedProfile}/>}</>}
 <Field label="Inicio de residencia"><input type="date" required value={start} onChange={e=>resetDates(e.target.value,years)}/></Field>
 <Field label="Duración prevista"><select value={years} onChange={e=>{const n=Number(e.target.value);setYears(n);resetDates(start,n);}}><option value={4}>4 años</option><option value={5}>5 años</option></select></Field>
 <Field label="Último día de residencia"><input type="date" required value={end} min={start} onChange={e=>setEnd(e.target.value)}/></Field>
 {s.gradeDates.map((g,i)=><Field key={g.grade} label={`Inicio efectivo de R${g.grade}`}><input required type="date" value={g.from} min={start} max={end} onChange={e=>set({...s,gradeDates:s.gradeDates.map((v,j)=>j===i?{...v,from:e.target.value}:v)})}/></Field>)}
 {fresh&&!selectedProfile&&<><h3>Tu primer centro</h3><Field label="Nombre del centro"><input required maxLength={100} placeholder="Hospital o centro de salud" value={centre.name} onChange={e=>setCentre({...centre,name:e.target.value})}/></Field><Field label="Municipio"><input required maxLength={100} placeholder="Municipio donde haces las guardias" value={centre.municipality} onChange={e=>setCentre({...centre,municipality:e.target.value})}/></Field><NumberField label="Horas habituales de hospital en laborable" value={s.defaultLabourHours} min={1} max={24} onChange={v=>set({...s,defaultLabourHours:v??0})}/><NumberField label="Horas habituales en sábado, domingo o festivo" value={s.defaultFestiveHours} min={1} max={24} onChange={v=>set({...s,defaultFestiveHours:v??0})}/><Notice>Torrelodones laborable: 11 h. Las demás guardias usan el horario de hospital, incluidas Cercedilla y Torrelodones en fin de semana. Los festivos locales se revisan en Ajustes → Centros.</Notice></>}
 <NumberField label="Meses de retraso del cobro de guardias" value={s.payDelay} min={0} max={3} onChange={v=>set({...s,payDelay:v??0})}/>
 <Field label="IRPF"><select value={s.taxMode} onChange={e=>set({...s,taxMode:e.target.value as Settings['taxMode']})}><option value="estimate">Estimación del perfil básico</option><option value="manual">Porcentaje de mi nómina</option></select></Field>
 {s.taxMode==='manual'?<NumberField label="Retención de mi nómina (%)" value={s.manualTaxPercent} min={0} max={47} onChange={v=>set({...s,manualTaxPercent:v??0})}/>:<Notice>Estimación para menores de 65, sin descendientes, situación familiar 3. Para otras circunstancias, introduce el porcentaje de tu nómina o el calculado por AEAT.</Notice>}
 <ErrorText error={error}/><div className="actions">{onCancel&&<button type="button" onClick={onCancel}>Cancelar</button>}<Submit busy={busy}>{fresh?<>Empezar <ArrowRight size={18}/></>:'Guardar perfil'}</Submit></div>
 </SafeForm>{fresh&&<p className="privacy-note"><ShieldCheck size={16}/>Tus recibos y guardias se guardan en este dispositivo.</p>}</div>;
}
