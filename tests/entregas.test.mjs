// Reportes → Historial de entregas: quién recibió, hora, foto y firma de cada entrega del período.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const setup = () => {
  const foto = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const fila = (id, cliente, estado, entrega) => ({ id, cliente, direccion: 'Av. Providencia 929', comuna: 'Providencia', contacto: '', productos: '', estado, tarifa: 8000, pagado: false, entrega });
  const hojas = [
    ['2026-08-10', [
      fila('a', 'Radio Infinita', 'entregado', { recibidoPor: 'Victoria Jordán', horaEntrega: '15:08', registradoPor: 'trs.barrientos80@gmail.com', fotoUrl: foto, firmaUrl: foto }),
      fila('b', 'Las Amikas', 'no-entregado', { motivo: 'Local cerrado', horaEntrega: '16:30', registradoPor: 'ruben24m@gmail.com' }),
      fila('c', 'Pendiente SA', 'pendiente')]],
    ['2026-08-12', [fila('d', 'Café Rojo', 'entregado', { recibidoPor: 'Pedro', horaEntrega: '09:15', registradoPor: 'jormansvivas19@gmail.com', fotoUrl: foto })]]
  ];
  const seed = [];
  hojas.forEach(([f, rows]) => {
    seed.push(['hojasDeRuta/' + f, { json: JSON.stringify({ titulo: 't', transportista: 'Transportes Barrientos', fecha: f, rows }), fecha: f }]);
    seed.push(['hojasResumen/' + f, { fecha: f, despachos: rows.length, entregados: 1 }]);
  });
  localStorage.setItem('hojaDeRuta_actual', '2026-08-12');
  window.__fakeParams = { seed };
};

for (const w of [1280, 390]) {
  console.log('Historial de entregas (' + (w > 820 ? 'computador' : 'teléfono') + ')');
  const p = await open(b, { setup, width: w, height: 844 });
  if (w > 820) await p.click('.side-item[data-view="entregashist"]');
  else { await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150); await p.click('#movilMas [data-ir="entregashist"]'); }
  await p.waitForTimeout(300);
  check('abre la sección', !(await p.$eval('#viewEntregasHist', e => e.hidden)) && await p.$eval('#hojaBar', e => e.hidden));
  await p.fill('#rDesdeE', '2026-08-01'); await p.dispatchEvent('#rDesdeE', 'change');
  await p.fill('#rHastaE', '2026-08-31'); await p.dispatchEvent('#rHastaE', 'change'); await p.waitForTimeout(500);
  const filas = () => p.$$eval('#ehFilas tr', trs => trs.map(tr => [...tr.cells].slice(0, 7).map(td => td.textContent.trim()).join(' | ')));
  const f = await filas();
  check('lo más reciente primero, sin pendientes', f.length === 3 && f[0].startsWith('12/08/2026 | 09:15 | Café Rojo') && f[1].startsWith('10/08/2026 | 16:30 | Las Amikas'), f.join('\n'));
  check('muestra quién recibió y quién registró', f.some(x => x.includes('Victoria Jordán') && x.includes('trs.barrientos80@gmail.com')));
  check('en no entregado muestra el motivo', f[1].includes('Motivo: Local cerrado'), f[1]);
  check('foto y firma como miniaturas', (await p.$$('#ehFilas tr:nth-child(3) .eh-respaldo img.hist-foto')).length === 2);
  check('resumen: 2 entregados, 1 no entregado, 1 sin cerrar', (await p.textContent('#ehEntregados')) === '2' && (await p.textContent('#ehNoEntregados')) === '1' && (await p.textContent('#ehPendientes')) === '1');
  await p.selectOption('#ehEstado', 'no-entregado'); await p.waitForTimeout(100);
  check('filtro por estado', (await filas()).length === 1);
  await p.selectOption('#ehEstado', 'cerradas');
  await p.fill('#ehBuscar', 'victoria'); await p.waitForTimeout(100);
  check('buscar por quién recibió', (await filas()).length === 1 && (await filas())[0].includes('Radio Infinita'));
  await p.fill('#ehBuscar', '');
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-' + w + '.png'), fullPage: true });
  if (w <= 820) check('no se sale de la pantalla en el teléfono', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  if (w > 820) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#ehExcel')]);
    check('exporta Excel', /historial-entregas-2026-08-01-al-2026-08-31\.xlsx/.test(dl.suggestedFilename()), dl.suggestedFilename());
  }
  sinErrores(p);
  await p.context().close();
}
await b.close();
