// Liquidación del período: recordatorio de visto bueno y factura atrasados, y cierre del período en PDF.
// Reporte de gestión: sección del mapa de entregas.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const fila = (id, cliente, extra) => Object.assign({ id, cliente, direccion: 'Calle ' + id, comuna: 'Santiago', estado: 'entregado', tarifa: 8000, departamento: 'Trade', lat: -33.44, lng: -70.65 }, extra || {});
const rows = [
  fila('a', 'Sin visto bueno ni factura'),
  fila('b', 'Con todo', { numeroFactura: 'F-1', pagado: true, vistoBueno: { estado: 'conforme', por: 'trs@fletes.cl', at: '2026-10-02T12:00:00Z', tarifa: 8000 }, agencia: 'Burson', po: '4500123' }),
  fila('c', 'Pendiente', { estado: 'pendiente', lat: null, lng: null })
];
const seed = [
  ['hojasDeRuta/2026-10-01', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-01', transportista: 'Transportes Barrientos', rows }) }],
  ['hojasResumen/2026-10-01', { fecha: '2026-10-01', despachos: 3 }],
  ['hojasDeRuta/po_indice', { json: JSON.stringify({ pos: [{ id: 'p1', numero: '4500123', area: 'Trade', monto: 100000, cerrada: false, facturas: [] }] }) }]
];
const p = await open(b, { setup: `(() => { localStorage.setItem('hojaDeRuta_actual', '2026-11-04'); window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: ${JSON.stringify(seed)} }; })()`, width: 1280 });
await p.waitForTimeout(700);
await p.click('.side-item[data-view="liqperiodo"]'); await p.waitForTimeout(300);
await p.fill('#rDesdeL', '2026-10-01'); await p.dispatchEvent('#rDesdeL', 'change');
await p.fill('#rHastaL', '2026-10-31'); await p.dispatchEvent('#rHastaL', 'change'); await p.waitForTimeout(900);
console.log('Recordatorio de pendientes');
const rec = await p.textContent('#lpRecordatorio');
check('avisa visto bueno y factura atrasados', await p.isVisible('#lpRecordatorio') && rec.includes('1 sin visto bueno') && rec.includes('1 sin N° de factura'), rec);
await p.click('#lpRecordatorio [data-lp-pend="vb"]'); await p.waitForTimeout(200);
check('filtra la tabla a los pendientes', (await p.$$('#lpFilas tr')).length === 1 && (await p.textContent('#lpFilas')).includes('Sin visto bueno ni factura'));
await p.click('#lpRecordatorio [data-lp-pend=""]'); await p.waitForTimeout(200);
check('y vuelve a mostrar todos', (await p.$$('#lpFilas tr')).length === 3);

console.log('Cierre del período en PDF');
const [pdf] = await Promise.all([p.waitForEvent('popup'), p.click('#btnCierrePeriodo')]);
await pdf.waitForFunction(() => document.body && document.body.textContent.includes('Detalle de despachos'), null, { timeout: 10000 });
const txt = (await pdf.textContent('body')).replace(/\s+/g, ' ');
check('incluye operación, gasto, departamento, agencia, PO y detalle', txt.includes('Cierre del período 01/10/2026 al 31/10/2026') && txt.includes('Tasa de entrega') && txt.includes('Gasto por departamento') && txt.includes('Gasto por agencia') && txt.includes('Burson') && txt.includes('Saldo de órdenes de compra abiertas') && txt.includes('4500123') && txt.includes('Detalle de despachos (3)'), txt.slice(0, 400));
await pdf.close();

console.log('Mapa de entregas en el reporte');
await p.click('.side-item[data-view="reporte"]'); await p.waitForTimeout(300);
await p.fill('#rDesdeG', '2026-10-01'); await p.dispatchEvent('#rDesdeG', 'change');
await p.fill('#rHastaG', '2026-10-31'); await p.dispatchEvent('#rHastaG', 'change'); await p.waitForTimeout(900);
check('sección del mapa con los despachos ubicados', (await p.textContent('#rgCuerpo')).includes('Mapa de entregas') && (await p.textContent('#rgCuerpo')).includes('2 de 3 despacho(s) con ubicación') && !!(await p.$('#rgMapa')));
sinErrores(p);
await b.close();
