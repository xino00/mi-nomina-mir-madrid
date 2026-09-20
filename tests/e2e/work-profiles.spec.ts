// Perfiles, guardias y recibos sintéticos en un contexto de navegador nuevo por prueba.
import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {State} from '../../src/domain/model';

type Copy={format:string;version:number;state:State};
test.use({actionTimeout:10000});
const fjd='Fundación Jiménez Díaz';
const ownName='FJD · horario de prueba';

async function tab(page:Page,name:string){
 await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
}

async function setup(page:Page){
 await page.clock.setFixedTime(new Date('2026-09-20T10:00:00Z'));
 await page.goto('/');
 await page.getByRole('combobox',{name:'Perfil inicial',exact:true}).selectOption('mfyc-fjd');
 await expect(page.getByLabel('Nombre del centro',{exact:true})).toHaveCount(0);
 await page.getByLabel('Inicio de residencia',{exact:true}).fill('2025-06-06');
 await expect(page.getByLabel('Último día de residencia',{exact:true})).toHaveValue('2029-06-05');
 await page.getByRole('button',{name:'Empezar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Nómina',exact:true})).toBeVisible();
 await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
}

async function openProfiles(page:Page){
 await tab(page,'Ajustes');
 await page.getByRole('button',{name:'Seleccionar o crear perfil',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Perfiles de condiciones',exact:true})).toBeVisible();
 return page.getByRole('dialog',{name:'Perfiles de condiciones',exact:true});
}

async function closeForm(page:Page){
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function exportCopy(page:Page):Promise<Copy>{
 await tab(page,'Ajustes');
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Guardar copia JSON',exact:true}).click();
 const file=await(await download).path();
 expect(file).not.toBeNull();
 return JSON.parse(await readFile(file!,'utf8')) as Copy;
}

async function upload(page:Page,button:string,name:string,mimeType:string,contents:string){
 const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:button,exact:true}).click();
 await(await chooser).setFiles({name,mimeType,buffer:Buffer.from(contents)});
}

async function addShift(page:Page,title:string,date:string,hours:string){
 await tab(page,'Guardias');
 await page.getByRole('button',{name:'Añadir',exact:true}).click();
 await page.getByLabel('Fecha trabajada',{exact:true}).fill(date);
 await page.getByLabel('Descripción',{exact:true}).fill(title);
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue(hours);
 await page.getByRole('button',{name:'Guardar guardia',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addReceipt(page:Page){
 await tab(page,'Nómina');
 await page.getByRole('button',{name:'Añadir recibo',exact:true}).click();
 for(const [label,value] of [
  ['Total bruto (€)','3000,01'],['Cotizaciones (€)','200'],['IRPF retenido (€)','450'],
  ['Guardias incluidas en el bruto (€)','700'],['Otros descuentos (€)','50'],['Neto recibido (€)','2300,01'],
 ])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Referencia (sin datos personales)',{exact:true}).fill('Recibo sintético de prueba');
 await page.getByRole('button',{name:'Guardar recibo revisado',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('.net-amount')).toContainText('2300,01');
}

test('MFyC FJD configura tres centros y reconoce curas, Cerce y Torrelo con sus horarios',async({page})=>{
 await setup(page);
 await tab(page,'Ajustes');
 await expect(page.locator('.centre-editor')).toHaveCount(3);
 for(const [name,municipality] of [[fjd,'Madrid'],['SAR Cercedilla','Cercedilla'],['SAR Torrelodones','Torrelodones']]){
  const centre=page.getByRole('group',{name,exact:true});
  await expect(centre.getByLabel('Municipio',{exact:true})).toHaveValue(municipality);
  await expect(centre.getByRole('combobox',{name:'Horario del centro',exact:true})).toHaveValue('general');
 }
 await expect(page.getByRole('group',{name:'SAR Cercedilla',exact:true}).getByLabel(/^Festivos locales 2026/)).toHaveValue('2026-01-20\n2026-09-08');
 await expect(page.getByRole('group',{name:'SAR Torrelodones',exact:true}).getByLabel(/^Festivos locales 2026/)).toHaveValue('2026-07-16\n2026-08-14');

 await tab(page,'Guardias');
 await page.getByRole('button',{name:'Añadir',exact:true}).click();
 const centreSelect=page.getByRole('combobox',{name:'Centro (opcional)',exact:true});
 await expect(centreSelect.locator('option')).toHaveText([fjd,'SAR Cercedilla','SAR Torrelodones','Horario de hospital / según descripción']);
 for(const [centre,labourHours,localHoliday] of [['Hospital','17','2026-05-15'],['SAR Cercedilla','17','2026-09-08'],['SAR Torrelodones','11','2026-08-14']]){
  await centreSelect.selectOption(centre);
  await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-08-10');
  await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue(labourHours);
  await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-08-16');
  await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('24');
  await page.getByLabel('Fecha trabajada',{exact:true}).fill(localHoliday);
  await expect(page.getByRole('combobox',{name:'Tipo de día',exact:true})).toHaveValue('festive');
  await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('24');
 }
 await closeForm(page);

 const events=[
  ['20260810','Guardia curas laborable',fjd,'Hospital',17],
  ['20260811','Guardia Cerce laborable','SAR Cercedilla','SAR Cercedilla',17],
  ['20260812','Guardia Torrelo laborable','SAR Torrelodones','SAR Torrelodones',11],
  ['20260814','Guardia Torrelo festivo local','SAR Torrelodones','SAR Torrelodones',24],
  ['20260815','Guardia curas festivo',fjd,'Hospital',24],
  ['20260816','Guardia Cerce festivo','SAR Cercedilla','SAR Cercedilla',24],
  ['20260822','Guardia Torrelo festivo','SAR Torrelodones','SAR Torrelodones',24],
 ] as const;
 const ics=['BEGIN:VCALENDAR','VERSION:2.0',...events.flatMap(([date,title],i)=>[
  'BEGIN:VEVENT',`UID:work-profile-${i}@example.invalid`,`DTSTART;VALUE=DATE:${date}`,`SUMMARY:${title}`,'END:VEVENT',
 ]),'END:VCALENDAR'].join('\r\n');
 await page.getByRole('button',{name:'Calendario',exact:true}).click();
 await upload(page,'Importar archivo ICS','perfiles-sinteticos.ics','text/calendar',ics);
 await expect(page.locator('.proposal')).toHaveCount(events.length);
 for(const [,title,centre,,hours] of events){
  const proposal=page.locator('.proposal').filter({has:page.getByRole('heading',{name:title,exact:true})});
  await expect(proposal).toContainText(`${centre} · ${hours} h`);
  await expect(proposal.getByRole('combobox')).toHaveValue('add');
 }
 await page.getByRole('button',{name:'Guardar decisiones',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'7 añadidas'})).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.locator('.shift-row')).toHaveCount(events.length);
 const copy=await exportCopy(page);
 expect(copy.state.settings.activeWorkProfileId).toBe('mfyc-fjd');
 expect(copy.state.settings.gradeDates).toHaveLength(4);
 for(const [,title,,centre,hours] of events)expect(copy.state.shifts.find(s=>s.title===title)).toMatchObject({centre,hours,status:'pending'});
});

test('aplicar, editar, eliminar y recuperar un perfil conserva guardias y recibos anteriores',async({page})=>{
 test.setTimeout(90000);
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await setup(page);
 await addShift(page,'Guardia anterior al perfil','2026-08-03','17');
 await addReceipt(page);
 const baseline=await exportCopy(page);

 let profiles=await openProfiles(page);
 await profiles.getByRole('button',{name:'Duplicar y personalizar',exact:true}).click();
 await profiles.getByLabel('Nombre del perfil',{exact:true}).fill(ownName);
 let centre=profiles.getByRole('group',{name:fjd,exact:true});
 await centre.getByRole('combobox',{name:'Horario del centro',exact:true}).selectOption('custom');
 await centre.getByLabel('Horas laborables del centro',{exact:true}).fill('12,5');
 await centre.getByLabel('Horas festivas del centro',{exact:true}).fill('20');
 await profiles.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
 await expect(profiles.getByRole('status')).toContainText('Perfil guardado');
 const ownId=await profiles.getByRole('combobox',{name:'Perfil de condiciones',exact:true}).inputValue();
 expect(ownId).not.toBe('mfyc-fjd');
 await closeForm(page);
 const saved=await exportCopy(page);
 expect(saved.state.settings.centres).toEqual(baseline.state.settings.centres);
 expect(saved.state.settings.activeWorkProfileId).toBe('mfyc-fjd');
 expect(saved.state.shifts).toEqual(baseline.state.shifts);
 expect(saved.state.months).toEqual(baseline.state.months);

 profiles=await openProfiles(page);
 await profiles.getByRole('combobox',{name:'Perfil de condiciones',exact:true}).selectOption(ownId);
 await profiles.getByRole('button',{name:'Aplicar perfil',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await addShift(page,'Guardia con el nuevo perfil','2026-08-04','12,5');
 await page.locator('.shift-row').filter({hasText:'Guardia anterior al perfil'}).click();
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('17');
 await closeForm(page);
 await tab(page,'Nómina');
 await expect(page.locator('.net-amount')).toContainText('2300,01');
 const applied=await exportCopy(page);
 expect(applied.version).toBe(3);
 expect(applied.state.settings.savedWorkProfiles).toHaveLength(1);
 expect(applied.state.settings.savedWorkProfiles[0]).toMatchObject({id:ownId,name:ownName});
 expect(applied.state.settings.savedWorkProfiles[0].centres[0]).toMatchObject({scheduleMode:'custom',labourHours:12.5,festiveHours:20});
 expect(applied.state.settings.residencyStart).toBe('2025-06-06');
 expect(applied.state.settings.gradeDates).toEqual(baseline.state.settings.gradeDates);
 expect(applied.state.shifts.find(s=>s.title==='Guardia anterior al perfil')).toEqual(baseline.state.shifts[0]);
 expect(applied.state.shifts.find(s=>s.title==='Guardia con el nuevo perfil')).toMatchObject({hours:12.5});
 expect(applied.state.months).toEqual(baseline.state.months);

 await page.reload();
 profiles=await openProfiles(page);
 await expect(profiles.getByRole('combobox',{name:'Perfil de condiciones',exact:true})).toHaveValue(ownId);
 await profiles.getByRole('button',{name:'Editar perfil guardado',exact:true}).click();
 await profiles.getByLabel('Nombre del perfil',{exact:true}).fill('FJD · plantilla revisada');
 centre=profiles.getByRole('group',{name:fjd,exact:true});
 await centre.getByLabel('Horas laborables del centro',{exact:true}).fill('13');
 await profiles.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
 await expect(profiles.getByRole('status')).toContainText('Perfil guardado');
 await closeForm(page);
 const edited=await exportCopy(page);
 expect(edited.state.settings.savedWorkProfiles[0]).toMatchObject({id:ownId,name:'FJD · plantilla revisada'});
 expect(edited.state.settings.savedWorkProfiles[0].centres[0].labourHours).toBe(13);
 expect(edited.state.settings.centres).toEqual(applied.state.settings.centres);
 expect(edited.state.shifts).toEqual(applied.state.shifts);
 expect(edited.state.months).toEqual(applied.state.months);

 profiles=await openProfiles(page);
 page.once('dialog',dialog=>dialog.accept());
 await profiles.getByRole('button',{name:'Eliminar perfil guardado',exact:true}).click();
 await expect(profiles.getByRole('status')).toContainText('Perfil eliminado');
 await closeForm(page);
 const deleted=await exportCopy(page);
 expect(deleted.state.settings.savedWorkProfiles).toEqual([]);
 expect(deleted.state.settings.activeWorkProfileId).toBeNull();
 expect(deleted.state.settings.centres).toEqual(applied.state.settings.centres);
 expect(deleted.state.shifts).toEqual(applied.state.shifts);
 expect(deleted.state.months).toEqual(applied.state.months);

 await page.getByRole('button',{name:'Versiones anteriores',exact:true}).click();
 await expect(page.locator('.history-row').first()).toContainText('Biblioteca de perfiles');
 await expect(page.locator('.history-row').filter({hasText:'Aplicar perfil de condiciones'})).toHaveCount(1);
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.history-row').first().getByRole('button',{name:'Restaurar',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect((await exportCopy(page)).state).toEqual(edited.state);

 await upload(page,'Restaurar copia','perfil-v3-sintetico.json','application/json',JSON.stringify(applied));
 await expect(page.getByRole('dialog')).toContainText('2 guardias · 1 meses con recibos.');
 await page.getByRole('button',{name:'Restaurar esta copia',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();
 expect((await exportCopy(page)).state).toEqual(applied.state);
 profiles=await openProfiles(page);
 await expect(profiles.getByRole('combobox',{name:'Perfil de condiciones',exact:true})).toHaveValue(ownId);
 await expect(profiles.getByRole('heading',{name:ownName,exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});

test('crear y guardar condiciones propias no las aplica; cancelar y preseleccionar no cambia datos',async({page})=>{
 await setup(page);
 const baseline=await exportCopy(page);
 let profiles=await openProfiles(page);
 await profiles.getByRole('button',{name:'Crear perfil desde cero',exact:true}).click();
 await profiles.getByLabel('Nombre del perfil',{exact:true}).fill('Borrador descartado');
 await profiles.getByRole('group',{name:'Nuevo centro',exact:true}).getByLabel('Nombre del centro',{exact:true}).fill('Centro descartado');
 await profiles.getByRole('button',{name:'Cancelar edición',exact:true}).click();
 await closeForm(page);
 expect((await exportCopy(page)).state).toEqual(baseline.state);

 profiles=await openProfiles(page);
 await profiles.getByRole('button',{name:'Crear perfil desde cero',exact:true}).click();
 await profiles.getByLabel('Nombre del perfil',{exact:true}).fill('Perfil sintético propio');
 await profiles.getByLabel('Retraso de cobro del perfil (meses)',{exact:true}).fill('2');
 await profiles.getByRole('group',{name:'Nuevo centro',exact:true}).getByLabel('Nombre del centro',{exact:true}).fill('Centro de prueba');
 const centre=profiles.getByRole('group',{name:'Centro de prueba',exact:true});
 await centre.getByLabel('Municipio',{exact:true}).fill('Getafe');
 await centre.getByRole('combobox',{name:'Horario del centro',exact:true}).selectOption('custom');
 await centre.getByLabel('Horas laborables del centro',{exact:true}).fill('8');
 await centre.getByLabel('Horas festivas del centro',{exact:true}).fill('16');
 await profiles.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
 await expect(profiles.getByRole('status')).toContainText('Perfil guardado');
 const ownId=await profiles.getByRole('combobox',{name:'Perfil de condiciones',exact:true}).inputValue();
 await profiles.getByRole('combobox',{name:'Perfil de condiciones',exact:true}).selectOption('mfyc-fjd');
 await closeForm(page);
 const saved=await exportCopy(page);
 expect(saved.state.settings.savedWorkProfiles).toHaveLength(1);
 expect(saved.state.settings.savedWorkProfiles[0]).toMatchObject({id:ownId,name:'Perfil sintético propio',payDelay:2});
 expect(saved.state.settings.centres).toEqual(baseline.state.settings.centres);
 expect(saved.state.settings.payDelay).toBe(1);
 expect(saved.state.settings.activeWorkProfileId).toBe('mfyc-fjd');

 await page.reload();
 profiles=await openProfiles(page);
 await profiles.getByRole('combobox',{name:'Perfil de condiciones',exact:true}).selectOption(ownId);
 await profiles.getByRole('button',{name:'Editar perfil guardado',exact:true}).click();
 await profiles.getByLabel('Nombre del perfil',{exact:true}).fill('Edición que no se guarda');
 await profiles.getByRole('group',{name:'Centro de prueba',exact:true}).getByLabel('Horas laborables del centro',{exact:true}).fill('9');
 await profiles.getByRole('button',{name:'Cancelar edición',exact:true}).click();
 await expect(profiles.getByRole('heading',{name:'Perfil sintético propio',exact:true})).toBeVisible();
 await closeForm(page);
 expect((await exportCopy(page)).state).toEqual(saved.state);

 profiles=await openProfiles(page);
 await profiles.getByRole('button',{name:'Guardar condiciones actuales como perfil',exact:true}).click();
 await expect(profiles.getByLabel('Nombre del perfil',{exact:true})).toHaveValue('Mis condiciones');
 await expect(profiles.locator('.centre-editor')).toHaveCount(3);
 await profiles.getByLabel('Nombre del perfil',{exact:true}).fill('Condiciones copiadas de prueba');
 await profiles.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
 await expect(profiles.getByRole('status')).toContainText('Perfil guardado');
 await closeForm(page);
 const captured=await exportCopy(page);
 expect(captured.state.settings.savedWorkProfiles).toHaveLength(2);
 expect(captured.state.settings.savedWorkProfiles[1].centres).toEqual(baseline.state.settings.centres);
 expect(captured.state.settings.centres).toEqual(baseline.state.settings.centres);
 expect(captured.state.settings.activeWorkProfileId).toBe('mfyc-fjd');
});

test('un centro conservado no permite eliminar el último centro activo',async({page})=>{
 await setup(page);
 await addShift(page,'Guardia histórica sintética','2026-08-03','17');
 const profiles=await openProfiles(page);
 await profiles.getByRole('button',{name:'Duplicar y personalizar',exact:true}).click();
 await profiles.getByLabel('Horas generales en laborable',{exact:true}).fill('19');
 await profiles.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
 await profiles.getByRole('button',{name:'Aplicar perfil',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 for(const name of [fjd,'SAR Cercedilla']){
  await page.getByRole('group',{name,exact:true}).getByRole('button',{name:'Quitar centro',exact:true}).click();
 }
 await expect(page.getByRole('group',{name:'SAR Torrelodones',exact:true}).getByRole('button',{name:'Quitar centro',exact:true})).toHaveCount(0);
 await expect(page.getByRole('group',{name:fjd+' · conservado',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Guardar ajustes',exact:true}).click();
 await expect(page.getByText('Cambios sin guardar.',{exact:true})).toHaveCount(0);
 const copy=await exportCopy(page);
 expect(copy.state.settings.centres.filter(c=>!c.archived)).toHaveLength(1);
 expect(copy.state.shifts[0].hours).toBe(17);
 const current=await openProfiles(page);
 await current.getByRole('button',{name:'Guardar condiciones actuales como perfil',exact:true}).click();
 await expect(current.locator('.centre-editor')).toHaveCount(1);
 await expect(current.getByRole('group',{name:'SAR Torrelodones',exact:true})).toBeVisible();
});

test('un alias compartido exige elegir centro antes de importar sus horas',async({page})=>{
 await setup(page);
 const profiles=await openProfiles(page);
 await profiles.getByRole('button',{name:'Duplicar y personalizar',exact:true}).click();
 for(const [name,hours] of [[fjd,'12'],['SAR Cercedilla','16']]){
  const centre=profiles.getByRole('group',{name,exact:true});
  await centre.getByRole('combobox',{name:'Horario del centro',exact:true}).selectOption('custom');
  await centre.getByLabel('Horas laborables del centro',{exact:true}).fill(hours);
  await centre.getByRole('textbox',{name:/^Nombres en tu calendario/}).fill('doble');
 }
 await profiles.getByRole('button',{name:'Guardar plantilla',exact:true}).click();
 await profiles.getByRole('button',{name:'Aplicar perfil',exact:true}).click();
 await tab(page,'Guardias');
 await page.getByRole('button',{name:'Calendario',exact:true}).click();
 const title='Guardia doble';
 const ics=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:alias-compartido@example.invalid','DTSTART;VALUE=DATE:20260810',`SUMMARY:${title}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
 await upload(page,'Importar archivo ICS','alias-sintetico.ics','text/calendar',ics);
 const proposal=page.locator('.proposal');
 await expect(proposal).toHaveCount(1);
 await expect(proposal).toContainText('Centro y horario pendientes de revisión');
 const decision=proposal.getByRole('combobox',{name:`Decisión: ${title}`,exact:true});
 await expect(decision).toHaveValue('keep');
 await expect(decision.locator('option[value="add"]')).toHaveJSProperty('disabled',true);
 await proposal.getByRole('combobox',{name:`Centro para ${title}`}).selectOption('Hospital');
 await expect(proposal).toContainText(`${fjd} · 12 h`);
 await decision.selectOption('add');
 await page.getByRole('button',{name:'Guardar decisiones',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'1 añadidas'})).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
 const copy=await exportCopy(page);
 expect(copy.state.shifts).toHaveLength(1);
 expect(copy.state.shifts[0]).toMatchObject({centre:'Hospital',hours:12,status:'pending'});
});
