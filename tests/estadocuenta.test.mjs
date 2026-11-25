// Estado de cuenta de un área (PACS): pagado, adeudado, mes a mes, facturas con vencimiento y detalle, en PDF.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const fila = (id, cliente, tarifa, extra) => Object.assign({ id, cliente, direccion: 'Calle ' + id, comuna: 'Santiago', estado: 'entregado', tarifa, pagado: false }, extra || {});
const sep = [
  fila('a1', 'Andina Miraflores', 8000, { departamento: 'PACS', numeroFactura: 'F-1', pagado: true }),
  fila('a2', 'Embonor', 35000, { departamento: 'PACS', numeroFactura: 'F-2' }),
  fila('a3', 'Otra área', 50000, { departamento: 'Trade' })
];
const oct = [
  fila('b1', 'Por PO', 8000, { po: '4500999' }),
  fila('b2', 'Minúsculas', 70000, { departamento: 'pacs', numeroFactura: 'F-2' })
];
const seed = [
  ['hojasDeRuta/2026-09-10', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-10', transportista: 'Transportes Barrientos', rows: sep }) }],
  ['hojasDeRuta/2026-10-05', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-05', transportista: 'Transportes Barrientos', rows: oct }) }],
  ['hojasResumen/2026-09-10', { fecha: '2026-09-10', despachos: 3 }],
  ['hojasResumen/2026-10-05', { fecha: '2026-10-05', despachos: 2 }],
  ['hojasDeRuta/po_indice', { json: JSON.stringify({ pos: [{ id: 'p1', numero: '4500999', area: 'PACS', monto: 500000, fecha: '2026-09-01', cerrada: false, facturas: [{ id: 'f2', numero: 'F-2', fecha: '2026-09-15', monto: 105000 }] }] }) }]
];
const p = await open(b, { setup: `(() => { localStorage.setItem('hojaDeRuta_actual', '2020-01-01'); window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: ${JSON.stringify(seed)} }; })()`, width: 1280 });
await p.waitForTimeout(700);
await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(900);
console.log('Selector de área');
const opciones = await p.$$eval('#ecArea option', o => o.map(x => x.value));
check('parte en PACS y no repite el área escrita distinto', (await p.inputValue('#ecArea')) === 'PACS' && opciones.filter(x => x.toLowerCase() === 'pacs').length === 1, opciones.join(','));

console.log('Estado de cuenta en PDF');
const [pdf] = await Promise.all([p.waitForEvent('popup'), p.click('#btnEstadoCuenta')]);
await pdf.waitForFunction(() => document.body && document.body.textContent.includes('Detalle de despachos'), null, { timeout: 10000 });
const txt = (await pdf.textContent('body')).replace(/\s+/g, ' ');
check('título del área', txt.includes('Estado de cuenta · PACS'), txt.slice(0, 200));
check('total, pagado y lo que se debe', txt.includes('Total despachado$121.000') && txt.includes('Pagado$8.000') && txt.includes('Debemos$113.000'), txt.slice(0, 600));
check('separa lo facturado de lo que falta facturar', txt.includes('$105.000 ya está facturado') && txt.includes('$8.000 son despachos que el transportista aún no factura'));
check('factura vencida (emisión + 30 días)', txt.includes('Facturas vencidas$105.000') && txt.includes('F-215/09/202615/10/2026') && txt.includes('Vencida'));
const meses = await pdf.$$eval('h2', hs => { const h = hs.find(x => x.textContent === 'Mes a mes'); return [...h.nextElementSibling.querySelectorAll('tbody tr td:first-child')].map(t => t.textContent); });
check('mes a mes en orden cronológico', meses.join(',') === 'Septiembre 2026,Octubre 2026,Total', meses.join(','));
check('incluye la PO del área y el detalle sin otras áreas', txt.includes('4500999') && txt.includes('Detalle de despachos (4)') && !txt.includes('Otra área'));
await pdf.close();
sinErrores(p);
await b.close();
