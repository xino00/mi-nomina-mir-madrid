// Flujos con perfiles, eventos y recibos inventados; ningún dato de usuario.
import {test,expect} from '@playwright/test';

test('ICS genérico, Cercedilla y Torrelodones aplican las horas sin exigir asignar centros',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Inicio de residencia',{exact:true}).fill('2024-07-01');
 await page.getByLabel('Nombre del centro',{exact:true}).fill('Hospital de prueba');
 await page.getByLabel('Municipio',{exact:true}).fill('Getafe');
 await page.getByRole('button',{name:'Empezar',exact:true}).click();
 await page.getByLabel('Mes de cobro seleccionado').fill('2026-09');
 await page.getByRole('navigation').getByRole('button',{name:'Guardias',exact:true}).click();
 await page.getByRole('button',{name:'Calendario',exact:true}).click();
 const events=[['20260810','Guardia',17],['20260811','Guardia Cercedilla',17],['20260812','Guardia Torrelodones',11],['20260815','Guardia Torrelodones',24],['20260816','Guardia Cercedilla',24]] as const;
 const ics=['BEGIN:VCALENDAR','VERSION:2.0',...events.flatMap(([date,title],i)=>['BEGIN:VEVENT',`UID:horas-${i}@example.invalid`,`DTSTART;VALUE=DATE:${date}`,`SUMMARY:${title}`,'END:VEVENT']),'END:VCALENDAR'].join('\r\n');
 const upload=async()=>{const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Importar archivo ICS',exact:true}).click();await(await chooser).setFiles({name:'horarios.ics',mimeType:'text/calendar',buffer:Buffer.from(ics)});};
 await upload();
 await expect(page.locator('.proposal')).toHaveCount(events.length);
 for(let i=0;i<events.length;i++){
  const proposal=page.locator('.proposal').nth(i);
  await expect(proposal.locator('.badge')).toHaveText('Nueva');
  await expect(proposal).toContainText(`${events[i][2]} h`);
  await expect(proposal.getByRole('combobox')).toHaveValue('add');
 }
 await expect(page.getByText('Centro sin asignar',{exact:false})).toHaveCount(0);
 await page.screenshot({path:'.test-artifacts/calendar-hours-390.png'});
 await page.getByRole('button',{name:'Guardar decisiones',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'5 añadidas'})).toBeVisible();
 await upload();await expect(page.getByText('No hay cambios pendientes.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await expect(page.locator('.shift-row')).toHaveCount(events.length);
 await page.locator('.shift-row').nth(0).click();
 await page.getByRole('combobox',{name:'Estado',exact:true}).selectOption('confirmed');
 await page.getByRole('button',{name:'Guardar guardia',exact:true}).click();
 await expect(page.locator('dialog')).toHaveCount(0);
 await page.locator('.shift-row').nth(2).click();
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('11');
 await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-08-22');
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('24');
 await page.getByLabel('Fecha trabajada',{exact:true}).fill('2026-08-12');
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('11');
 await page.getByLabel('Horas abonables',{exact:true}).fill('12,5');
 await page.getByRole('combobox',{name:'Estado',exact:true}).selectOption('confirmed');
 await page.getByRole('button',{name:'Guardar guardia',exact:true}).click();
 await page.getByRole('button',{name:'Calendario',exact:true}).click();await upload();
 await page.getByRole('button',{name:'Guardar decisiones',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.locator('.shift-row').nth(2).click();
 await expect(page.getByLabel('Horas abonables',{exact:true})).toHaveValue('12,5');
 await expect(page.getByRole('combobox',{name:'Estado',exact:true})).toHaveValue('confirmed');
});
