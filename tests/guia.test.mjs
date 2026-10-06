// Entregas → Guía de despacho: respaldo imprimible de la ruta (completa o una página por cliente), sin montos.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const DIA = '2026-10-05';
const setup = email => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  const fila = (id, cliente, estado, extra) => Object.assign({ id, cliente, direccion: 'Calle ' + id, comuna: 'Ñuñoa', contacto: '+56 9 1111 2222', productos: '6x Coca-Cola', estado, tarifa: 9000, pagado: false }, extra || {});
  const rows = [
    fila('a', 'Radio Infinita', 'entregado', { entrega: { recibidoPor: 'Ana Pérez', horaEntrega: '11:30', registradoPor: 'trs@fletes.cl', firmaUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }),
    fila('b', 'Chilevisión', 'pendiente'),
    { id: 'c', cliente: '', direccion: '', comuna: '', contacto: '', productos: '', estado: 'pendiente', tarifa: 0 }
  ];
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 'Despachos PACS', fecha: '${DIA}', puntoPartida: 'Av. Kennedy 5757', transportista: 'Transportes Barrientos', transportistaEmail: 'trs@fletes.cl', rows }) }],
    ['config/app', { transportistas: ['trs@fletes.cl'] }]
  ] };
})()`;

for (const [email, w] of [['trs@fletes.cl', 390], ['jefe@prueba.cl', 1280]]) {
  console.log('Guía de despacho (' + email + ')');
  const p = await open(b, { setup: setup(email), width: w, height: 844 });
  await p.waitForTimeout(600);
  if (w > 820) await p.click('.side-item[data-view="chofer"]'); else await p.click('.movil-tab[data-tab="chofer"]');
  await p.waitForTimeout(200);
  check('Entregas muestra la tarjeta de guía', await p.isVisible('#guiaCard'));
  const [g] = await Promise.all([p.context().waitForEvent('page'), p.click('#btnGuiaRuta')]);
  await g.waitForLoadState(); await g.waitForTimeout(100);
  const txt = await g.textContent('body');
  check('guía de la ruta: número, fecha, transportista y punto de partida', txt.includes('N° GD-20261005') && txt.includes('lunes, 5 de octubre de 2026') && txt.includes('Transportes Barrientos') && txt.includes('Av. Kennedy 5757'), txt.slice(0, 300));
  const filas = await g.$$eval('tbody tr', trs => trs.map(t => t.cells[1].textContent));
  check('una fila por despacho, sin filas vacías', filas.join(',') === 'Radio Infinita,Chilevisión' && txt.includes('2 despachos'), filas.join(','));
  check('estado y quién recibió', txt.includes('Entregado 11:30') && txt.includes('Recibió: Ana Pérez'));
  check('firmas de entrega y recepción', txt.includes('Entrega la carga') && txt.includes('Recibe la carga (transportista)'));
  check('sin montos', !txt.includes('$') && !txt.includes('9.000'));
  check('aclara que no reemplaza la guía del SII', txt.includes('No reemplaza la guía de despacho electrónica del SII'));
  if(process.env.CAPTURA) await g.screenshot({ path: process.env.CAPTURA.replace('.png', '-ruta-' + w + '.png'), fullPage: true });
  await g.close();
  const [c] = await Promise.all([p.context().waitForEvent('page'), p.click('#btnGuiaClientes')]);
  await c.waitForLoadState(); await c.waitForTimeout(100);
  const hojas = await c.$$eval('.hoja', hs => hs.map(h => h.querySelector('.doc span').textContent + ' ' + h.querySelector('.cliente b').textContent + ' ' + h.querySelector('.copia').textContent));
  check('por cliente: copia cliente y copia transportista, con su número', hojas.join(' | ') === 'N° GD-20261005-01 Radio Infinita Copia cliente | N° GD-20261005-01 Radio Infinita Copia transportista · Respaldo | N° GD-20261005-02 Chilevisión Copia cliente | N° GD-20261005-02 Chilevisión Copia transportista · Respaldo', hojas.join(' | '));
  const resp = await c.textContent('.hoja.respaldo');
  check('la copia del transportista trae la recepción conforme (nombre, RUT, fecha, hora, firma), sin «cedible» ni ley de factoring', ['Recepción conforme', 'Nombre de quien recibe', 'RUT', 'Fecha', 'Hora', 'Firma'].every(x => resp.includes(x)) && !/cedible|19\.983|factura/i.test(await c.textContent('body')) && !(await c.$('.hoja:not(.respaldo) .acuse')));
  check('la entregada lleva quién recibió y la firma', (await c.textContent('.hoja:first-child .entregado')).includes('Ana Pérez') && !!(await c.$('.hoja:first-child .entregado img')));
  check('salto de página entre clientes', (await c.$eval('.hoja + .hoja', h => getComputedStyle(h).breakBefore)) === 'page');
  if(process.env.CAPTURA) await c.screenshot({ path: process.env.CAPTURA.replace('.png', '-cliente-' + w + '.png'), fullPage: true });
  await c.close();
  // Guía de un solo cliente desde su tarjeta en Entregas
  const idx = await p.$$eval('#choferList .chofer-card', cs => cs.findIndex(c => c.textContent.includes('Chilevisión')));
  const [u] = await Promise.all([p.context().waitForEvent('page'), p.click(`#choferList .chofer-card >> nth=${idx} >> .btn-guia-cliente`)]);
  await u.waitForLoadState(); await u.waitForTimeout(100);
  const unica = await u.$$eval('.hoja', hs => hs.map(h => h.querySelector('.doc span').textContent + ' ' + h.querySelector('.cliente b').textContent));
  check('«🧾 Guía» en la tarjeta saca solo la de ese cliente (sus dos copias)', unica.join(' | ') === 'N° GD-20261005-02 Chilevisión | N° GD-20261005-02 Chilevisión' && (await u.title()).includes('GD-20261005-02'), unica.join(' | '));
  if(process.env.CAPTURA && w <= 820) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-entregas.png') });
  await u.close();
  if (w <= 820) check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  sinErrores(p);
  await p.context().close();
}
await b.close();
