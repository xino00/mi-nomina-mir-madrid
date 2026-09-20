// Flujos con perfiles, eventos y recibos inventados; ningún dato de usuario.
import {test,expect,type Page} from '@playwright/test';
import path from 'node:path';

async function setup(page:Page){
 await page.goto('/');
 await page.getByLabel('Inicio de residencia',{exact:true}).fill('2024-07-01');
 await page.getByLabel('Nombre del centro',{exact:true}).fill('Hospital de prueba');
 await page.getByLabel('Municipio',{exact:true}).fill('Getafe');
 await page.getByRole('button',{name:'Empezar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Nómina',exact:true})).toBeVisible();
 await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
}
async function upload(page:Page,button:string,file:string|{name:string,mimeType:string,buffer:Buffer}){
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:button,exact:true}).click();
 await (await chooser).setFiles(file);
}
async function tab(page:Page,name:string){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}

test('guardias, PDF sintético, céntimos, CSV, backup, historial y funcionamiento sin red',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await setup(page);
 await tab(page,'Guardias');await page.getByRole('button',{name:'Añadir',exact:true}).click();
 await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-08-03');
 await page.getByLabel('Horas abonables',{exact:true}).fill('10,5');
 await page.getByRole('button',{name:'Guardar guardia',exact:true}).click();
 await expect(page.locator('dialog')).toHaveCount(0);
 await page.locator('.shift-row').first().click();
 await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-08-08');
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('10,5');
 await page.getByRole('button',{name:'Guardar guardia',exact:true}).click();
 await tab(page,'Nómina');
 await page.getByRole('button',{name:'Añadir recibo',exact:true}).click();
 await upload(page,'Leer PDF de nómina',path.resolve('tests/fixtures/nomina-sintetica.pdf'));
 await expect(page.getByLabel('Documento 1: Neto recibido (€)',{exact:true})).toHaveValue('2300,01');
 await expect(page.getByLabel('Documento 1: Otros descuentos (€)',{exact:true})).toHaveValue('50');
 await page.getByLabel('Documento 1: Guardias incluidas en el bruto (€)',{exact:true}).fill('999,99');
 await page.getByRole('button',{name:'Guardar recibo revisado',exact:true}).click();
 await expect(page.locator('dialog')).toHaveCount(0);
 await expect(page.locator('.net-amount')).toContainText('2300,01');
 await page.reload();await expect(page.locator('.net-amount')).toContainText('2300,01');
 await page.getByRole('button',{name:'Revisar recibo',exact:true}).click();
 await expect(page.getByLabel('Neto recibido (€)',{exact:true})).toHaveValue('2300,01');
 await upload(page,'Leer PDF de nómina',path.resolve('tests/fixtures/nomina-sintetica.pdf'));
 await expect(page.getByRole('alert')).toContainText('ya está registrado');
 await page.getByLabel('Neto recibido (€)',{exact:true}).fill('incorrecto');
 await page.getByRole('button',{name:'Proponer neto a partir del desglose',exact:true}).click();
 await expect(page.getByLabel('Neto recibido (€)',{exact:true})).toHaveValue('2300');
 await page.getByLabel('Neto recibido (€)',{exact:true}).fill('2300,01');
 await page.getByRole('button',{name:'Guardar recibo revisado',exact:true}).click();
 await expect(page.locator('dialog')).toHaveCount(0);
 const csvPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar detalle CSV',exact:true}).click();
 const csv=await csvPromise;expect(csv.suggestedFilename()).toBe('mi-nomina-2026-09.csv');
 const csvPath=await csv.path();const fs=await import('node:fs/promises');
 expect(await fs.readFile(csvPath!,'utf8')).toContain('"2300.01"');
 await tab(page,'Simular');await expect(page.locator('.scenario-number').first()).toContainText('+0,00');
 const annualDifference=page.locator('.money-line').filter({hasText:'Diferencia anual'});
 await expect(annualDifference).toContainText('0,00');
 await tab(page,'Ajustes');
 const copyPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Guardar copia JSON',exact:true}).click();
 const copyPath=(await copyPromise).path();const copy=JSON.parse(await fs.readFile((await copyPath)!,'utf8'));
 expect(copy.version).toBe(4);expect(copy.state.months['2026-09'].actual.net).toBe(2300.01);expect(JSON.stringify(copy)).not.toContain('private-');
 await page.getByRole('button',{name:'Versiones anteriores',exact:true}).click();
 await expect(page.locator('.history-row')).not.toHaveCount(0);
 page.once('dialog',d=>d.accept());await page.locator('.history-row').first().getByRole('button',{name:'Restaurar',exact:true}).click();
 await expect(page.locator('dialog')).toHaveCount(0);
 await upload(page,'Restaurar copia',{name:'copia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(copy))});
 await page.getByRole('button',{name:'Restaurar esta copia',exact:true}).click();await expect(page.locator('dialog')).toHaveCount(0);
 await tab(page,'Nómina');await expect(page.locator('.net-amount')).toContainText('2300,01');
 await page.context().setOffline(true);
 await tab(page,'Guardias');await page.getByRole('button',{name:'Añadir',exact:true}).click();
 await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-08-10');
 await page.getByRole('button',{name:'Guardar guardia',exact:true}).click();await expect(page.locator('.shift-row')).toHaveCount(2);
 await page.context().setOffline(false);await page.reload();await tab(page,'Guardias');await expect(page.locator('.shift-row')).toHaveCount(2);
 expect(errors).toEqual([]);
 await page.screenshot({path:'.test-artifacts/guardias-390.png',fullPage:true});
});

test('ICS revisable e idempotente, centros y ajustes conservados',async({page})=>{
 await setup(page);await tab(page,'Guardias');await page.getByRole('button',{name:'Calendario',exact:true}).click();
 const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:qa-shift@example.invalid\r\nDTSTART;VALUE=DATE:20260814\r\nDTEND;VALUE=DATE:20260815\r\nSUMMARY:Guardia Hospital de prueba\r\nEND:VEVENT\r\nEND:VCALENDAR';
 const file={name:'guardias.ics',mimeType:'text/calendar',buffer:Buffer.from(ics)};
 await upload(page,'Importar archivo ICS',file);
 await expect(page.locator('.proposal')).toHaveCount(1);
 await page.getByRole('button',{name:'Guardar decisiones',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'1 añadidas'})).toBeVisible();
 await upload(page,'Importar archivo ICS',file);await expect(page.getByText('No hay cambios pendientes.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.locator('.shift-row')).toHaveCount(1);
 await page.locator('.shift-row').click();await page.getByLabel('Horas abonables',{exact:true}).fill('11,5');
 await page.getByRole('combobox',{name:'Estado',exact:true}).selectOption('confirmed');await page.getByRole('button',{name:'Guardar guardia',exact:true}).click();
 await page.getByRole('button',{name:'Calendario',exact:true}).click();await upload(page,'Importar archivo ICS',file);
 await page.getByRole('button',{name:'Guardar decisiones',exact:true}).click();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.locator('.shift-row').click();await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('11,5');
});

test('cinco pantallas sin desbordamiento, teclado y texto ampliado',async({page})=>{
 await setup(page);
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  for(const name of ['Nómina','Guardias','Año','Simular','Ajustes']){
   await tab(page,name);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${name} @${width}`).toBeTruthy();
  }
 }
 await page.setViewportSize({width:390,height:844});await tab(page,'Nómina');
 await page.screenshot({path:'.test-artifacts/nomina-390.png',fullPage:true});
 await page.addStyleTag({content:'p, .field>span, .money-line, .muted{font-size:20px!important;line-height:1.6!important}'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
 await page.getByRole('button',{name:'Añadir recibo',exact:true}).click();
 await page.keyboard.press('Tab');expect(await page.locator('dialog').evaluate(el=>el.contains(document.activeElement))).toBeTruthy();
 page.once('dialog',d=>d.accept());await page.keyboard.press('Escape');await expect(page.locator('dialog')).toHaveCount(0);
});


test('los ajustes sin guardar requieren decisión antes de cambiar de pantalla',async({page})=>{
 await setup(page);await tab(page,'Ajustes');
 await page.getByLabel('Nombre del centro',{exact:true}).fill('Cambio sin guardar');
 page.once('dialog',d=>d.dismiss());await tab(page,'Nómina');
 await expect(page.getByRole('heading',{name:'Ajustes',exact:true})).toBeVisible();
 await expect(page.getByLabel('Nombre del centro',{exact:true})).toHaveValue('Cambio sin guardar');
 page.once('dialog',d=>d.accept());await tab(page,'Nómina');
 await tab(page,'Ajustes');await expect(page.getByLabel('Nombre del centro',{exact:true})).toHaveValue('Hospital de prueba');
});


test('la maquetación admite el doble de tamaño de texto en un móvil estrecho',async({page})=>{
 await setup(page);await page.setViewportSize({width:320,height:844});
 for(const name of ['Nómina','Guardias','Año','Simular','Ajustes']){
  await page.reload();await tab(page,name);
  await page.evaluate(()=>{const elements=Array.from(document.querySelectorAll<HTMLElement>('body *'));const sizes=elements.map(el=>parseFloat(getComputedStyle(el).fontSize));elements.forEach((el,i)=>el.style.fontSize=`${sizes[i]*2}px`);});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),name).toBeTruthy();
 }
});
