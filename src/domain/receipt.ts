import { actualSchema, monthSchema, type MonthInput } from './model';
export type TextPiece={text:string;x:number;y:number;width:number};
export type ReceiptDraft={gross:number|null;ss:number|null;withheld:number|null;guardGross:number|null;otherDeductions:number|null;net:number|null;paymentMonth:string|null;kind:string;warnings:string[]};
const normal=(s:string)=>s.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toUpperCase().replace(/\s+/g,' ').trim();
const amount=(s:string)=>Number(s.replace(/\./g,'').replace(/\s/g,'').replace(',','.'));
const amounts=(s:string)=>[...s.matchAll(/-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}/g)].map(m=>amount(m[0]));
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function parseReceipt(pieces:TextPiece[]):ReceiptDraft{
 const lines:{y:number;items:TextPiece[];text:string}[]=[];
 for(const p of [...pieces].sort((a,b)=>a.y-b.y||a.x-b.x)){let line=lines.find(l=>Math.abs(l.y-p.y)<2.5);if(!line){line={y:p.y,items:[],text:''};lines.push(line);}line.items.push(p);}
 for(const l of lines){l.items.sort((a,b)=>a.x-b.x);l.text=l.items.map(i=>i.text).join(' ');}
 const all=normal(lines.map(l=>l.text).join('\n'));
 function below(label:RegExp):number|null{
  const matches=pieces.filter(p=>label.test(normal(p.text)));
  for(const p of matches){const candidates=pieces.filter(q=>q.y>p.y+2&&q.y<p.y+30&&amounts(q.text).length===1&&Math.abs((q.x+q.width)-(p.x+p.width))<70).sort((a,b)=>(a.y-p.y)*3+Math.abs(a.x+a.width-p.x-p.width)-((b.y-p.y)*3+Math.abs(b.x+b.width-p.x-p.width)));if(candidates.length)return amounts(candidates[0].text)[0];}
  return null;
 }
 const gross=below(/^TOTAL DEVENGOS$/),deductions=below(/^TOTAL DESCUENTOS$/),net=below(/^LIQUIDO$/);
 const taxRows=lines.filter(l=>/RETENCION\s+I\.?\s*R\.?\s*P\.?\s*F/.test(normal(l.text)));
 const ssRows=lines.filter(l=>/COTIZ.*EMPLEADO/.test(normal(l.text)));
 const guards=lines.filter(l=>/\bGUA(?:RDIAS?)?\b.*PRES\.?\s*FIS/.test(normal(l.text)));
 const last=(l:typeof lines[number])=>amounts(l.text).at(-1)??null;
 const withheld=taxRows.length===1?last(taxRows[0]):null;
 const ss=ssRows.length&&ssRows.every(l=>last(l)!==null)?round(ssRows.reduce((n,l)=>n+last(l)!,0)):null;
 const guardGross=guards.length&&guards.every(l=>last(l)!==null)?round(guards.reduce((n,l)=>n+last(l)!,0)):gross!==null&&ss!==null&&withheld!==null&&deductions!==null?0:null;
 const months=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
 let paymentMonth:string|null=null;
 const label=pieces.find(p=>/PERIODO DE PAGO/.test(normal(p.text)));
 if(label){const nearby=pieces.filter(p=>p.y>=label.y&&p.y<label.y+35&&p.x>=label.x-10&&p.x<label.x+190).map(p=>normal(p.text)).join(' ');const match=nearby.match(new RegExp(`(${months.join('|')})\\s+(20\\d{2})`));if(match)paymentMonth=`${match[2]}-${String(months.indexOf(match[1])+1).padStart(2,'0')}`;}
 const otherDeductions=deductions!==null&&ss!==null&&withheld!==null&&deductions-ss-withheld>=-.025?Math.max(0,round(deductions-ss-withheld)):null;
 const warnings:string[]=[];
 if([gross,ss,withheld,guardGross,net].some(v=>v===null))warnings.push('No se han identificado todos los importes. Completa los campos mirando el PDF.');
 if(gross!==null&&deductions!==null&&net!==null&&Math.abs(gross-deductions-net)>.025)warnings.push('El total de devengos menos descuentos no coincide con el líquido.');
 if(ss!==null&&withheld!==null&&deductions!==null&&Math.abs(ss+withheld-deductions)>.025)warnings.push('Hay descuentos sin identificar: no los sumes a Seguridad Social sin revisar.');
 if(!paymentMonth)warnings.push('No se ha identificado el periodo de pago. Elige el mes de cobro.');
 return {gross,ss,withheld,guardGross,otherDeductions,net,paymentMonth,kind:all.includes('PAGAS RETROACTIVAS')?'Retroactiva':'Ordinaria / revisar',warnings};
}

/** Preserve the reviewed liquid amount; never reconstruct it from deductions. */
export function saveReceipt(month:MonthInput,input:unknown,hash?:string,mode:'replace'|'add'='replace'):MonthInput {
 const receipt=actualSchema.parse(input);
 if(hash&&month.receiptHashes.includes(hash))throw new Error('Este PDF ya está incorporado al mes.');
 let actual=receipt;
 if(mode==='add'&&month.actual){
  const old=month.actual;
  actual=actualSchema.parse({
   gross:round(old.gross+receipt.gross),ss:round(old.ss+receipt.ss),withheld:round(old.withheld+receipt.withheld),
   guardGross:round(old.guardGross+receipt.guardGross),otherDeductions:round((old.otherDeductions??0)+receipt.otherDeductions),
   net:round(old.net+receipt.net),source:'Varios recibos revisados',
  });
 }
 const receiptHashes=mode==='replace'?(hash?[hash]:[]):[...month.receiptHashes,...(hash?[hash]:[])];
 return monthSchema.parse({...month,actual,receiptHashes});
}
