import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {blankMonth,buildGradeDates,defaultState,legacyCentres} from '../../src/domain/model';
import {eventToShift} from '../../src/domain/calendar';

test.use({actionTimeout:10000});
const tab=(page:Page,name:string)=>page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
const renta=(page:Page)=>page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Renta Madrid · 2026',exact:true})});
async function exportCopy(page:Page){
 await tab(page,'Ajustes');
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Guardar copia JSON',exact:true}).click();
 return JSON.parse(await readFile((await(await download).path())!,'utf8'));
}
async function start(page:Page){
 await page.goto('/');
 await page.getByRole('combobox',{name:'Perfil inicial',exact:true}).selectOption('mfyc-fjd');
 await page.getByLabel('Inicio de residencia',{exact:true}).fill('2025-06-01');
 await page.getByRole('button',{name:'Empezar',exact:true}).click();
 await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
}

test('reaplicar FJD sobre copia v3 conserva recibos y guardias y activa calendario y fiscalidad',async({page})=>{
 const state=defaultState();
 Object.assign(state.settings,{profileComplete:true,residencyStart:'2025-06-01',residencyEnd:'2029-05-31',gradeDates:buildGradeDates('2025-06-01',4),centres:structuredClone(legacyCentres.slice(0,3)),activeWorkProfileId:'mfyc-fjd',taxMode:'manual',manualTaxPercent:23,minimumTaxPercent:2,personalMinimum:7000,geographicalMobility:true,annualGrossOverride:30000,annualSSOverride:2000});
 state.shifts=[{...eventToShift({id:'historical',date:'2026-09-08',title:'Guardia Cerce histórica',start:'2026-09-08',end:'2026-09-09',allDay:true},state.settings),status:'confirmed'}];
 state.months['2026-09']={...blankMonth(),actual:{gross:3000,ss:200,withheld:450,guardGross:500,otherDeductions:0,net:2350,source:'Synthetic'}};
 const old=JSON.parse(JSON.stringify(state));delete old.settings.fiscalPreset;
 await page.goto('/');
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Ya tengo una copia JSON',exact:true}).click();
 await(await chooser).setFiles({name:'fjd-v3-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'mi-nomina-guardias',version:3,state:old}))});
 await expect(page.getByRole('dialog')).toContainText('Se conservan el calendario y el IRPF');
 await page.getByRole('button',{name:'Restaurar esta copia',exact:true}).click();
 await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
 await expect(page.locator('.net-amount')).toContainText('2350,00');
 await tab(page,'Año');await expect(renta(page)).toHaveCount(0);
 await tab(page,'Ajustes');
 await page.getByRole('button',{name:'Seleccionar o crear perfil',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('tus ajustes actuales aún se conservan');
 await page.getByRole('button',{name:'Aplicar perfil',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const copy=await exportCopy(page);
 expect(copy.version).toBe(4);
 expect(copy.state.settings).toMatchObject({fiscalPreset:'madrid-single-employee',taxMode:'estimate',minimumTaxPercent:15,personalMinimum:5550,geographicalMobility:false,manualTaxPercent:23,annualGrossOverride:30000,annualSSOverride:2000});
 expect(copy.state.shifts).toEqual(state.shifts);expect(copy.state.months).toEqual(state.months);
 expect(copy.state.settings.centres.find((c:{id:string})=>c.id==='SAR Cercedilla')).toMatchObject({archived:true,municipality:'Cercedilla',localHolidays:{'2026':['2026-01-20','2026-09-08']}});
 await tab(page,'Año');
 await expect(renta(page).locator('.money-line').filter({hasText:'IRPF anual estimado'})).toContainText('4584,12');
 await expect(renta(page).locator('.money-line').filter({hasText:'Retenciones registradas'})).toContainText('450,00');
 await renta(page).getByText('Cómo se calcula la Renta',{exact:true}).click();
 await expect(renta(page).locator('.money-line').filter({hasText:'Cuota de Madrid tras mínimo'})).toContainText('2128,62');
 await tab(page,'Guardias');
 await page.getByRole('button',{name:'Añadir',exact:true}).click();
 await page.getByRole('combobox',{name:'Centro (opcional)',exact:true}).selectOption({label:'SAR Cercedilla'});
 await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-05-15');
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('24');
 await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-09-08');
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('17');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.reload();await tab(page,'Año');await expect(renta(page)).toBeVisible();
});

test('Renta se mantiene separada del neto, admite móvil y no inventa reglas para 2027',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page);
 await tab(page,'Ajustes');
 await page.getByText('IRPF y acumulados',{exact:true}).click();
 await page.getByLabel('Bruto anual para estimar IRPF (€)',{exact:true}).fill('30000');
 await page.getByLabel('Cotizaciones anuales para IRPF (€)',{exact:true}).fill('2000');
 await page.getByRole('combobox',{name:'Modo de IRPF',exact:true}).selectOption('manual');
 await page.getByLabel('IRPF manual (%)',{exact:true}).fill('23');
 await page.getByRole('button',{name:'Guardar ajustes',exact:true}).click();
 await expect(page.getByText('Cambios sin guardar.',{exact:true})).toHaveCount(0);
 await tab(page,'Año');
 const net=await page.locator('.annual-amount').innerText();
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:900});
  await expect(renta(page).getByText('IRPF anual estimado',{exact:true})).toBeVisible();
  await renta(page).locator('details').evaluate(el=>(el as HTMLDetailsElement).open=true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await renta(page).locator('.money-line>span:last-child').evaluateAll(elements=>elements.every(el=>{
   const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length===1;
  }))).toBe(true);
  // Fixed navigation/toast are tested in the page; keep the tall panel capture unobstructed.
  await renta(page).screenshot({path:`.test-artifacts/renta-madrid-${width}.png`,style:'.bottom-nav,.toast{visibility:hidden!important}'});
 }
 await page.setViewportSize({width:320,height:900});
 await page.evaluate(()=>{const elements=Array.from(document.querySelectorAll<HTMLElement>('body *'));const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));elements.forEach((el,i)=>el.style.fontSize=`${sizes[i]*2}px`);});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.reload();await tab(page,'Ajustes');
 await page.getByText('IRPF y acumulados',{exact:true}).click();
 await page.getByLabel('Estimar Renta Madrid en la vista anual').uncheck();
 await page.getByRole('button',{name:'Guardar ajustes',exact:true}).click();
 await expect(page.getByText('Cambios sin guardar.',{exact:true})).toHaveCount(0);
 await tab(page,'Año');await expect(renta(page)).toHaveCount(0);await expect(page.locator('.annual-amount')).toHaveText(net);
 await tab(page,'Ajustes');await page.getByText('IRPF y acumulados',{exact:true}).click();
 await page.getByLabel('Estimar Renta Madrid en la vista anual').check();
 await page.getByRole('button',{name:'Guardar ajustes',exact:true}).click();
 await expect(page.getByText('Cambios sin guardar.',{exact:true})).toHaveCount(0);
 await tab(page,'Año');await page.getByLabel('Mes de cobro seleccionado').fill('2027-01');
 await expect(page.getByText('Renta Madrid 2027 no disponible: faltan reglas verificadas para este ejercicio.',{exact:true})).toBeVisible();
 await expect(page.getByText('IRPF anual estimado',{exact:true})).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('los perfiles propios pueden omitir la fiscalidad y conservar el porcentaje manual',async({page})=>{
 await start(page);await tab(page,'Ajustes');
 await page.getByText('IRPF y acumulados',{exact:true}).click();
 await page.getByRole('combobox',{name:'Modo de IRPF',exact:true}).selectOption('manual');
 await page.getByLabel('IRPF manual (%)',{exact:true}).fill('24');
 await page.getByRole('button',{name:'Guardar ajustes',exact:true}).click();
 await expect(page.getByText('Cambios sin guardar.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Seleccionar o crear perfil',exact:true}).click();
 await page.getByRole('button',{name:'Duplicar y personalizar',exact:true}).click();
 await expect(page.getByLabel('Incluir fiscalidad básica de Madrid')).toBeChecked();
 await page.getByLabel('Incluir fiscalidad básica de Madrid').uncheck();
 await page.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Este perfil mantiene tu configuración fiscal actual.');
 await page.getByRole('button',{name:'Aplicar perfil',exact:true}).click();
 const copy=await exportCopy(page);
 expect(copy.state.settings).toMatchObject({taxMode:'manual',manualTaxPercent:24,fiscalPreset:'madrid-single-employee'});
 expect(copy.state.settings.savedWorkProfiles[0].fiscalPreset).toBeUndefined();
 expect(copy.state.settings.savedWorkProfiles[0].centres.every((c:{holidayMunicipality:string})=>c.holidayMunicipality==='Madrid')).toBe(true);
});
