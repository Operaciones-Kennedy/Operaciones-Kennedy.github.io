// Solicitudes: acordar la fecha entre la agencia y la operación, y aprobar desde Entregas.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const K = 'hojasDeRuta/sol_2026-10';
const sol = (id, fecha, cliente) => ({
  id, creadoAt: '2026-10-01T12:00:00.000Z', mes: '2026-10', por: 'ops@agencia.cl', fecha, notas: '', estado: 'pendiente',
  solicitante: { nombre: 'Camila Rojas', empresa: 'Agencia Kennedy', telefono: '+56 9 1234 5678' },
  despachos: [{ cliente, direccion: 'Vicuña Mackenna 1370', comuna: 'Ñuñoa', contacto: '', productos: '6x' }],
  historial: [{ accion: 'solicitada', at: '2026-10-01T12:00:00.000Z', por: 'ops@agencia.cl', nombre: 'Camila Rojas', fecha }]
});
// Cada página arranca con lo que dejó la anterior en el Firebase simulado.
const setup = (email, docs) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-10-01');
  localStorage.setItem('ruteka_solicitante', JSON.stringify({ nombre: 'Camila Rojas', empresa: 'Agencia Kennedy' }));
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['config/app', { transportistas: ['trs@fletes.cl'], agencias: ['ops@agencia.cl'] }]
  ].concat(${JSON.stringify(Object.entries(docs))}) };
})()`;
const leer = p => p.evaluate(k => JSON.parse(window.__fs.docs[k].json).solicitudes, K);
const todos = p => p.evaluate(() => Object.fromEntries(Object.entries(window.__fs.docs).filter(([k]) => !k.startsWith('config/'))));
const carta = '#solLista .sol-card';

let docs = { [K]: { json: JSON.stringify({ solicitudes: [sol('solA', '2026-10-02', 'Radio Infinita')] }) } };

console.log('La operación no puede el 02/10 y propone el 03/10');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl', docs), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="solicitudes"]'); await p.waitForTimeout(200);
  await p.click(`${carta} [data-acc="proponer"]`); await p.waitForTimeout(150);
  check('abre el panel con fecha y comentario', await p.isVisible(`${carta} .sol-panel [data-k="fecha"]`) && !(await p.$(`${carta} [data-acc="aprobar"]`)));
  await p.fill(`${carta} [data-k="fecha"]`, '2026-10-02');
  await p.click(`${carta} [data-acc="enviar-fecha"]`); await p.waitForTimeout(150);
  check('no deja proponer la misma fecha', (await leer(p))[0].estado === 'pendiente' && (await p.textContent(`${carta} .sol-panel`)).includes('distinta'));
  await p.fill(`${carta} [data-k="fecha"]`, '2026-10-03');
  await p.fill(`${carta} [data-k="texto"]`, 'El 02 no tenemos camión');
  await p.click(`${carta} [data-acc="enviar-fecha"]`); await p.waitForTimeout(500);
  const s = (await leer(p))[0];
  check('queda «propuesta» para el 03/10, con el comentario', s.estado === 'propuesta' && s.fechaPropuesta === '2026-10-03' && s.historial[1].accion === 'propuesta' && s.historial[1].comentario === 'El 02 no tenemos camión' && s.historial[1].por === 'jefe@prueba.cl', JSON.stringify(s));
  check('la tarjeta muestra 02 tachado → 03 y espera a la agencia', (await p.$$eval(`${carta} .sol-dia b`, bs => bs.map(x => x.textContent).join('→'))) === '2→3' && (await p.textContent(`${carta} .sol-pie`)).includes('Esperando que la agencia acepte el 03/10'));
  check('ya no cuenta como pendiente para la operación', !(await p.isVisible('#solBadge')));
  docs = await todos(p);
  sinErrores(p);
  await p.context().close();
}

console.log('La agencia propone otra fecha (04/10)');
{
  const p = await open(b, { setup: setup('ops@agencia.cl', docs), width: 390, height: 844 });
  await p.waitForTimeout(700);
  check('la agencia ve el aviso en Seguimiento y el número en la pestaña', await p.isVisible('#avisoSolAg') && (await p.textContent('#avisoSolAgTexto')).includes('propuso otra fecha para 1 solicitud') && (await p.textContent('#solBadgeMovil')) === '1');
  await p.click('#avisoSolAgBtn'); await p.waitForTimeout(200);
  check('ve la propuesta destacada con el comentario', (await p.textContent(`${carta} .sol-propone`)).includes('propone despachar el sábado, 3 de octubre') && (await p.textContent(`${carta} .sol-propone`)).includes('El 02 no tenemos camión'));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-propuesta.png'), fullPage: true });
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await p.click(`${carta} [data-acc="contraproponer"]`); await p.waitForTimeout(150);
  await p.fill(`${carta} [data-k="fecha"]`, '2026-10-04');
  await p.fill(`${carta} [data-k="texto"]`, 'El 03 no hay quien reciba');
  await p.click(`${carta} [data-acc="enviar-fecha"]`); await p.waitForTimeout(500);
  const s = (await leer(p))[0];
  check('vuelve a la operación como pendiente para el 04/10', s.estado === 'pendiente' && s.fecha === '2026-10-04' && !s.fechaPropuesta && s.historial.map(h => h.accion).join(',') === 'solicitada,propuesta,contrapropuesta' && s.historial[2].nombre === 'Camila Rojas', JSON.stringify(s.historial));
  check('el aviso desaparece', await p.$eval('#avisoSolAg', e => e.hidden) && await p.$eval('#solBadgeMovil', e => e.hidden));
  docs = await todos(p);
  sinErrores(p);
  await p.context().close();
}

console.log('La operación vuelve a proponer el 03/10 y la agencia acepta');
{
  let p = await open(b, { setup: setup('jefe@prueba.cl', docs), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="solicitudes"]'); await p.waitForTimeout(200);
  const hilo = await p.textContent(`${carta} .sol-hilo`);
  check('la conversación muestra cada paso', hilo.includes('Camila Rojas pidió despacho para el viernes, 2 de octubre') && hilo.includes('La operación propone el sábado, 3 de octubre') && hilo.includes('Camila Rojas propone el domingo, 4 de octubre') && hilo.includes('El 03 no hay quien reciba'), hilo);
  await p.click(`${carta} [data-acc="proponer"]`); await p.waitForTimeout(150);
  await p.fill(`${carta} [data-k="fecha"]`, '2026-10-03');
  await p.fill(`${carta} [data-k="texto"]`, 'Recibe portería');
  await p.click(`${carta} [data-acc="enviar-fecha"]`); await p.waitForTimeout(500);
  docs = await todos(p);
  await p.context().close();

  p = await open(b, { setup: setup('ops@agencia.cl', docs), width: 1280 });
  await p.waitForTimeout(700);
  check('en el computador, el número va en el menú', (await p.textContent('#solBadge')) === '1');
  await p.click('.side-item[data-view="solicitudes"]'); await p.waitForTimeout(200);
  await p.click(`${carta} [data-acc="aceptar"]`); await p.waitForTimeout(900);
  const s = (await leer(p))[0];
  check('queda programada para el 03/10', s.estado === 'programada' && s.rutaFecha === '2026-10-03' && s.historial.slice(-1)[0].accion === 'aceptada', JSON.stringify(s));
  const ruta = await rowsOf(p, 'hojasDeRuta', '2026-10-03');
  check('el despacho pasa a la ruta del 03/10', ruta && ruta.rows.length === 1 && ruta.rows[0].cliente === 'Radio Infinita');
  const ev = ruta.rows[0].eventos.map(e => e.tipo + ':' + e.por).join(',');
  check('«programado» queda a nombre de la operación que propuso la fecha', ev === 'solicitado:ops@agencia.cl,programado:jefe@prueba.cl', ev);
  check('la agencia ve el aviso con «Ver seguimiento»', (await p.textContent('#solOk')).includes('1 despacho pasó a la ruta del sábado, 3 de octubre'));
  await p.click('#solOk [data-acc="ir-ruta"]'); await p.waitForTimeout(500);
  check('y lo sigue en Seguimiento', !(await p.$eval('#viewSeguimiento', e => e.hidden)) && (await p.textContent('#segLista')).includes('Radio Infinita'));
  sinErrores(p);
  await p.context().close();
}

console.log('Aprobar desde Entregas: los pedidos pasan a la ruta del día');
{
  const extra = { [K]: { json: JSON.stringify({ solicitudes: [sol('solB', '2026-10-01', 'Chilevisión'), sol('solC', '2026-10-06', 'Café Rojo')] }) } };
  const p = await open(b, { setup: setup('jefe@prueba.cl', extra), width: 390, height: 844 });
  await p.waitForTimeout(700);
  await p.click('.movil-tab[data-tab="chofer"]'); await p.waitForTimeout(300);
  check('Entregas muestra «Solicitudes por aprobar» con 2', await p.isVisible('#solAprobar') && (await p.textContent('#solAprobarN')) === '2');
  check('ordenadas por fecha, con quién las pide', (await p.$$eval('#solAprobarLista .sol-quien b', bs => bs.length)) === 2 && (await p.textContent('#solAprobarLista .sol-card:first-child')).includes('Chilevisión'));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-entregas.png'), fullPage: true });
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await p.click('#solAprobarLista .sol-card:first-child [data-acc="aprobar"]'); await p.waitForTimeout(900);
  check('el pedido aparece en Entregas del día', (await p.textContent('#choferList')).includes('Chilevisión'));
  check('queda solo una por aprobar y el aviso de traspaso', (await p.textContent('#solAprobarN')) === '1' && (await p.textContent('#solAprobarOk')).includes('1 despacho pasó a la ruta del jueves, 1 de octubre'));
  const ruta = await rowsOf(p, 'hojasDeRuta', '2026-10-01');
  check('guardado en la ruta del 01/10', ruta.rows.some(r => r.cliente === 'Chilevisión' && r.solicitudId === 'solB'));
  sinErrores(p);
  await p.context().close();
}

console.log('El transportista no ve solicitudes en Entregas');
{
  const extra = { [K]: { json: JSON.stringify({ solicitudes: [sol('solB', '2026-10-01', 'Chilevisión')] }) } };
  const p = await open(b, { setup: setup('trs@fletes.cl', extra), width: 390, height: 844 });
  await p.waitForTimeout(700);
  check('sin sección por aprobar', await p.$eval('#solAprobar', e => e.hidden));
  sinErrores(p);
  await p.context().close();
}
await b.close();
