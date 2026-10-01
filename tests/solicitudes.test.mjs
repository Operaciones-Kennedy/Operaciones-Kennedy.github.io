// Solicitudes de ruta: la agencia pide despachos para una fecha y la operación los programa o rechaza.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const MES = '2026-10';
const setup = (email, extra) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-10-01');
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['config/app', { transportistas: ['trs@fletes.cl'], agencias: ['ops@agencia.cl'] }]
  ].concat(${extra || '[]'}) };
})()`;
const solDoc = p => p.evaluate(() => {
  const k = Object.keys(window.__fs.docs).find(x => x.startsWith('hojasDeRuta/sol_'));
  return k ? { k, lista: JSON.parse(window.__fs.docs[k].json).solicitudes } : null;
});

let guardado;
for (const w of [390, 1280]) {
  console.log('La agencia envía una solicitud (' + (w > 820 ? 'computador' : 'teléfono') + ')');
  const p = await open(b, { setup: setup('ops@agencia.cl'), width: w, height: 844 });
  await p.waitForTimeout(600);
  if (w > 820) await p.click('.side-item[data-view="solicitudes"]');
  else await p.click('.movil-tab[data-tab="solicitudes"]');
  await p.waitForTimeout(200);
  check('abre Solicitudes, sin la barra del día', !(await p.$eval('#viewSolicitudes', e => e.hidden)) && await p.$eval('#hojaBar', e => e.hidden));
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check('el formulario tiene los pasos Quién, Cuándo, Qué y Observaciones', (await p.$$eval('.sol-paso-tit', hs => hs.map(h => h.textContent.slice(1)).join(','))) === 'Quién solicita,Cuándo,Qué despachar,Observaciones');
  await p.click('#solEnviar'); await p.waitForTimeout(100);
  check('pide nombre y empresa', (await p.textContent('#solMsg')).includes('nombre y la empresa'));
  await p.fill('#solNombre', 'Camila Rojas');
  await p.fill('#solEmpresa', 'Agencia Kennedy');
  await p.fill('#solTelefono', '+56 9 1234 5678');
  await p.click('#solEnviar'); await p.waitForTimeout(100);
  check('pide al menos un despacho', (await p.textContent('#solMsg')).includes('al menos un despacho'));
  await p.fill('#solFecha', '2026-10-05');
  await p.fill('#solFilas .sol-desp:nth-child(1) input[data-k="cliente"]', 'Radio Infinita');
  await p.fill('#solFilas .sol-desp:nth-child(1) input[data-k="direccion"]', 'Vicuña Mackenna 1370');
  await p.fill('#solFilas .sol-desp:nth-child(1) input[data-k="comuna"]', 'Ñuñoa');
  await p.click('#solAgregar');
  await p.fill('#solFilas .sol-desp:nth-child(2) input[data-k="cliente"]', 'Chilevisión');
  await p.fill('#solFilas .sol-desp:nth-child(2) input[data-k="productos"]', '6x Coca-Cola');
  await p.fill('#solNotas', 'Recepción hasta las 14:00');
  await p.click('#solEnviar'); await p.waitForTimeout(500);
  const d = await solDoc(p);
  check('queda guardada como pendiente', d && d.lista.length === 1 && d.lista[0].estado === 'pendiente' && d.lista[0].fecha === '2026-10-05' && d.lista[0].despachos.length === 2 && d.lista[0].por === 'ops@agencia.cl', JSON.stringify(d && d.lista));
  const q = d.lista[0].solicitante || {};
  check('guarda quién pide: nombre, empresa y teléfono', q.nombre === 'Camila Rojas' && q.empresa === 'Agencia Kennedy' && q.telefono === '+56 9 1234 5678', JSON.stringify(q));
  check('y el primer paso del historial', (d.lista[0].historial || []).map(h => h.accion + ':' + h.fecha).join(',') === 'solicitada:2026-10-05');
  const lista = await p.textContent('#solLista');
  check('la tarjeta muestra la empresa, el nombre y el estado', lista.includes('Agencia Kennedy') && lista.includes('Camila Rojas') && lista.includes('Pendiente') && lista.includes('Esperando que la operación la programe') && (await p.textContent('#solLista .sol-avatar')) === 'AK', lista.slice(0, 200));
  check('el formulario queda limpio, pero recuerda quién pide', (await p.inputValue('#solFilas .sol-desp:nth-child(1) input[data-k="cliente"]')) === '' && (await p.inputValue('#solEmpresa')) === 'Agencia Kennedy');
  check('la agencia no puede aprobar', !(await p.$('#solLista [data-acc="aprobar"]')));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-agencia-' + w + '.png'), fullPage: true });
  check('sigue sin salirse de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check('para la agencia, el formulario va primero', (await p.$eval('.sol-form', e => e.getBoundingClientRect().top)) < (await p.$eval('#solLista', e => e.getBoundingClientRect().top)));
  if (w > 820) guardado = d;
  sinErrores(p);
  await p.context().close();
}

console.log('La operación programa una y rechaza otra');
{
  const sol = guardado.lista[0];
  const otra = Object.assign({}, sol, { id: 'solB', fecha: '2026-10-06', despachos: [{ cliente: 'Sin stock' }] });
  const extra = JSON.stringify([[guardado.k, { json: JSON.stringify({ solicitudes: [sol, otra] }) }]]);
  const p = await open(b, { setup: setup('jefe@prueba.cl', extra), width: 1280 });
  await p.waitForTimeout(700);
  check('el menú muestra 2 pendientes', (await p.textContent('#solBadge')) === '2' && await p.isVisible('#solBadge'));
  check('la Ruta del día avisa las solicitudes pendientes', await p.isVisible('#avisoSol') && (await p.textContent('#avisoSolTexto')).includes('2 solicitudes pendientes'));
  await p.click('#avisoSolBtn'); await p.waitForTimeout(200);
  check('el aviso lleva a Solicitudes', !(await p.$eval('#viewSolicitudes', e => e.hidden)));
  const yLista = await p.$eval('#solLista', e => e.getBoundingClientRect().top), yForm = await p.$eval('.sol-form', e => e.getBoundingClientRect().top);
  check('para la operación, las solicitudes van antes que el formulario', yLista < yForm && (await p.textContent('#solListaTitulo')) === 'Solicitudes de la agencia');
  await p.click('.side-item[data-view="solicitudes"]'); await p.waitForTimeout(200);
  const cards = '#solLista .sol-card';
  const primera = (await p.$$(cards)).length;
  check('ve las dos solicitudes pendientes', primera === 2);
  const idx = await p.$$eval(cards, cs => cs.findIndex(c => c.textContent.includes('Radio Infinita')));
  check('muestra quién pide en la tarjeta', (await p.textContent(`${cards}:nth-child(${idx + 1}) .sol-quien`)).includes('Agencia Kennedy'));
  await p.click(`${cards}:nth-child(${idx + 1}) [data-acc="aprobar"]`); await p.waitForTimeout(800);
  const ruta = await rowsOf(p, 'hojasDeRuta', '2026-10-05');
  check('los despachos pasan a la ruta del 05/10', ruta && ruta.rows.length === 2 && ruta.rows[0].cliente === 'Radio Infinita' && ruta.rows[0].solicitudId === sol.id, JSON.stringify(ruta && ruta.rows.map(r => r.cliente)));
  const ev = ruta.rows[0].eventos.map(e => e.tipo + ':' + e.por).join(',');
  check('trazabilidad: solicitado por la agencia y programado por la operación', ev === 'solicitado:ops@agencia.cl,programado:jefe@prueba.cl', ev);
  check('crea el resumen de ese día', !!(await p.evaluate(() => window.__fs.docs['hojasResumen/2026-10-05'])));
  let d = await solDoc(p);
  check('la solicitud queda programada', d.lista.find(x => x.id === sol.id).estado === 'programada' && d.lista.find(x => x.id === sol.id).rutaFecha === '2026-10-05');
  const idxB = await p.$$eval(cards, cs => cs.findIndex(c => c.textContent.includes('Sin stock')));
  await p.click(`${cards}:nth-child(${idxB + 1}) [data-acc="rechazar"]`); await p.waitForTimeout(150);
  await p.click(`${cards}:nth-child(${idxB + 1}) [data-acc="confirmar"]`); await p.waitForTimeout(150);
  check('para rechazar pide el motivo', (await solDoc(p)).lista.find(x => x.id === 'solB').estado === 'pendiente' && (await p.textContent(`${cards}:nth-child(${idxB + 1}) .sol-panel`)).includes('Escribe el motivo'));
  await p.fill(`${cards}:nth-child(${idxB + 1}) [data-k="texto"]`, 'No hay camión ese día');
  await p.click(`${cards}:nth-child(${idxB + 1}) [data-acc="confirmar"]`); await p.waitForTimeout(500);
  d = await solDoc(p);
  check('queda rechazada con el motivo', d.lista.find(x => x.id === 'solB').estado === 'rechazada' && d.lista.find(x => x.id === 'solB').motivo === 'No hay camión ese día');
  check('ya no quedan pendientes', (await p.$$(cards)).length === 0 && !(await p.isVisible('#solBadge')));
  check('avisa que los despachos pasaron a la ruta', (await p.textContent('#solOk')).includes('2 despachos pasaron a la ruta del lunes, 5 de octubre'), await p.textContent('#solOk'));
  check('y el aviso de la Ruta del día desaparece', await p.$eval('#avisoSol', e => e.hidden));
  await p.click('#solFiltros [data-f="programada"]'); await p.waitForTimeout(100);
  await p.click(`${cards} button:has-text("Ver seguimiento")`); await p.waitForTimeout(500);
  check('«Ver seguimiento» abre esa ruta', !(await p.$eval('#viewSeguimiento', e => e.hidden)) && (await p.inputValue('#hojaFecha')) === '2026-10-05' && (await p.textContent('#segLista')).includes('Radio Infinita'));
  check('con el paso «Programado» y el camión', (await p.textContent('#segLista .seg-paso.actual b')) === 'Programado' && (await p.$eval('#segLista .seg-camion', e => e.style.left)) === '37.5%' && (await p.textContent('#segLista')).includes('Solicitado por la agencia'));
  sinErrores(p);
  await p.context().close();
}

console.log('El transportista no ve Solicitudes');
{
  const p = await open(b, { setup: setup('trs@fletes.cl'), width: 1280 });
  await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('.side-item[data-view="solicitudes"]').click()); await p.waitForTimeout(150);
  check('no puede abrirla', await p.$eval('#viewSolicitudes', e => e.hidden) && !(await p.isVisible('.side-item[data-view="solicitudes"]')));
  sinErrores(p);
  await p.context().close();
}
await b.close();
