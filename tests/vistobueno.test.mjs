// Visto bueno en la Liquidación: el transportista de la ruta y también el administrador.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const DIA = '2026-09-23';
const fila = (id, cliente) => ({ id, cliente, direccion: 'Calle ' + id, comuna: 'Vitacura', contacto: '', productos: '', estado: 'entregado', tarifa: 8000, pagado: false });
const setup = email => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', transportista: 'Transportes Barrientos', transportistaEmail: 'trs@fletes.cl', rows: ${JSON.stringify([fila('a', 'Céline Schumann'), fila('b', 'Gino Costa'), fila('c', 'Sabrina Mulligan')])} }) }],
    ['config/app', { transportistas: ['trs@fletes.cl', 'otro@fletes.cl'], conLiquidacion: ['trs@fletes.cl', 'otro@fletes.cl'] }]
  ] };
})()`;

console.log('El administrador puede dar el visto bueno');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(300);
  check('ve los botones en cada despacho (no «Esperando revisión»)', (await p.$$('#tbodyLiq button.vb-ok')).length === 3 && !(await p.textContent('#tbodyLiq')).includes('Esperando revisión'));
  await p.click('#tbodyLiq tr:nth-child(1) button.vb-ok'); await p.waitForTimeout(900);
  let st = await rowsOf(p, 'hojasDeRuta', DIA);
  check('queda conforme, con su correo y como operación', st.rows[0].vistoBueno.estado === 'conforme' && st.rows[0].vistoBueno.por === 'jefe@prueba.cl' && st.rows[0].vistoBueno.operacion === true, JSON.stringify(st.rows[0].vistoBueno));
  check('el sello dice «(operación)»', (await p.textContent('#tbodyLiq tr:nth-child(1) .vb-stamp')).includes('✅ Conforme (operación)'));
  await p.click('#tbodyLiq tr:nth-child(2) button.vb-obs'); await p.waitForTimeout(150);
  await p.fill('#tbodyLiq tr:nth-child(2) textarea', 'No llegó a la hora'); await p.click('#tbodyLiq tr:nth-child(2) button.vb-obs'); await p.waitForTimeout(900);
  st = await rowsOf(p, 'hojasDeRuta', DIA);
  check('también puede observar', st.rows[1].vistoBueno.estado === 'observado' && st.rows[1].vistoBueno.comentario === 'No llegó a la hora');
  check('la tarjeta cuenta 1 de 3', (await p.textContent('#liqVistoBueno')) === '1 de 3');
  await p.click('#tbodyLiq tr:nth-child(1) .vb-link'); await p.waitForTimeout(900);
  check('y cambiarlo', !(await rowsOf(p, 'hojasDeRuta', DIA)).rows[0].vistoBueno);
  sinErrores(p);
  await p.context().close();
}

console.log('Otro transportista no puede dar el visto bueno de esta ruta');
{
  const p = await open(b, { setup: setup('otro@fletes.cl'), width: 1280 });
  await p.waitForTimeout(700);
  await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(300);
  check('no ve los botones', !(await p.$('#tbodyLiq button.vb-ok')) && (await p.textContent('#tbodyLiq')).includes('Esperando revisión del transportista'));
  sinErrores(p);
  await p.context().close();
}
await b.close();
