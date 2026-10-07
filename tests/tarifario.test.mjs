// Tarifario: la tarifa de cada despacho se elige de una lista, no se escribe a mano.
import { launch, open, rowsOf, check, sinErrores, DIR } from './harness.mjs';
import fs from 'fs';
import path from 'path';
const b = await launch();
const DIA = '2026-10-08';
const csv = path.join(DIR, '_tarifario.csv');
fs.writeFileSync(csv, '﻿Cliente,Dirección,Comuna,Tipo de servicio\nTeatro Municipal,Tenderini S/N,Santiago,1/2 camión\nChilevisión,Pedro Montt 2354,Santiago,Punto simple\n');
const rows = [
  { id: 'a', cliente: 'Radio Infinita', direccion: 'Vicuña Mackenna 1370', comuna: 'Ñuñoa', contacto: '', productos: '', estado: 'pendiente', tarifa: 8000 },
  { id: 'b', cliente: 'Cliente antiguo', direccion: 'Merced 10', comuna: 'Santiago', contacto: '', productos: '', estado: 'pendiente', tarifa: 12000 },
  { id: 'c', cliente: 'Sin tarifa', direccion: 'Lastarria 90', comuna: 'Santiago', contacto: '', productos: '', estado: 'pendiente', tarifa: '' }
];
const setup = `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', rows: ${JSON.stringify(rows)} }) }]
  ] };
})()`;

console.log('Elegir la tarifa del tarifario');
{
  const p = await open(b, { setup, width: 1280 });
  await p.waitForTimeout(600);
  const ops = await p.$$eval('#tbody tr:first-child select.tarifa option', o => o.map(x => x.textContent));
  check('lista con los 5 servicios', ops.join(' | ') === 'Elegir… | Punto simple · $8.000 | 1/4 de camión · $35.000 | 1/2 camión · $50.000 | Camión completo · $70.000 | Servicio especial · $100.000', ops.join(' | '));
  check('ya no se escribe a mano', !(await p.$('#tbody input.tarifa')));
  check('muestra la tarifa guardada', (await p.inputValue('#tbody tr:first-child select.tarifa')) === '8000');
  check('un monto antiguo se conserva como «fuera de tarifario»', (await p.$eval('#tbody tr:nth-child(2) select.tarifa', s => s.options[s.selectedIndex].textContent)) === '$12.000 (fuera de tarifario)');
  check('sin tarifa queda en «Elegir…»', (await p.inputValue('#tbody tr:nth-child(3) select.tarifa')) === '' && await p.$eval('#tbody tr:nth-child(3) select.tarifa', s => s.classList.contains('vacia')));
  await p.selectOption('#tbody tr:nth-child(3) select.tarifa', '70000'); await p.waitForTimeout(900);
  const st = await rowsOf(p, 'hojasDeRuta', DIA);
  check('se guarda monto y servicio', st.rows[2].tarifa === 70000 && st.rows[2].servicio === 'Camión completo', JSON.stringify(st.rows[2]));
  check('el total se actualiza', (await p.textContent('#totalTarifa')) === '$90.000', await p.textContent('#totalTarifa'));
  if(process.env.CAPTURA){ await p.$eval('#viewDespachos .table-wrap', w => { w.scrollLeft = w.scrollWidth; }); await (await p.$('#viewDespachos .table-card')).screenshot({ path: process.env.CAPTURA }); }
  sinErrores(p);
  await p.context().close();
}

console.log('Excel con «Tipo de servicio»');
{
  const p = await open(b, { setup: `(() => { localStorage.setItem('hojaDeRuta_actual', '2026-10-09'); window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: [] }; })()`, width: 1280 });
  await p.waitForTimeout(600);
  await p.setInputFiles('#excelFileInput', csv);
  await p.waitForFunction(() => /Se importaron/.test(document.querySelector('.app-dialog-msg')?.textContent || '') || document.querySelector('.app-dialog button.primary'), null, { timeout: 15000 });
  if (!/Se importaron/.test(await p.textContent('.app-dialog-msg'))) { await p.click('.app-dialog button.primary'); await p.waitForFunction(() => /Se importaron/.test(document.querySelector('.app-dialog-msg')?.textContent || ''), null, { timeout: 15000 }); }
  await p.click('.app-dialog button'); await p.waitForTimeout(900);
  const st = await rowsOf(p, 'hojasDeRuta', '2026-10-09');
  check('el servicio del Excel pone la tarifa', st.rows.map(r => r.cliente + '=' + r.tarifa + '/' + r.servicio).join(',') === 'Teatro Municipal=50000/1/2 camión,Chilevisión=8000/Punto simple', JSON.stringify(st.rows.map(r => [r.cliente, r.tarifa, r.servicio])));
  sinErrores(p);
  await p.context().close();
}
fs.unlinkSync(csv);
await b.close();
