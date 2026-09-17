// Perfiles y eventos sintéticos; ninguna petición sale hacia Google.
import {test,expect,type Page} from '@playwright/test';

const feedUrl='https://calendar.google.com/calendar/ical/fixture%40example.invalid/private-test/basic.ics';
const emptyFeed='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
const updatedFeed=emptyFeed.replace('END:VCALENDAR','BEGIN:VEVENT\r\nUID:synthetic-sync@example.invalid\r\nDTSTART;VALUE=DATE:20260814\r\nDTEND;VALUE=DATE:20260815\r\nSUMMARY:Guardia\r\nEND:VEVENT\r\nEND:VCALENDAR');
async function tab(page:Page,name:string){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
async function setup(page:Page){
 await page.clock.setFixedTime(new Date('2026-09-17T10:00:00Z'));
 await page.goto('/');
 await page.getByLabel('Inicio de residencia',{exact:true}).fill('2024-07-01');
 await page.getByLabel('Nombre del centro',{exact:true}).fill('Hospital de prueba');
 await page.getByLabel('Municipio',{exact:true}).fill('Getafe');
 await page.getByRole('button',{name:'Empezar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Nómina',exact:true})).toBeVisible();
}

test('una sincronización en curso conserva el borrador de Ajustes y permite guardarlo junto a las nuevas guardias',async({page})=>{
 let requests=0;
 let release!:()=>void;
 const responseReady=new Promise<void>(resolve=>{release=resolve;});
 await page.route(feedUrl,async route=>{
  requests++;
  if(requests>1)await responseReady;
  await route.fulfill({status:200,contentType:'text/calendar',headers:{'access-control-allow-origin':'*'},body:requests===1?emptyFeed:updatedFeed});
 });
 await setup(page);
 await tab(page,'Guardias');
 await page.getByRole('button',{name:'Calendario',exact:true}).click();
 await page.getByText('Conectar Google Calendar por enlace',{exact:true}).click();
 await page.getByLabel(/^Dirección secreta iCal/).fill(feedUrl);
 await page.getByRole('button',{name:'Conectar y revisar',exact:true}).click();
 await expect(page.getByText('No hay cambios pendientes.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.clock.setFixedTime(new Date('2026-09-17T10:06:00Z'));
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect.poll(()=>requests).toBe(2);
 try{
  await tab(page,'Ajustes');
  await page.getByLabel('Nombre del centro',{exact:true}).fill('Centro editado durante la lectura');
  await page.getByLabel(/^Nombres en tu calendario/).fill('prueba, nuevo alias, ');
  await page.getByLabel(/^Festivos locales 2026/).fill('2026-09-18\n');
  await page.getByText('Sueldo, guardias y vacaciones',{exact:true}).click();
  await page.getByLabel('Horas habituales de hospital en laborable',{exact:true}).fill('18,5');
 }finally{release();}
 await expect(page.getByRole('status').filter({hasText:'1 guardias añadidas como pendientes.'})).toBeVisible();
 await expect(page.getByLabel('Nombre del centro',{exact:true})).toHaveValue('Centro editado durante la lectura');
 await expect(page.getByLabel(/^Nombres en tu calendario/)).toHaveValue('prueba, nuevo alias, ');
 await expect(page.getByLabel(/^Festivos locales 2026/)).toHaveValue('2026-09-18\n');
 await expect(page.getByLabel('Horas habituales de hospital en laborable',{exact:true})).toHaveValue('18,5');
 page.once('dialog',d=>d.dismiss());await tab(page,'Nómina');
 await expect(page.getByRole('heading',{name:'Ajustes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Guardar ajustes',exact:true}).click();
 await expect(page.getByText('Cambios sin guardar.',{exact:true})).toHaveCount(0);
 await page.reload();await tab(page,'Ajustes');
 await expect(page.getByLabel('Nombre del centro',{exact:true})).toHaveValue('Centro editado durante la lectura');
 await expect(page.getByLabel(/^Nombres en tu calendario/)).toHaveValue('prueba, nuevo alias');
 await expect(page.getByLabel(/^Festivos locales 2026/)).toHaveValue('2026-09-18');
 await page.getByText('Sueldo, guardias y vacaciones',{exact:true}).click();
 await expect(page.getByLabel('Horas habituales de hospital en laborable',{exact:true})).toHaveValue('18,5');
 await tab(page,'Guardias');await expect(page.locator('.shift-row')).toHaveCount(1);
 await expect(page.locator('.shift-row')).toContainText('18.5 h');
});

test('guardar un cambio de perfil actualiza los Ajustes visibles',async({page})=>{
 await setup(page);await tab(page,'Ajustes');
 await page.getByRole('button',{name:'Editar perfil y cambios R1–R5',exact:true}).click();
 await page.getByLabel('Meses de retraso del cobro de guardias',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Guardar perfil',exact:true}).click();
 await expect(page.locator('dialog')).toHaveCount(0);
 await page.getByText('Sueldo, guardias y vacaciones',{exact:true}).click();
 await expect(page.getByLabel('Retraso del cobro de guardias (meses)',{exact:true})).toHaveValue('3');
 await page.getByRole('button',{name:'Guardar ajustes',exact:true}).click();
 await page.reload();await tab(page,'Ajustes');
 await page.getByText('Sueldo, guardias y vacaciones',{exact:true}).click();
 await expect(page.getByLabel('Retraso del cobro de guardias (meses)',{exact:true})).toHaveValue('3');
});
