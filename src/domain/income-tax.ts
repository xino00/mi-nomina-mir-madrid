/** Renta 2026, individual Madrid resident, under 65, only employment income.
 * Verified 2026-09-20: Ley 35/2006 arts. 19, 20, 57, 63, 74 and DA 61;
 * Madrid Decreto Legislativo 1/2010 arts. 1-2. See docs/IRPF-MADRID-2026.md.
 * This is independent of payroll withholding (no 15% floor or 43% cap).
 */
export const incomeTaxSources={
 state:'https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764',
 madrid:'https://www.boe.es/buscar/act.php?id=BOCM-m-2010-90068',
};
type TaxBand={from:number;quota:number;rate:number};
// Published accumulated quotas avoid cent drift from reintegrating every band.
export const stateIncomeBands2026:readonly TaxBand[]=[
 {from:0,quota:0,rate:.095},{from:12450,quota:1182.75,rate:.12},
 {from:20200,quota:2112.75,rate:.15},{from:35200,quota:4362.75,rate:.185},
 {from:60000,quota:8950.75,rate:.225},{from:300000,quota:62950.75,rate:.245},
];
export const madridIncomeBands2026:readonly TaxBand[]=[
 {from:0,quota:0,rate:.085},{from:13362.22,quota:1135.79,rate:.107},
 {from:19004.63,quota:1739.53,rate:.128},{from:35425.68,quota:3841.42,rate:.174},
 {from:57320.40,quota:7651.10,rate:.205},
];
const cents=(n:number)=>Math.round((n+1e-9)*100)/100;
export function incomeScale(base:number,bands:readonly TaxBand[]):number{
 const band=[...bands].reverse().find(b=>base>=b.from)??bands[0];
 return cents(band.quota+Math.max(0,base-band.from)*band.rate);
}
export function employmentReduction2026(netBeforeGeneralExpenses:number):number{
 const net=Math.max(0,netBeforeGeneralExpenses);
 return cents(Math.max(0,net<=14852?7302:net<=17673.52?7302-1.75*(net-14852):net<19747.5?2364.34-1.14*(net-17673.52):0));
}
export function employmentDeduction2026(gross:number):number{
 return cents(Math.max(0,gross<=17094?590.89:gross<20048.45?590.89-.2*(gross-17094):0));
}
export function estimateMadridIncomeTax(year:number,gross:number,ss:number,withheld:number){
 if(year!==2026)return {available:false as const,year,reason:`Renta Madrid ${year} no disponible: faltan reglas verificadas para este ejercicio.`};
 if([gross,ss,withheld].some(n=>!Number.isFinite(n)||n<0)||ss>gross)return {available:false as const,year,reason:'Revisa los importes fiscales: deben ser positivos o cero y las cotizaciones no pueden superar el bruto.'};
 const netWork=cents(gross-ss),generalExpenses=Math.min(netWork,2000);
 const reduction=Math.min(cents(netWork-generalExpenses),employmentReduction2026(netWork));
 const base=cents(Math.max(0,netWork-generalExpenses-reduction));
 const stateMinimum=5550,madridMinimum=5956.65;
 const stateQuota=cents(Math.max(0,incomeScale(base,stateIncomeBands2026)-incomeScale(Math.min(base,stateMinimum),stateIncomeBands2026)));
 const madridQuota=cents(Math.max(0,incomeScale(base,madridIncomeBands2026)-incomeScale(Math.min(base,madridMinimum),madridIncomeBands2026)));
 const totalQuota=cents(stateQuota+madridQuota);
 // Only labour income is in scope, so the DA 61 proportional ceiling is the total quota.
 const employmentDeduction=Math.min(totalQuota,employmentDeduction2026(gross));
 const liability=cents(Math.max(0,totalQuota-employmentDeduction));
 return {available:true as const,year,gross,ss,netWork,generalExpenses,reduction,base,stateMinimum,madridMinimum,stateQuota,madridQuota,employmentDeduction,liability,withheld,balance:cents(liability-withheld)};
}
