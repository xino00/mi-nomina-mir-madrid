import {useEffect,useId,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {X,ArrowUpRight,Info} from 'lucide-react';
import {eur} from './domain/engine';

export function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}){
 return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
export function NumberField({label,value,onChange,nullable=false,hint,min,max}:{label:string;value:number|null;onChange:(v:number|null)=>void;nullable?:boolean;hint?:string;min?:number;max?:number}){
 const [text,setText]=useState(value===null?'':String(value).replace('.',','));
 const ref=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(value===null)setText('');else if(Number.isFinite(value))setText(String(value).replace('.',','));const valid=value===null?nullable:Number.isFinite(value)&&(min===undefined||value>=min)&&(max===undefined||value<=max);ref.current?.setCustomValidity(valid?'':'Introduce un número válido dentro del rango indicado.');},[value,nullable,min,max]);
 return <Field label={label} hint={hint}><input ref={ref} aria-label={label} inputMode="decimal" type="text" required={!nullable} value={text} onChange={e=>{const raw=e.target.value;setText(raw);const v=raw.trim()===''?(nullable?null:NaN):Number(raw.replace(',','.'));const valid=v===null||(/^-?\d*(?:[.,]\d*)?$/.test(raw)&&Number.isFinite(v)&&(min===undefined||v>=min)&&(max===undefined||v<=max));e.target.setCustomValidity(valid?'':'Introduce un número válido dentro del rango indicado.');onChange(valid?v:NaN);}}/></Field>;
}
export function Check({label,checked,onChange,hint}:{label:string;checked:boolean;onChange:(v:boolean)=>void;hint?:string}){return <label className="check"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>{label}{hint&&<small>{hint}</small>}</span></label>;}
export function Line({label,value,strong=false}:{label:ReactNode;value:ReactNode;strong?:boolean}){return <div className={`money-line ${strong?'strong':''}`}><span>{label}</span><span>{typeof value==='number'?eur(value):value}</span></div>;}
export function Empty({children,action}:{children:ReactNode;action?:ReactNode}){return <div className="empty"><p>{children}</p>{action}</div>;}
export function Notice({children}:{children:ReactNode}){return <div className="notice"><Info size={18}/><div>{children}</div></div>;}
export function ExternalLink({href,children}:{href:string;children:ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14}/></a>;}
export function Panel({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){return <section className="panel"><div className="section-title"><h2>{title}</h2>{action}</div>{children}</section>;}
export function Submit({busy,children='Guardar'}:{busy:boolean;children?:ReactNode}){return <button className="primary" type="submit" disabled={busy}>{busy?'Guardando…':children}</button>;}
export function SafeForm({children,onSubmit,className}:{children:ReactNode;onSubmit:()=>void|Promise<void>;className?:string}){return <form className={className} onInvalidCapture={e=>{let el=e.target as HTMLElement;while(el.parentElement){el=el.parentElement;if(el instanceof HTMLDetailsElement)el.open=true;}}} onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(e.currentTarget.reportValidity())void onSubmit();}}>{children}</form>;}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{const el=ref.current!;el.showModal();return()=>el.close();},[]);
 return <dialog ref={ref} aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}} className="sheet"><header><h2 id={id}>{title}</h2><button type="button" aria-label="Cerrar" className="icon-button" onClick={onClose}><X/></button></header><div className="sheet-body">{children}</div></dialog>;
}
export function ErrorText({error}:{error:string}){return error?<p role="alert" className="error-text">{error}</p>:null;}
export function errorMessage(error:unknown){if(error&&typeof error==='object'&&'issues' in error)return (error as {issues:{message:string}[]}).issues.map(i=>i.message).slice(0,3).join(' · ');return error instanceof Error?error.message:'No se pudo completar la operación. Tus datos guardados se conservan.';}
export const typeNames={labour:'Laborable',festive:'Sábado, domingo o festivo',special:'Festivo especial'};
