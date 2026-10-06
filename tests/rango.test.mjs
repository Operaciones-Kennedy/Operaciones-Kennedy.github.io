// «Día / Rango» en Ruta del día, Seguimiento, Entregas, KPIs y Liquidación: ver y trabajar varios días juntos.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const setup = (email, extra) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-23');
  const fila = (id, cliente, estado, tarifa, extra) => Object.assign({ id, cliente, direccion: 'Calle ' + id, comuna: 'Ñuñoa', contacto: '', productos: '', estado, tarifa, pagado: false }, extra || {});
  const d22 = [fila('a1', 'Céline', 'entregado', 8000, { entrega: { recibidoPor: 'Ana', horaEntrega: '15:55', registradoPor: 'trs@fletes.cl' } }), fila('a2', 'Gino Costa', 'no-entregado', 8000, { entrega: { motivo: 'Cerrado', horaEntrega: '16:10' } })];
  const d23 = [fila('b1', 'Radio Infinita', 'entregado', 10000), fila('b2', 'Chilevisión', 'pendiente', 10000)];
  const d10 = [fila('c1', 'Fuera del rango', 'entregado', 5000)];
  window.__fakeParams = Object.assign({ email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/2026-09-22', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-22', transportista: 'Transportes Barrientos', transportistaEmail: 'trs@fletes.cl', rows: d22 }) }],
    ['hojasDeRuta/2026-09-23', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-23', transportista: 'Transportes Barrientos', transportistaEmail: 'trs@fletes.cl', rows: d23 }) }],
    ['hojasDeRuta/2026-08-10', { json: JSON.stringify({ titulo: 't', fecha: '2026-08-10', transportista: 'Otro', rows: d10 }) }],
    ['hojasResumen/2026-09-22', { fecha: '2026-09-22', despachos: 2 }],
    ['hojasResumen/2026-09-23', { fecha: '2026-09-23', despachos: 2 }],
    ['hojasResumen/2026-08-10', { fecha: '2026-08-10', despachos: 1 }],
    ['config/app', { transportistas: ['trs@fletes.cl'], conLiquidacion: ['trs@fletes.cl'], agencias: ['ops@agencia.cl'] }]
  ] }, ${extra || '{}'});
})()`;
async function rango(p){
  await p.click('#hojaModo [data-modo="rango"]'); await p.waitForTimeout(200);
  await p.fill('#rDesdeR', '2026-09-20'); await p.dispatchEvent('#rDesdeR', 'change');
  await p.fill('#rHastaR', '2026-09-30'); await p.dispatchEvent('#rHastaR', 'change'); await p.waitForTimeout(600);
}

console.log('Administrador: Liquidación y KPIs por rango');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(600);
  check('en la Ruta del día aparece el selector Día/Rango', await p.isVisible('#hojaModo'));
  await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(200);
  check('en Liquidación también', await p.isVisible('#hojaModo'));
  await rango(p);
  check('muestra Desde/Hasta en vez del día', await p.isVisible('#rDesdeR') && !(await p.isVisible('#hojaFecha')));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-liq.png') });
  const filas = await p.$$eval('#tbodyLiq tr', trs => trs.map(t => [...t.cells].slice(0, 3).map(c => c.textContent.trim()).join(' | ')));
  check('junta los dos días, con fecha y N° por día', filas.length === 4 && filas[0] === '1 | 22/09/2026 | Céline' && filas[2] === '1 | 23/09/2026 | Radio Infinita', filas.join(' / '));
  check('total del período $36.000', (await p.textContent('#liqTotal')) === '$36.000', await p.textContent('#liqTotal'));
  await p.check('#tbodyLiq tr:first-child input[type="checkbox"]'); await p.waitForTimeout(500);
  const d22 = await rowsOf(p, 'hojasDeRuta', '2026-09-22');
  check('marcar pagado un despacho de otro día se guarda en su ruta', d22.rows.find(r => r.id === 'a1').pagado === true);
  check('el pagado se refleja en el total', (await p.textContent('#liqPagado')) === '$8.000');
  await p.check('#tbodyLiq tr:nth-child(3) input[type="checkbox"]'); await p.waitForTimeout(900);
  const d23 = await rowsOf(p, 'hojasDeRuta', '2026-09-23');
  check('y uno del día abierto, en el suyo', d23.rows.find(r => r.id === 'b1').pagado === true);
  await p.click('.side-item[data-view="reportes"]'); await p.waitForTimeout(300);
  check('KPIs: 4 despachos del período', (await p.textContent('#statTotalDespachos')) === '4' && (await p.textContent('#reportesSub')).includes('20/09/2026 al 30/09/2026'), await p.textContent('#statTotalDespachos'));
  await p.click('#hojaModo [data-modo="dia"]'); await p.waitForTimeout(200);
  check('al volver a «Día» muestra solo el día abierto', (await p.textContent('#statTotalDespachos')) === '2');
  await p.click('.side-item[data-view="despachos"]'); await p.waitForTimeout(150);
  check('la Ruta del día sigue por día', await p.isVisible('#hojaFecha') && await p.isVisible('#tabla') && !(await p.isVisible('#despRango')));
  sinErrores(p);
  await p.context().close();
}

console.log('Administrador: Ruta del día por rango');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(600);
  await rango(p);
  check('cambia la tabla editable por la del período', await p.isVisible('#despRango') && !(await p.isVisible('#tabla')) && !(await p.isVisible('#btnAddRow')));
  const filas = () => p.$$eval('#drFilas tr', trs => trs.map(t => [...t.cells].slice(0, 3).map(c => c.textContent.trim()).join(' | ')));
  const f = await filas();
  check('junta los días del rango, con fecha y N° por día', f.join(' / ') === '22/09/2026 | 1 | Céline / 22/09/2026 | 2 | Gino Costa / 23/09/2026 | 1 | Radio Infinita / 23/09/2026 | 2 | Chilevisión', f.join(' / '));
  check('total tarifa del período $36.000', (await p.textContent('#drTotal')) === '$36.000');
  check('el progreso cuenta el período', (await p.textContent('#countEntregado')) === '2' && (await p.textContent('#countNoEntregado')) === '1' && (await p.textContent('#progressPct')) === '50%');
  await p.selectOption('#drEstado', 'entregado'); await p.waitForTimeout(100);
  check('filtra por estado', (await filas()).length === 2);
  await p.selectOption('#drEstado', '');
  await p.fill('#drBuscar', 'gino'); await p.waitForTimeout(100);
  check('busca', (await filas()).join() === '22/09/2026 | 2 | Gino Costa' && (await p.textContent('#drTotal')) === '$8.000');
  await p.fill('#drBuscar', '');
  await p.dispatchEvent('#drBuscar', 'input');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#drExcel')]);
  check('exporta Excel del período', dl.suggestedFilename() === 'rutas-2026-09-20-al-2026-09-30.xlsx', dl.suggestedFilename());
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-ruta.png') });
  await p.click('#drFilas tr:first-child a.hist-fecha'); await p.waitForTimeout(500);
  check('el enlace de la fecha abre ese día para editar', (await p.inputValue('#hojaFecha')) === '2026-09-22' && await p.isVisible('#tabla') && !(await p.isVisible('#despRango')));
  check('y vuelve al modo «Día»', await p.$eval('#hojaModo [data-modo="dia"]', e => e.classList.contains('activo')));
  sinErrores(p);
  await p.context().close();
}

console.log('Ruta del día por rango en el teléfono');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 390, height: 844 });
  await p.waitForTimeout(600);
  await rango(p);
  check('muestra la tabla del período', await p.isVisible('#drFilas') && (await p.$$('#drFilas tr')).length === 4);
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  sinErrores(p);
  await p.context().close();
}

console.log('Transportista: visto bueno y Entregas por rango');
{
  const p = await open(b, { setup: setup('trs@fletes.cl'), width: 390, height: 844 });
  await p.waitForTimeout(600);
  await rango(p);
  const txt = await p.textContent('#choferList');
  check('Entregas: agrupa por día, solo lectura', txt.includes('martes, 22 de septiembre') && txt.includes('Radio Infinita') && (await p.isVisible('#choferRangoNota')) && !(await p.$('#choferList button:has-text("Registrar entrega")')), txt.slice(0, 160));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-movil.png') });
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await p.click('.movil-tab[data-tab="liquidaciones"]'); await p.waitForTimeout(300);
  check('la Liquidación recuerda el modo Rango', await p.isVisible('#rDesdeR') && (await p.$$('#tbodyLiq tr')).length === 4);
  await p.click('#tbodyLiq tr:first-child .vb-ok'); await p.waitForTimeout(500);
  const d22 = await rowsOf(p, 'hojasDeRuta', '2026-09-22');
  const vb = d22.rows.find(r => r.id === 'a1').vistoBueno;
  check('da el visto bueno a un despacho de otro día', vb && vb.estado === 'conforme' && vb.por === 'trs@fletes.cl', JSON.stringify(vb));
  check('la tarjeta muestra 1 de 4', (await p.textContent('#liqVistoBueno')) === '1 de 4');
  sinErrores(p);
  await p.context().close();
}

console.log('Agencia: Seguimiento por rango');
{
  const p = await open(b, { setup: setup('ops@agencia.cl'), width: 1280 });
  await p.waitForTimeout(700);
  await rango(p);
  const lista = await p.$$eval('#segLista .seg-dia', hs => hs.map(h => h.textContent));
  check('un título por día', lista.length === 2 && lista[0].startsWith('martes, 22 de septiembre') && lista[0].includes('2 envío(s)'), lista.join(' / '));
  check('cuenta los estados del período', (await p.textContent('#segChips')).includes('2 Entregado') && (await p.textContent('#segChips')).includes('1 No entregado'));
  check('trazabilidad de días anteriores', (await p.textContent('#segLista')).includes('Motivo: Cerrado'));
  check('fuera del rango no aparece', !(await p.textContent('#segLista')).includes('Fuera del rango'));
  check('sigue sin montos', !(await p.textContent('#viewSeguimiento')).includes('$'));
  sinErrores(p);
  await p.context().close();
}
await b.close();
