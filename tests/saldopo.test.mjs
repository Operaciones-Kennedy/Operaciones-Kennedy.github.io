// Saldo PO: órdenes de compra, despachos con cargo a cada una, facturas y saldo disponible.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const fila = (id, cliente, tarifa, extra) => Object.assign({ id, cliente, departamento: 'Trade', direccion: 'Calle ' + id, comuna: 'Santiago', contacto: '', productos: '1x', estado: 'entregado', tarifa, pagado: false }, extra || {});
const d01 = [fila('a1', 'Andina Miraflores', 80000, { po: '4500123', numeroFactura: 'F-101' }), fila('a2', 'Embonor', 70000, { po: '4500123', numeroFactura: 'F-101' })];
const d02 = [fila('b1', 'Cinemark', 60000, { po: '4500123' }), fila('b2', 'Sin orden', 15000)];
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

console.log('Registrar una PO y ver su saldo');
let docsPO;
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(500);
  check('la sección está en Pagos', (await p.textContent('#viewSaldoPO h1')) === 'Saldo PO' && !(await p.isVisible('#hojaBar')));
  check('sin PO todavía', (await p.textContent('#poLista')).includes('Aún no hay órdenes de compra'));
  await p.fill('#poNumero', '4500123'); await p.fill('#poProveedor', 'Transportes y Logística Barrientos');
  await p.fill('#poMonto', '250000'); await p.fill('#poFecha', '2026-10-01'); await p.fill('#poDescripcion', 'Eventos Halloween');
  await p.click('#poGuardar'); await p.waitForTimeout(500);
  const l = await pos(p);
  check('se guarda en po_indice', l.length === 1 && l[0].numero === '4500123' && l[0].monto === 250000 && l[0].proveedor.includes('Barrientos'), JSON.stringify(l));
  check('el mensaje confirma', (await p.textContent('#poMsg')).includes('registrada'));
  await p.click('.side-item[data-view="despachos"]'); await p.waitForTimeout(200);
  await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(600);
  const cifras = await p.$$eval('#poLista .po-card[data-po="4500123"] .po-cifras div', ds => ds.map(d => d.textContent));
  check('usado, facturado, por facturar y saldo', cifras.join(' | ') === 'Monto PO$250.000 | Usado$210.000 · 3 desp. | Facturado$150.000 | Por facturar$60.000 | Saldo$40.000', cifras.join(' | '));
  check('resumen arriba', (await p.textContent('#poSaldo')) === '$40.000' && (await p.textContent('#poSinPO')) === '1');
  await p.fill('#poNumero', '4500123'); await p.fill('#poMonto', '1000'); await p.click('#poGuardar'); await p.waitForTimeout(300);
  check('no deja repetir el N°', (await p.textContent('#poMsg')).includes('Ya existe') && (await pos(p)).length === 1);
  await p.fill('#poNumero', ''); await p.fill('#poMonto', '');
  const [doc] = await Promise.all([p.context().waitForEvent('page'), p.click('.po-card [data-acc="documento"]')]);
  await doc.waitForLoadState();
  const txt = (await doc.textContent('body')).replace(/\s+/g, ' ');
  check('documento Saldo PO', txt.includes('Saldo de orden de compra N° 4500123') && txt.includes('Saldo disponible$40.000') && txt.includes('F-101') && txt.includes('Cinemark') && !txt.includes('Sin orden'), txt.slice(0, 300));
  await doc.close();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.po-card [data-acc="excel"]')]);
  check('Excel del saldo', dl.suggestedFilename() === 'saldo-po-4500123.xlsx');
  p.once('dialog', d => d.accept());
  await p.click('.po-card [data-acc="eliminar"]'); await p.waitForTimeout(300);
  check('no elimina una PO con despachos', (await pos(p)).length === 1);
  docsPO = await p.evaluate(() => window.__fs.docs['hojasDeRuta/po_indice']);
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA, fullPage: true });
  sinErrores(p);
  await p.context().close();
}

console.log('Asignar la PO en la Ruta del día');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl', JSON.stringify([['hojasDeRuta/po_indice', docsPO]])), width: 1280 });
  await p.waitForTimeout(700);
  const ths = await p.$$eval('#tabla thead th', t => t.map(x => x.textContent.trim()));
  check('columna PO después de Departamento', ths[3] === 'PO', ths.join(','));
  check('el despacho sin PO aparece vacío', (await p.inputValue('#tbody tr:nth-child(2) .po-celda select')) === '');
  await p.selectOption('#tbody tr:nth-child(2) .po-celda select', '4500123'); await p.waitForTimeout(900);
  check('se guarda en el despacho', (await rowsOf(p, 'hojasDeRuta', '2026-10-02')).rows[1].po === '4500123');
  await p.click('.side-item[data-view="saldopo"]'); await p.waitForTimeout(600);
  check('el saldo baja', (await p.textContent('#poSaldo')) === '$25.000' && (await p.textContent('#poSinPO')) === '0');
  await p.click('.po-card [data-acc="cerrar"]'); await p.waitForTimeout(400);
  check('cerrar la PO', (await pos(p))[0].cerrada === true && (await p.textContent('.po-card .po-chip')) === 'Cerrada');
  await p.click('.side-item[data-view="despachos"]'); await p.waitForTimeout(200);
  const ops = await p.$$eval('#tbody tr:nth-child(1) .po-celda option', o => o.map(x => x.textContent));
  check('una PO cerrada no se ofrece a despachos nuevos, pero se respeta la ya asignada', ops.join(',') === '—,4500123 (cerrada)', ops.join(','));
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
await b.close();
