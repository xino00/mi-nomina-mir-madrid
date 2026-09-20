import {useState} from 'react';
import type {Centre} from './domain/model';
import {Field,NumberField} from './ui';

export function CentreEditor({centre:c,onChange,canRemove,onRemove}:{centre:Centre;onChange:(c:Centre)=>void;canRemove:boolean;onRemove:()=>void}){
 const [year,setYear]=useState('2026');
 const [aliasesText,setAliasesText]=useState(c.aliases.join(', '));
 const [dates,setDates]=useState((c.localHolidays[year]??[]).join('\n'));
 if(c.archived)return <fieldset className="centre-editor"><legend>{c.name} · conservado</legend><p className="muted">Centro usado por guardias anteriores. Conserva su municipio ({c.municipality}) y horario para no cambiar tus registros. Las nuevas importaciones utilizan los centros activos del perfil.</p>{canRemove&&<button type="button" onClick={onRemove}>Quitar centro</button>}</fieldset>;
 return <fieldset className="centre-editor"><legend>{c.name||'Nuevo centro'}</legend>
  <Field label="Nombre del centro"><input required maxLength={100} value={c.name} onChange={e=>onChange({...c,name:e.target.value})}/></Field>
  <Field label="Municipio"><input required maxLength={100} value={c.municipality} onChange={e=>{
   if(!c.holidayMunicipality)setDates('');onChange({...c,municipality:e.target.value,...(!c.holidayMunicipality?{localHolidays:{}}:{})});
  }}/></Field>
  <Field label="Municipio del calendario" hint="Vacío: el municipio del centro. Puedes aplicar el calendario de Madrid capital a un centro situado en otro municipio."><input aria-label="Municipio del calendario" maxLength={100} value={c.holidayMunicipality??''} placeholder={c.municipality} onChange={e=>{
   setDates('');onChange({...c,holidayMunicipality:e.target.value.trim()||undefined,localHolidays:{}});
  }}/></Field>
  <Field label="Horario del centro"><select value={c.scheduleMode??'general'} onChange={e=>onChange({...c,scheduleMode:e.target.value as 'general'|'custom'})}>
   <option value="general">Horario general</option><option value="custom">Horario propio</option>
  </select></Field>
  {c.scheduleMode==='custom'?<>
   <NumberField label="Horas laborables del centro" value={c.labourHours} min={.25} max={48} onChange={v=>onChange({...c,labourHours:v??0})}/>
   <NumberField label="Horas festivas del centro" value={c.festiveHours} min={.25} max={48} onChange={v=>onChange({...c,festiveHours:v??0})}/>
  </>:<p className="muted">Sigue las horas generales. Torrelodones mantiene 11 h en laborable; en sábado, domingo o festivo sigue el horario general.</p>}
  <Field label="Nombres en tu calendario" hint="Alias separados por comas; por ejemplo, abreviaturas del centro."><input value={aliasesText} onChange={e=>{
   setAliasesText(e.target.value);onChange({...c,aliases:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)});
  }}/></Field>
  <Field label="Año de festivos locales"><input type="number" min="2000" max="2099" step="1" required value={year} onChange={e=>{setYear(e.target.value);setDates((c.localHolidays[e.target.value]??[]).join('\n'));}}/></Field>
  <Field label={`Festivos locales ${year}`} hint={`Calendario de ${c.holidayMunicipality??c.municipality}. Una fecha AAAA-MM-DD por línea; cambiar el municipio del calendario requiere introducir sus fechas.`}><textarea rows={3} value={dates} placeholder={`${year}-MM-DD`} onChange={e=>{
   setDates(e.target.value);const list=e.target.value.split(/[\n,]/).map(v=>v.trim()).filter(Boolean);const holidays={...c.localHolidays};
   if(list.length)holidays[year]=list;else delete holidays[year];onChange({...c,localHolidays:holidays});
  }}/></Field>
  {canRemove&&<button type="button" onClick={onRemove}>Quitar centro</button>}
  {!canRemove&&<p className="muted">Se conserva al menos un centro y cualquier centro usado por tus guardias.</p>}
 </fieldset>;
}
