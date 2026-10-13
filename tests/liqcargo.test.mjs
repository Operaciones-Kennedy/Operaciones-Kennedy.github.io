// La liquidación dice qué departamento está a cargo y qué orden de compra la paga.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const DIA = '2026-10-13';
const fila = (id, cliente, extra) => Object.assign({ id, cliente, direccion: 'Calle ' + id, comuna: 'Vitacura', contacto: '', productos: '', estado: 'entregado', tarifa: 8000, pagado: false }, extra);
const setup = rows => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', transportista: 'Transportes Barrientos', rows: ${JSON.stringify(rows)} }) }],
    ['hojasResumen/${DIA}', { fecha: '${DIA}', despachos: ${rows.length} }],
    ['hojasDeRuta/po_indice', { json: JSON.stringify({ pos: [{ id: 'p1', numero: '88003875749', area: 'Trade', monto: 100000, fecha: '${DIA}', facturas: [] }] }) }]
  ] };
})()`;

console.log('Una ruta de un solo departamento y una PO');
{
  const p = await open(b, { setup: setup([fila('a', 'Céline', { departamento: 'Trade', po: '88003875749' }), fila('b', 'Gino Costa', { departamento: 'Trade', po: '88003875749' })]), width: 1280 });
  await p.waitForTimeout(700);
  await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(300);
  check('la tarjeta muestra departamento y PO', (await p.textContent('#liqDepto')) === 'Trade' && (await p.textContent('#liqPO')) === 'N° 88003875749 (Trade)', (await p.textContent('#liqCargo')));
  const ths = await p.$$eval('#viewLiquidaciones thead th', t => t.map(x => x.textContent.trim()).filter(Boolean));
  check('la tabla tiene Departamento y PO', ths.includes('Departamento') && ths.includes('PO'), ths.join(','));
  const [pdf] = await Promise.all([p.waitForEvent('popup'), p.click('#btnImprimirLiq')]);
  await pdf.waitForLoadState();
  const txt = (await pdf.textContent('body')).replace(/\s+/g, ' ');
  check('el PDF lo dice en el encabezado', txt.includes('Departamento a cargo: Trade') && txt.includes('Orden de compra: N° 88003875749 (Trade)'), txt.slice(0, 400));
  check('con un solo valor no repite la columna', !(await pdf.$$eval('thead th', t => t.map(x => x.textContent))).includes('PO'));
  await pdf.close();
  sinErrores(p);
  await p.context().close();
}

console.log('Varios departamentos y un despacho sin PO');
{
  const p = await open(b, { setup: setup([fila('a', 'Céline', { departamento: 'Trade', po: '88003875749' }), fila('b', 'Gino Costa', { departamento: 'Marketing' })]), width: 1280 });
  await p.waitForTimeout(700);
  await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(300);
  check('lista los departamentos', (await p.textContent('#liqDepto')) === 'Marketing, Trade');
  check('avisa el despacho sin PO', (await p.textContent('#liqPO')) === 'N° 88003875749 (Trade) (1 despacho(s) sin orden de compra)', await p.textContent('#liqPO'));
  const [pdf] = await Promise.all([p.waitForEvent('popup'), p.click('#btnImprimirLiq')]);
  await pdf.waitForLoadState();
  const ths = await pdf.$$eval('thead th', t => t.map(x => x.textContent));
  check('el PDF agrega las columnas Departamento y PO', ths.includes('Departamento') && ths.includes('PO'), ths.join(','));
  await pdf.close();
  await p.click('.side-item[data-view="liqperiodo"]'); await p.waitForTimeout(200);
  await p.fill('#rDesdeL', '2026-10-01'); await p.dispatchEvent('#rDesdeL', 'change');
  await p.fill('#rHastaL', '2026-10-31'); await p.dispatchEvent('#rHastaL', 'change'); await p.waitForTimeout(600);
  check('la Liquidación del período también lo dice', (await p.textContent('#lpDepto')) === 'Marketing, Trade' && (await p.textContent('#lpPO')).startsWith('N° 88003875749'));
  check('y su tabla tiene la columna PO', (await p.textContent('#lpFilas')).includes('88003875749'));
  sinErrores(p);
  await p.context().close();
}
await b.close();
