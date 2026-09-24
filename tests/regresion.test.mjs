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
  await p.evaluate(() => document.querySelector('.nav-flyout-item[data-view="liquidaciones"]').click()); await p.waitForTimeout(200);
  await p.click('#tbodyLiq tr:nth-child(1) button.vb-ok'); await p.waitForTimeout(900);
  const st = await rowsOf(p, 'hojasDeRuta', HOY);
  check('conforme guardado', st.rows[0].vistoBueno && st.rows[0].vistoBueno.estado === 'conforme');
  check('tarjeta 1 de 6', (await p.textContent('#liqVistoBueno')) === '1 de 6');
  sinErrores(p);
  await p.context().close();
}
await b.close();
