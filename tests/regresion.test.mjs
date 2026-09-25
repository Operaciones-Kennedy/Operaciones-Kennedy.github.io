import { launch, open, rowsOf, check, FIX, sinErrores } from './harness.mjs';
import path from 'path';

const b = await launch();
const HOY = '2026-09-27';
const setupDup = () => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-27');
  const base = [['Céline Schumann','Las Hualtatas 6172, Vitacura'],['Gino Costa','Mar Jónico 8020, Vitacura'],['Sabrina Mulligan','San Carlos de Apoquindo 936, Las Condes']];
  const rows = [];
  for (let c = 0; c < 2; c++) base.forEach((x, i) => rows.push({ id: 'r' + c + i, cliente: x[0], direccion: x[1], comuna:'', contacto:'', productos:'', estado:'entregado', hora:'', prueba:'', tarifa: 8000, pagado: c === 1 && i === 0 }));
  window.__fakeParams = { seed: [['hojasDeRuta/2026-09-27', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-27', rows }) }]] };
};
console.log('R1 importar Excel con fotos sobre lista duplicada');
for (const f of ['real-en-celda.xlsx', 'real-flotante.xlsx', 'real-imagen-url.xlsx', 'prueba-wps.xlsx']) {
  const p = await open(b, { setup: setupDup });
  await p.setInputFiles('#excelFileInput', path.join(FIX, f));
  await p.waitForSelector('.app-dialog button');
  await p.click('.app-dialog button.primary');
  await p.waitForFunction(() => /Se importaron/.test(document.querySelector('.app-dialog-msg')?.textContent || ''), null, { timeout: 15000 });
  const msg = await p.textContent('.app-dialog-msg'); await p.click('.app-dialog button');
  await p.waitForTimeout(1000);
  const st = await rowsOf(p, 'hojasDeRuta', HOY);
  const conFoto = st.rows.filter(r => r.entrega && r.entrega.fotoUrl).length;
  check(f + ': ' + msg.split('\n')[0], st.rows.length === (f === 'prueba-wps.xlsx' ? 4 : 3) && conFoto === 3, st.rows.length + ' filas, ' + conFoto + ' con foto');
  sinErrores(p);
  await p.context().close();
}
console.log('R2 visto bueno del transportista');
{
  const p = await open(b, { setup: setupDup });
  await p.evaluate(() => document.querySelector('.side-item[data-view="liquidaciones"]').click()); await p.waitForTimeout(200);
  await p.click('#tbodyLiq tr:nth-child(1) button.vb-ok'); await p.waitForTimeout(900);
  const st = await rowsOf(p, 'hojasDeRuta', HOY);
  check('conforme guardado', st.rows[0].vistoBueno && st.rows[0].vistoBueno.estado === 'conforme');
  check('tarjeta 1 de 6', (await p.textContent('#liqVistoBueno')) === '1 de 6');
  sinErrores(p);
  await p.context().close();
}
console.log('R-filas en blanco: no se guardan ni se muestran como despachos');
{
  const p = await open(b, { setup: () => {
    const vacia = id => ({ id, cliente: '', direccion: '', comuna: '', contacto: '', productos: '', estado: 'pendiente', hora: '', prueba: '', tarifa: '', pagado: false });
    const llena = (id, c) => Object.assign(vacia(id), { cliente: c, direccion: 'Calle ' + c });
    localStorage.setItem('hojaDeRuta_actual', '2026-09-25');
    window.__fakeParams = { seed: [['hojasDeRuta/2026-09-25', { json: JSON.stringify({ titulo: 't', rows: [vacia('v1'), vacia('v2'), vacia('v3'), llena('a', 'Ana'), llena('b', 'Beto')] }) }]] };
  }});
  await p.waitForTimeout(600);
  check('solo se ven los 2 despachos con datos', (await p.$$('#tbody tr')).length === 2, String((await p.$$('#tbody tr')).length));
  check('pendientes: 2', (await p.textContent('#countPendiente')) === '2', await p.textContent('#countPendiente'));
  await p.click('#btnAddRow'); await p.waitForTimeout(900);
  check('«Agregar despacho» muestra la fila nueva', (await p.$$('#tbody tr')).length === 3);
  const enLinea = await rowsOf(p, 'hojasDeRuta', '2026-09-25');
  check('en línea quedan solo los 2 con datos', enLinea.rows.length === 2 && enLinea.rows.every(r => r.cliente), enLinea.rows.map(r => r.id).join(','));
  await p.click('#tbody tr:nth-child(3) td:nth-child(2)');
  await p.keyboard.type('Carla');
  await p.click('#hojaInfo'); await p.waitForTimeout(900);
  const tras = await rowsOf(p, 'hojasDeRuta', '2026-09-25');
  check('al escribirle un dato, se guarda', tras.rows.length === 3 && tras.rows[2].cliente === 'Carla', tras.rows.map(r => r.cliente).join(','));
  await p.evaluate(() => document.querySelector('.side-item[data-view="chofer"]').click()); await p.waitForTimeout(300);
  const tarjetas = await p.$eval('#choferList', e => e.textContent);
  check('Entregas no muestra «(sin cliente)»', !tarjetas.includes('(sin cliente)'));
  sinErrores(p);
  await p.context().close();
}
console.log('R-día nuevo: una sola fila en blanco y nada guardado');
{
  const p = await open(b, { setup: () => { localStorage.setItem('hojaDeRuta_actual', '2026-10-02'); window.__fakeParams = { seed: [] }; } });
  await p.waitForTimeout(500);
  check('una sola fila para empezar', (await p.$$('#tbody tr')).length === 1);
  await p.evaluate(() => { const t = document.getElementById('titulo'); t.textContent = 'Otra ruta'; t.dispatchEvent(new Event('input')); });
  await p.waitForTimeout(900);
  const d = await rowsOf(p, 'hojasDeRuta', '2026-10-02');
  check('se guarda el título sin filas en blanco', d && d.titulo === 'Otra ruta' && d.rows.length === 0, JSON.stringify(d && d.rows));
  sinErrores(p);
  await p.context().close();
}
await b.close();
