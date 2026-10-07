// Saldo PO: órdenes de compra por área, su documento, facturas, saldo disponible y avisos.
import { launch, open, rowsOf, check, sinErrores, DIR } from './harness.mjs';
import fs from 'fs';
import path from 'path';
const b = await launch();
const pdf = path.join(DIR, '_po.pdf');
fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const fila = (id, cliente, tarifa, extra) => Object.assign({ id, cliente, departamento: 'Trade', direccion: 'Calle ' + id, comuna: 'Santiago', contacto: '', productos: '1x', estado: 'entregado', tarifa, pagado: false }, extra || {});
const d01 = [fila('a1', 'Andina Miraflores', 80000, { po: '4500123', numeroFactura: 'F-101' }), fila('a2', 'Embonor', 70000, { po: '4500123', numeroFactura: 'F-101' })];
const d02 = [fila('b1', 'Cinemark', 60000, { po: '4500123' }), fila('b2', 'Sin orden', 15000, { departamento: 'Marketing' })];
const setup = (email, extra) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-10-02');
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/2026-10-01', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-01', transportista: 'Transportes Barrientos', rows: ${JSON.stringify(d01)} }) }],
    ['hojasDeRuta/2026-10-02', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-02', transportista: 'Transportes Barrientos', rows: ${JSON.stringify(d02)} }) }],
    ['hojasResumen/2026-10-01', { fecha: '2026-10-01', despachos: 2 }],
    ['hojasResumen/2026-10-02', { fecha: '2026-10-02', despachos: 2 }],
    ['config/app', { transportistas: ['trs@fletes.cl'] }]
  ].concat(${extra || '[]'}) };
})()`;
const pos = p => p.evaluate(() => { const d = window.__fs.docs['hojasDeRuta/po_indice']; return d ? JSON.parse(d.json).pos : []; });
async function nuevaPO(p, d){
  await p.click('#poNueva');
  await p.fill('#poNumero', d.numero); await p.fill('#poArea', d.area || ''); await p.fill('#poProveedor', d.proveedor || '');
  await p.fill('#poMonto', String(d.monto)); await p.fill('#poFecha', d.fecha || ''); await p.fill('#poDescripcion', d.descripcion || '');
  if(d.archivo) await p.setInputFiles('#poArchivo', d.archivo);
  await p.click('#poGuardar'); await p.waitForTimeout(600);
}

console.log('Registrar PO con área y documento');
let docsPO;
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(500);
  check('la sección está en Pagos', (await p.textContent('#viewSaldoPO h1')) === 'Saldo PO' && !(await p.isVisible('#hojaBar')));
  check('sin PO todavía, formulario cerrado', (await p.textContent('#poLista')).includes('Aún no hay órdenes de compra') && !(await p.isVisible('#poForm')));
  await p.click('#poNueva');
  const sugerencias = await p.$$eval('#poAreasLista option', o => o.map(x => x.value).join(','));
  check('sugiere las áreas de los despachos', sugerencias === 'Marketing,Trade', sugerencias);
  await p.click('#poCancelar');
  await nuevaPO(p, { numero: '4500123', area: 'Trade', proveedor: 'Transportes y Logística Barrientos', monto: 250000, fecha: '2026-10-01', descripcion: 'Eventos Halloween', archivo: pdf });
  const l = await pos(p);
  check('se guarda con área y documento', l.length === 1 && l[0].area === 'Trade' && l[0].monto === 250000 && l[0].archivo && l[0].archivo.tipo === 'application/pdf', JSON.stringify(l));
  check('el documento se sube a Storage', (await p.evaluate(() => window.__uploads.map(u => u.path))).some(x => x.startsWith('hojasDeRuta/po/' + l[0].id + '/')));
  await nuevaPO(p, { numero: '4500200', area: 'Marketing', monto: 100000, fecha: '2026-10-01' });
  await p.click('.side-item[data-view="despachos"]'); await p.waitForTimeout(200);
  await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(700);
  const areas = await p.$$eval('#poAreas .po-area', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check('tarjetas por área con % y saldo', areas.length === 3 && areas[0].startsWith('60%Todas las áreas') && areas[1].startsWith('84%TradeSaldo $40.000') && areas[2].startsWith('0%MarketingSaldo $100.000'), areas.join(' / '));
  const leyenda = await p.textContent('.po-card[data-po="4500123"] .po-leyenda');
  check('barra: facturado, por facturar y disponible', leyenda.replace(/\s+/g, ' ').trim() === 'Facturado $150.000Por facturar $60.000Disponible $40.000de $250.000', leyenda);
  check('semáforo ámbar sobre 70%', await p.$eval('.po-card[data-po="4500123"]', e => e.classList.contains('sem-ambar')));
  await p.click('#poAreas .po-area[data-area="Marketing"]'); await p.waitForTimeout(150);
  check('filtrar por área', (await p.$$eval('#poLista .po-card', c => c.map(x => x.dataset.po))).join() === '4500200' && (await p.textContent('#poListaTitulo')).includes('Marketing'));
  await p.click('#poAreas .po-area[data-area="Marketing"]'); await p.waitForTimeout(150);
  check('y quitar el filtro', (await p.$$('#poLista .po-card')).length === 2);
  // Panel de la PO: documento.
  await p.click('.po-card[data-po="4500123"] [data-acc="documento"]'); await p.waitForTimeout(200);
  check('el panel muestra el documento de la PO', await p.isVisible('#poPanel') && !!(await p.$('#poPanelCuerpo iframe.po-visor')) && (await p.textContent('#poPanelCuerpo .po-datos')).includes('Trade'));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-panel.png') });
  // Facturas: la detectada en despachos se registra con su PDF.
  await p.click('#poPanel .po-tabs [data-tab="facturas"]'); await p.waitForTimeout(150);
  check('detecta la factura anotada en despachos', (await p.textContent('#poPanelCuerpo .po-factura.detectada')).includes('F-101'));
  await p.click('#poPanelCuerpo .po-factura.detectada [data-acc="registrar-factura"]'); await p.waitForTimeout(150);
  check('«Registrar» prellena el formulario', (await p.inputValue('#poFacForm [name="numero"]')) === 'F-101' && (await p.inputValue('#poFacForm [name="monto"]')) === '150000');
  await p.fill('#poFacForm [name="fecha"]', '2026-10-03');
  await p.setInputFiles('#poFacForm [name="archivo"]', pdf);
  await p.click('#poFacForm button[type="submit"]'); await p.waitForTimeout(600);
  await p.fill('#poFacForm [name="numero"]', 'F-102'); await p.fill('#poFacForm [name="monto"]', '60000');
  await p.click('#poFacForm button[type="submit"]'); await p.waitForTimeout(600);
  const facs = (await pos(p)).find(x => x.numero === '4500123').facturas;
  check('facturas guardadas en la PO', facs.map(f => f.numero + '=' + f.monto).join() === 'F-101=150000,F-102=60000' && !!facs[0].archivo && facs[0].fecha === '2026-10-03', JSON.stringify(facs));
  const lf = await p.$$eval('#poPanelCuerpo .po-factura', f => f.map(x => x.textContent));
  check('lista de facturas con su PDF', lf.length === 2 && lf[0].includes('📎 Ver') && (await p.textContent('#poPanelCuerpo .po-total-fac')).includes('$210.000'), lf.join(' / '));
  check('facturado y saldo se actualizan', (await p.textContent('#poPanelResumen')).replace(/\s+/g, ' ').includes('Facturado $210.000Por facturar $0Disponible $40.000'));
  await p.click('#poPanel .po-tabs [data-tab="despachos"]'); await p.waitForTimeout(150);
  check('despachos de la PO', (await p.$$('#poPanelCuerpo tbody tr')).length === 3 && (await p.textContent('#poPanelCuerpo tfoot')).includes('$210.000'));
  await p.click('#poPanel .po-tabs [data-tab="documento"]'); await p.waitForTimeout(150);
  const [doc] = await Promise.all([p.context().waitForEvent('page'), p.click('#poPanelCuerpo [data-acc="documento"]')]);
  await doc.waitForLoadState();
  const txt = (await doc.textContent('body')).replace(/\s+/g, ' ');
  check('documento Saldo PO con área y facturas', txt.includes('Saldo de orden de compra N° 4500123') && txt.includes('Área: Trade') && txt.includes('03/10/2026') && txt.includes('F-102') && !txt.includes('Sin orden'), txt.slice(0, 300));
  await doc.close();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#poPanelCuerpo [data-acc="excel"]')]);
  check('Excel del saldo', dl.suggestedFilename() === 'saldo-po-4500123.xlsx');
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('Esc cierra el panel', !(await p.isVisible('#poPanel')));
  check('aviso de PO sobre 85%', (await p.textContent('#poAvisos')).includes('4500123') === false);
  await nuevaPO(p, { numero: '4500123', monto: 1000 });
  check('no deja repetir el N°', (await p.textContent('#poMsg')).includes('Ya existe') && (await pos(p)).length === 2);
  await p.click('#poCancelar');
  // Los enlaces blob: de esta página no sirven en otra: se cambian por una página vacía.
  docsPO = await p.evaluate(() => ({ json: window.__fs.docs['hojasDeRuta/po_indice'].json.replace(/blob:[^"]+/g, 'about:blank') }));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA, fullPage: true });
  sinErrores(p);
  await p.context().close();
}

console.log('Asignar la PO en la Ruta del día');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl', JSON.stringify([['hojasDeRuta/po_indice', docsPO]])), width: 1280 });
  await p.waitForTimeout(900);
  const ths = await p.$$eval('#tabla thead th', t => t.map(x => x.textContent.trim()));
  check('columna PO después de Departamento', ths[3] === 'PO', ths.join(','));
  const ops = await p.$$eval('#tbody tr:nth-child(2) .po-celda option', o => o.map(x => x.textContent));
  check('la lista muestra área y saldo de cada PO', ops.includes('4500123 · Trade · queda $40.000') && ops.includes('4500200 · Marketing · queda $100.000'), ops.join(' / '));
  await p.selectOption('#tbody tr:nth-child(2) .po-celda select', '4500123'); await p.waitForTimeout(900);
  check('se guarda en el despacho', (await rowsOf(p, 'hojasDeRuta', '2026-10-02')).rows[1].po === '4500123');
  check('avisa que la PO va sobre 85%', await p.isVisible('#avisoPO') && (await p.textContent('#avisoPO')).includes('va en 90%: quedan $25.000'), await p.textContent('#avisoPO'));
  await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(700);
  check('el saldo baja y aparece el aviso', (await p.textContent('#poSaldo')) === '$125.000' && (await p.textContent('#poSinPO')) === '0' && (await p.textContent('#poAvisos')).includes('La PO 4500123 (Trade) va en 90%'));
  check('semáforo rojo desde 90%', await p.$eval('.po-card[data-po="4500123"]', e => e.classList.contains('sem-rojo')));
  await p.click('#poAvisos .po-aviso'); await p.waitForTimeout(200);
  check('el aviso abre la PO', await p.isVisible('#poPanel') && (await p.textContent('#poPanelTitulo')).includes('4500123'));
  await p.click('#poPanelCuerpo').catch(() => {});
  await p.click('#poPanel .po-tabs [data-tab="documento"]'); await p.waitForTimeout(150);
  await p.click('#poPanelCuerpo [data-acc="cerrar"]'); await p.waitForTimeout(400);
  check('cerrar la PO', (await pos(p)).find(x => x.numero === '4500123').cerrada === true);
  await p.click('#poPanelCerrar');
  check('las cerradas se ocultan salvo que se pidan', !(await p.$('#poLista .po-card[data-po="4500123"]')));
  await p.check('#poVerCerradas'); await p.waitForTimeout(100);
  check('«Ver cerradas» las muestra', !!(await p.$('#poLista .po-card.cerrada[data-po="4500123"]')));
  await p.click('.side-item[data-view="despachos"]'); await p.waitForTimeout(200);
  const ops2 = await p.$$eval('#tbody tr:nth-child(1) .po-celda option', o => o.map(x => x.textContent));
  check('una PO cerrada no se ofrece, pero se respeta la ya asignada', ops2.join(',') === '—,4500123 · Trade (cerrada),4500200 · Marketing · queda $100.000', ops2.join(','));
  sinErrores(p);
  await p.context().close();
}

console.log('Saldo PO en el teléfono');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl', JSON.stringify([['hojasDeRuta/po_indice', docsPO]])), width: 390, height: 844 });
  await p.waitForTimeout(700);
  await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
  await p.click('#movilMas [data-ir="saldopo"]'); await p.waitForTimeout(700);
  check('se ven las áreas y las PO', (await p.$$('#poAreas .po-area')).length === 3 && (await p.$$('#poLista .po-card')).length === 2);
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await p.click('.po-card[data-po="4500123"]'); await p.waitForTimeout(200);
  check('el panel ocupa la pantalla', (await p.$eval('#poPanel', e => e.getBoundingClientRect().width)) === 390);
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-movil.png') });
  sinErrores(p);
  await p.context().close();
}

console.log('Despachos de días anteriores a la fecha de la PO también descuentan');
{
  const po = { id: 'p1', numero: '88003875749', area: 'Trade', monto: 150000, fecha: '2026-10-07', cerrada: false, facturas: [] };
  const r = (id, tarifa) => ({ id, cliente: 'Envío ' + id, direccion: 'Calle ' + id, comuna: 'Santiago', estado: 'entregado', tarifa, po: '88003875749' });
  const seed = [
    ['hojasDeRuta/po_indice', { json: JSON.stringify({ pos: [po] }) }],
    ['hojasDeRuta/2026-10-03', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-03', rows: [r('x1', 70000), r('x2', 50000)] }) }],
    ['hojasDeRuta/2026-10-04', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-04', rows: [r('x3', 30000), r('x4', '')] }) }],
    ['hojasResumen/2026-10-03', { fecha: '2026-10-03', despachos: 2 }],
    ['hojasResumen/2026-10-04', { fecha: '2026-10-04' }]
  ];
  const p = await open(b, { setup: `(() => { localStorage.setItem('hojaDeRuta_actual', '2026-10-08'); window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: ${JSON.stringify(seed)} }; })()`, width: 1280 });
  await p.waitForTimeout(700);
  await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(700);
  const ley = (await p.textContent('.po-card[data-po="88003875749"] .po-leyenda')).replace(/\s+/g, ' ');
  check('suma los 3 envíos aunque sean anteriores a la fecha de la PO (y aunque el resumen no traiga el conteo)', ley.includes('Por facturar $150.000') && ley.includes('Disponible $0'), ley);
  check('avisa el despacho asignado sin tarifa', ley.includes('1 despacho(s) sin tarifa'), ley);
  check('la PO queda al 100%', (await p.textContent('.po-card[data-po="88003875749"] .po-pct')) === '100%');
  sinErrores(p);
  await p.context().close();
}

console.log('El transportista no ve Saldo PO');
{
  const p = await open(b, { setup: setup('trs@fletes.cl'), width: 1280 });
  await p.waitForTimeout(600);
  check('no aparece en el menú', !(await p.isVisible('.side-item[data-view="saldopo"]')));
  sinErrores(p);
  await p.context().close();
}
fs.unlinkSync(pdf);
await b.close();
