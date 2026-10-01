// Chat en línea entre la operación y cada usuario.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const setup = (email, docs) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-10-01');
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl', 'otra@prueba.cl'], seed: [
    ['config/app', { transportistas: ['trs@fletes.cl', 'ruben@fletes.cl'], agencias: ['ops@agencia.cl'] }]
  ].concat(${JSON.stringify(Object.entries(docs || {}))}) };
})()`;
const conv = (p, email) => p.evaluate(e => { const d = window.__fs.docs['hojasDeRuta/chat_' + e]; return d ? JSON.parse(d.json) : null; }, email);
const indice = p => p.evaluate(() => { const d = window.__fs.docs['hojasDeRuta/chat_indice']; return d ? JSON.parse(d.json).conv : {}; });
const todos = p => p.evaluate(() => Object.fromEntries(Object.entries(window.__fs.docs).filter(([k]) => k.startsWith('hojasDeRuta/chat_'))));
let docs;

console.log('El transportista escribe a la operación (teléfono)');
{
  const p = await open(b, { setup: setup('trs@fletes.cl'), width: 390, height: 844 });
  await p.waitForTimeout(600);
  check('ve el botón del chat', await p.isVisible('#chatFab'));
  await p.click('#chatFab'); await p.waitForTimeout(200);
  check('se abre a pantalla completa con la operación', await p.isVisible('#chatPanel') && (await p.textContent('#chatTitulo')) === 'Operación' && (await p.$eval('#chatPanel', e => e.getBoundingClientRect().width)) === 390);
  await p.fill('#chatTexto', 'Hola, voy 20 minutos atrasado');
  await p.press('#chatTexto', 'Enter'); await p.waitForTimeout(500);
  const c = await conv(p, 'trs@fletes.cl');
  check('se guarda el mensaje', c && c.mensajes.length === 1 && c.mensajes[0].texto === 'Hola, voy 20 minutos atrasado' && c.mensajes[0].de === 'trs@fletes.cl' && !c.mensajes[0].op && c.sinLeerOp === 1, JSON.stringify(c));
  check('y el índice para la operación', (await indice(p))['trs@fletes.cl'].sinLeerOp === 1);
  check('se ve como burbuja propia', (await p.textContent('#chatMsgs .chat-msg.mio')).includes('Hola, voy 20 minutos atrasado') && (await p.inputValue('#chatTexto')) === '');
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-usuario.png') });
  // La operación responde desde otro equipo: con el chat cerrado aparece el número.
  await p.click('#chatCerrar'); await p.waitForTimeout(100);
  await p.evaluate(() => {
    const k = 'chat_trs@fletes.cl';
    const c = JSON.parse(window.__fs.docs['hojasDeRuta/' + k].json);
    c.mensajes.push({ id: 'm2', de: 'jefe@prueba.cl', op: true, texto: 'Ok, aviso al cliente', at: new Date().toISOString() });
    c.sinLeerUsuario = 1; c.sinLeerOp = 0;
    window.__fs.remoteWrite('hojasDeRuta', k, { json: JSON.stringify(c) });
  });
  await p.waitForTimeout(300);
  check('llega en vivo: número en el botón y en el título', (await p.textContent('#chatBadge')) === '1' && (await p.title()).startsWith('(1)'));
  await p.click('#chatFab'); await p.waitForTimeout(500);
  check('la respuesta aparece como «Operación»', (await p.textContent('#chatMsgs .chat-msg:not(.mio)')).includes('Operación') && (await p.textContent('#chatMsgs')).includes('Ok, aviso al cliente'));
  check('al verla se marca leída', (await conv(p, 'trs@fletes.cl')).sinLeerUsuario === 0 && !(await p.isVisible('#chatBadge')) && !(await p.title()).startsWith('('));
  docs = await todos(p);
  sinErrores(p);
  await p.context().close();
}

console.log('La operación ve las conversaciones y responde (computador)');
{
  // Llega un mensaje nuevo del transportista que la operación no ha leído.
  const c = JSON.parse(docs['hojasDeRuta/chat_trs@fletes.cl'].json);
  c.mensajes.push({ id: 'm3', de: 'trs@fletes.cl', op: false, texto: '¿Dejo el pedido en conserjería?', at: new Date().toISOString() });
  c.sinLeerOp = 1;
  docs['hojasDeRuta/chat_trs@fletes.cl'] = { json: JSON.stringify(c) };
  const ind = JSON.parse(docs['hojasDeRuta/chat_indice'].json);
  Object.assign(ind.conv['trs@fletes.cl'], { ultimo: '¿Dejo el pedido en conserjería?', op: false, sinLeerOp: 1 });
  docs['hojasDeRuta/chat_indice'] = { json: JSON.stringify(ind) };
  const p = await open(b, { setup: setup('otra@prueba.cl', docs), width: 1280 });
  await p.waitForTimeout(700);
  check('el botón muestra 1 sin leer', (await p.textContent('#chatBadge')) === '1');
  await p.click('#chatFab'); await p.waitForTimeout(200);
  const convs = await p.$$eval('#chatConvLista .chat-conv', bs => bs.map(x => x.textContent));
  check('lista de conversaciones con el último mensaje', convs.length === 1 && convs[0].includes('trs@fletes.cl') && convs[0].includes('¿Dejo el pedido en conserjería?'), convs.join(' / '));
  const opciones = await p.$$eval('#chatNueva option', os => os.map(o => o.value).filter(Boolean).join(','));
  check('«Escribir a…» ofrece a los demás usuarios', opciones === 'ops@agencia.cl,ruben@fletes.cl', opciones);
  await p.click('#chatConvLista .chat-conv'); await p.waitForTimeout(400);
  check('abre la conversación', (await p.textContent('#chatTitulo')) === 'trs@fletes.cl' && (await p.$$('#chatMsgs .chat-msg')).length === 3);
  check('la respuesta de otro administrador muestra quién fue', (await p.textContent('#chatMsgs .chat-msg.mio small')) === 'jefe@prueba.cl');
  check('se marca leída', (await conv(p, 'trs@fletes.cl')).sinLeerOp === 0 && (await indice(p))['trs@fletes.cl'].sinLeerOp === 0 && !(await p.isVisible('#chatBadge')));
  await p.fill('#chatTexto', 'Sí, en conserjería');
  await p.click('#chatEnviar'); await p.waitForTimeout(500);
  const c2 = await conv(p, 'trs@fletes.cl');
  check('responde como operación', c2.mensajes.slice(-1)[0].op === true && c2.mensajes.slice(-1)[0].de === 'otra@prueba.cl' && c2.sinLeerUsuario === 1);
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-operacion.png') });
  await p.click('#chatVolver'); await p.waitForTimeout(150);
  await p.selectOption('#chatNueva', 'ruben@fletes.cl'); await p.waitForTimeout(200);
  await p.fill('#chatTexto', 'Rubén, mañana sales a las 8');
  await p.press('#chatTexto', 'Enter'); await p.waitForTimeout(500);
  check('inicia una conversación nueva', (await conv(p, 'ruben@fletes.cl')).mensajes[0].texto === 'Rubén, mañana sales a las 8' && !!(await indice(p))['ruben@fletes.cl']);
  sinErrores(p);
  await p.context().close();
}
await b.close();
