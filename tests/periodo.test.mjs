import { launch, open, check, FIX, sinErrores } from './harness.mjs';
import path from 'path';
const b = await launch();
const setup = () => {
  const mk = (fecha, n, extra) => Array.from({ length: n }, (_, i) => Object.assign({ id: fecha + i, cliente: i === 0 ? 'Las Amikas' : 'Cliente ' + fecha.slice(8) + '-' + i, direccion: 'Av. Providencia 929', comuna: i % 2 ? 'Vitacura' : 'Providencia', contacto: '', productos: '', estado: i === n - 1 ? 'no-entregado' : 'entregado', hora: '', prueba: '', tarifa: 8000, pagado: i === 0 }, extra ? extra(i) : {}));
  const hojas = [
    ['2026-09-10', mk('2026-09-10', 3, i => i === 0 ? { entrega: { fotoUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', horaEntrega: '15:00' }, vistoBueno: { estado: 'conforme', por: 'juan@t.cl', at: '2026-09-10T20:00:00Z', tarifa: 8000 } } : {}), 'Juan'],
    ['2026-09-17', mk('2026-09-17', 4), 'Juan'],
    ['2026-08-28', mk('2026-08-28', 2), 'Pedro']
  ];
  const seed = [];
  hojas.forEach(([f, rows, t]) => {
    seed.push(['hojasDeRuta/' + f, { json: JSON.stringify({ titulo: 't', transportista: t, fecha: f, rows }), fecha: f }]);
    seed.push(['hojasResumen/' + f, { fecha: f, despachos: rows.length, entregados: rows.length - 1 }]);
  });
  localStorage.setItem('hojaDeRuta_actual', '2026-09-24');
  window.__fakeParams = { seed };
};
const p = await open(b, { setup });
await p.evaluate(() => document.querySelector('.side-item[data-view="historial"]').click());
await p.waitForTimeout(600);
check('barra del día oculta en historial', await p.$eval('#hojaBar', e => e.hidden));
check('rango por defecto: este mes', (await p.inputValue('#rDesdeH')) === '2026-09-01' && (await p.inputValue('#rHastaH')) === '2026-09-24');
check('septiembre: 7 despachos en 2 rutas', (await p.textContent('#hDespachos')) === '7' && (await p.textContent('#hRutas')) === '2 ruta(s)', await p.textContent('#rInfoH'));
check('cumplimiento 71%', (await p.textContent('#hCumplimiento')) === '71%', await p.textContent('#hCumplimiento'));
check('gráfico por día', (await p.textContent('#hTituloTiempo')) === 'Despachos por día');
await p.fill('#hBuscar', 'amikas'); await p.waitForTimeout(100);
const res = await p.$$eval('#hResultados tr', trs => trs.map(t => t.textContent));
check('buscar "amikas" encuentra 2 entregas', res.length === 2, res.join(' | '));
check('con foto de entrega', (await p.$$('#hResultados img.hist-foto')).length === 1);
await p.click('[data-rango="mespasado"]'); await p.waitForTimeout(500);
check('mes pasado: 2 despachos de Pedro', (await p.textContent('#hDespachos')) === '2');
await p.fill('#rDesdeH', '2026-08-01'); await p.dispatchEvent('#rDesdeH', 'change');
await p.fill('#rHastaH', '2026-09-30'); await p.dispatchEvent('#rHastaH', 'change'); await p.waitForTimeout(500);
check('dos meses: agrupa por mes', (await p.textContent('#hTituloTiempo')) === 'Despachos por mes' && (await p.textContent('#hDespachos')) === '9');


await p.evaluate(() => document.querySelector('.side-item[data-view="liqperiodo"]').click()); await p.waitForTimeout(400);
check('liquidación del período: total $72.000', (await p.textContent('#lpTotal')) === '$72.000', await p.textContent('#lpTotal'));
check('visto bueno 1 de 9', (await p.textContent('#lpVistoBueno')) === '1 de 9');
await p.selectOption('#lpTransportista', 'Pedro'); await p.waitForTimeout(100);
check('filtrar por transportista Pedro: $16.000', (await p.textContent('#lpTotal')) === '$16.000');
const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#btnImprimirLiqPeriodo')]);
await pop.waitForLoadState(); const txt = (await pop.textContent('body')).replace(/\s+/g, ' ');
check('PDF con período, columna Fecha y transportista', txt.includes('Período: 01/08/2026 al 30/09/2026') && txt.includes('28/08/2026') && txt.includes('Transportista: Pedro'), txt.slice(0, 200));
await p.click('#lpFilas tr:first-child a.hist-fecha'); await p.waitForTimeout(400);
check('el enlace de fecha abre esa ruta', (await p.inputValue('#hojaFecha')) === '2026-08-28' && !(await p.$eval('#viewDespachos', e => e.hidden)));
sinErrores(p);
await b.close();
