// Departamento que hizo la solicitud: columna en la Ruta del día, Excel, Solicitudes, Entregas, Seguimiento, historial y gráficos.
import { launch, open, rowsOf, check, sinErrores, DIR } from './harness.mjs';
import fs from 'fs';
import path from 'path';
const b = await launch();
const DIA = '2026-10-06';
const csv = path.join(DIR, '_departamento.csv');
fs.writeFileSync(csv, '\ufeffCliente,Departamento,Dirección,Comuna,Productos\nTeatro Municipal,Marketing,Tenderini S/N,Santiago,6x\nChilevisión,Trade,Pedro Montt 2354,Santiago,4x\n');
const setup = (email, rows) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', transportista: 'Transportes Barrientos', rows: ${JSON.stringify(rows || [])} }) }],
    ['hojasResumen/${DIA}', { fecha: '${DIA}', despachos: ${(rows || []).length} }],
    ['config/app', { transportistas: ['trs@fletes.cl'], agencias: ['ops@agencia.cl'] }]
  ] };
})()`;

console.log('Ruta del día: columna Departamento e importar Excel');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(600);
  const ths = await p.$$eval('#tabla thead th', t => t.map(x => x.textContent.trim()));
  check('la tabla tiene la columna Departamento después de Cliente', ths[1] === 'Cliente' && ths[2] === 'Departamento', ths.join(','));
  await p.setInputFiles('#excelFileInput', csv);
  await p.waitForFunction(() => /Se importaron/.test(document.querySelector('.app-dialog-msg')?.textContent || '') || document.querySelector('.app-dialog button.primary'), null, { timeout: 15000 });
  if (!/Se importaron/.test(await p.textContent('.app-dialog-msg'))) { await p.click('.app-dialog button.primary'); await p.waitForFunction(() => /Se importaron/.test(document.querySelector('.app-dialog-msg')?.textContent || ''), null, { timeout: 15000 }); }
  await p.click('.app-dialog button'); await p.waitForTimeout(900);
  const st = await rowsOf(p, 'hojasDeRuta', DIA);
  check('el Excel trae el departamento de cada despacho', st.rows.map(r => r.cliente + '=' + r.departamento).join(',') === 'Teatro Municipal=Marketing,Chilevisión=Trade', JSON.stringify(st.rows.map(r => [r.cliente, r.departamento])));
  check('se ve en la tabla', (await p.textContent('#tbody tr:first-child td:nth-child(3)')) === 'Marketing');
  await p.click('#tbody tr:nth-child(2) td:nth-child(3)'); await p.keyboard.press('End'); await p.keyboard.type(' Norte');
  await p.click('#hojaInfo'); await p.waitForTimeout(900);
  check('se puede editar', (await rowsOf(p, 'hojasDeRuta', DIA)).rows[1].departamento === 'Trade Norte');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btnExportExcel')]);
  check('exporta Excel', /hoja-de-ruta-2026-10-06\.xlsx/.test(dl.suggestedFilename()));
  await p.click('.side-item[data-view="reportes"]'); await p.waitForTimeout(300);
  check('KPIs: gráfico «Despachos por departamento»', (await p.textContent('#chartDepto')).includes('Marketing') && (await p.textContent('#chartDepto')).includes('Trade Norte'));
  sinErrores(p);
  await p.context().close();
}

const rows = [
  { id: 'a', cliente: 'Teatro Municipal', departamento: 'Marketing', direccion: 'Tenderini S/N', comuna: 'Santiago', contacto: '', productos: '6x', estado: 'entregado', tarifa: 70000,
    entrega: { recibidoPor: 'Carol Riquelme', horaEntrega: '16:50', registradoPor: 'trs@fletes.cl' } },
  { id: 'b', cliente: 'Chilevisión', departamento: 'Trade', direccion: 'Pedro Montt 2354', comuna: 'Santiago', contacto: '', productos: '4x', estado: 'pendiente', tarifa: 10000 }
];
console.log('Entregas, Seguimiento e Historial de entregas');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl', rows), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="chofer"]'); await p.waitForTimeout(200);
  check('Entregas muestra el departamento', (await p.textContent('#choferList')).includes('🏢Trade') || (await p.textContent('#choferList')).includes('Trade'));
  await p.click('.side-item[data-view="seguimiento"]'); await p.waitForTimeout(200);
  check('Seguimiento muestra el departamento', (await p.$$eval('#segLista .seg-depto', d => d.map(x => x.textContent).join(','))) === '🏢 Marketing,🏢 Trade');
  const [c] = await Promise.all([p.context().waitForEvent('page'), p.click('#segLista .seg-comprobante')]);
  await c.waitForLoadState();
  check('el comprobante de entrega lo incluye', (await c.textContent('body')).includes('Departamento: Marketing'));
  await c.close();
  await p.click('.side-item[data-view="chofer"]'); await p.waitForTimeout(200);
  const [g] = await Promise.all([p.context().waitForEvent('page'), p.click('#btnGuiaRuta')]);
  await g.waitForLoadState();
  check('la guía de la ruta tiene la columna Departamento', (await g.$$eval('thead th', t => t.map(x => x.textContent))).includes('Departamento') && (await g.textContent('tbody')).includes('Marketing'));
  await g.close();
  await p.click('.side-item[data-view="entregashist"]'); await p.waitForTimeout(200);
  await p.fill('#rDesdeE', '2026-10-01'); await p.dispatchEvent('#rDesdeE', 'change');
  await p.fill('#rHastaE', '2026-10-31'); await p.dispatchEvent('#rHastaE', 'change'); await p.waitForTimeout(600);
  const ths = await p.$$eval('#viewEntregasHist thead th', t => t.map(x => x.textContent));
  check('Historial de entregas: columna Departamento', ths[3] === 'Departamento' && (await p.textContent('#ehFilas')).includes('Marketing'), ths.join(','));
  await p.selectOption('#ehEstado', 'todas');
  await p.fill('#ehBuscar', 'trade'); await p.waitForTimeout(100);
  check('se puede buscar por departamento', (await p.$$('#ehFilas tr')).length === 1 && (await p.textContent('#ehFilas')).includes('Chilevisión'));
  sinErrores(p);
  await p.context().close();
}

console.log('Solicitudes: el departamento pasa a los despachos');
{
  const p = await open(b, { setup: setup('ops@agencia.cl'), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="solicitudes"]'); await p.waitForTimeout(200);
  await p.fill('#solNombre', 'Camila'); await p.fill('#solEmpresa', 'Agencia Kennedy'); await p.fill('#solDepartamento', 'Eventos');
  await p.fill('#solFecha', '2026-10-07');
  await p.fill('#solFilas .sol-desp:nth-child(1) input[data-k="cliente"]', 'Radio Infinita');
  await p.click('#solEnviar'); await p.waitForTimeout(500);
  const sol = await p.evaluate(() => { const k = Object.keys(window.__fs.docs).find(x => x.startsWith('hojasDeRuta/sol_')); return JSON.parse(window.__fs.docs[k].json).solicitudes[0]; });
  check('la solicitud guarda el departamento', sol.solicitante.departamento === 'Eventos');
  check('la tarjeta lo muestra', (await p.textContent('#solLista .sol-quien')).includes('🏢 Eventos'));
  const docs = await p.evaluate(() => Object.fromEntries(Object.entries(window.__fs.docs).filter(([k]) => k.startsWith('hojasDeRuta/sol_'))));
  await p.context().close();
  const q = await open(b, { setup: `(() => {
    localStorage.setItem('hojaDeRuta_actual', '${DIA}');
    window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: [['config/app', { agencias: ['ops@agencia.cl'] }]].concat(${JSON.stringify(Object.entries(docs))}) };
  })()`, width: 1280 });
  await q.waitForTimeout(600);
  await q.click('.side-item[data-view="solicitudes"]'); await q.waitForTimeout(200);
  await q.click('#solLista [data-acc="aprobar"]'); await q.waitForTimeout(800);
  check('al aprobar, el despacho queda con el departamento', (await rowsOf(q, 'hojasDeRuta', '2026-10-07')).rows[0].departamento === 'Eventos');
  sinErrores(q);
  await q.context().close();
}
fs.unlinkSync(csv);
await b.close();
