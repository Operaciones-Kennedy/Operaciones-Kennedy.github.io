// Seguimiento → Comprobante de entrega: prueba de entrega imprimible (PDF) de cada despacho entregado.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const DIA = '2026-10-05';
const foto = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const setup = email => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  const rows = [
    { id: 'a', cliente: 'Teatro Municipal', direccion: 'Tenderini S/N', comuna: 'Santiago', contacto: 'Carol Riquelme', productos: 'Coca-Cola Zero 310ml * 6 / 32 PACK', estado: 'entregado', tarifa: 70000,
      eventos: [{ tipo: 'en-ruta', at: '${DIA}T15:10:00', por: 'ruben@fletes.cl' }, { tipo: 'entregado', at: '${DIA}T16:50:00', por: 'ruben@fletes.cl' }],
      entrega: { recibidoPor: 'Carol Riquelme', horaEntrega: '16:50', registradoPor: 'ruben@fletes.cl', fotoUrl: '${foto}', firmaUrl: '${foto}' } },
    { id: 'b', cliente: 'Chilevisión', direccion: 'Pedro Montt 2354', comuna: 'Santiago', contacto: '', productos: '6x', estado: 'pendiente', tarifa: 10000 }
  ];
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', transportista: 'Transportes Barrientos', rows }) }],
    ['config/app', { transportistas: ['ruben@fletes.cl'], agencias: ['ops@agencia.cl'] }]
  ] };
})()`;

for (const [email, w] of [['ops@agencia.cl', 390], ['jefe@prueba.cl', 1280]]) {
  console.log('Comprobante de entrega (' + email + ')');
  const p = await open(b, { setup: setup(email), width: w, height: 844 });
  await p.waitForTimeout(700);
  if (w > 820) { await p.click('.side-item[data-view="seguimiento"]'); await p.waitForTimeout(300); }
  check('el botón general cuenta los entregados', (await p.textContent('#btnComprobantes')) === '📄 Comprobantes de entrega (1)' && await p.isVisible('#btnComprobantes'));
  check('solo el entregado tiene «Comprobante de entrega»', (await p.$$('#segLista .seg-comprobante')).length === 1);
  const [c] = await Promise.all([p.context().waitForEvent('page'), p.click('#segLista .seg-comprobante')]);
  await c.waitForLoadState(); await c.waitForTimeout(150);
  const txt = await c.textContent('body');
  check('número, sello y fecha', txt.includes('N° CE-20261005-01') && txt.includes('ENTREGADO · 16:50') && txt.includes('lunes, 5 de octubre de 2026'), txt.slice(0, 250));
  check('destinatario, quién recibió, quién registró y transportista', txt.includes('Teatro Municipal') && txt.includes('Carol Riquelme') && txt.includes('Registró: ruben@fletes.cl') && txt.includes('Transportes Barrientos'));
  check('productos entregados', txt.includes('Coca-Cola Zero 310ml * 6 / 32 PACK'));
  check('trazabilidad con horas', txt.includes('Salió a ruta') && txt.includes('Entregado') && txt.includes('16:50'));
  check('foto y firma', (await c.$$('figure img')).length === 2);
  check('sin montos', !txt.includes('$') && !txt.includes('70.000'));
  if(process.env.CAPTURA) await c.screenshot({ path: process.env.CAPTURA.replace('.png', '-' + w + '.png'), fullPage: true });
  await c.close();
  const [todos] = await Promise.all([p.context().waitForEvent('page'), p.click('#btnComprobantes')]);
  await todos.waitForLoadState(); await todos.waitForTimeout(150);
  check('«Comprobantes de entrega» saca solo los entregados', (await todos.$$('.hoja')).length === 1);
  await todos.close();
  if (w <= 820) check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  sinErrores(p);
  await p.context().close();
}
await b.close();
