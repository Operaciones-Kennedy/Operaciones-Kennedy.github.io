// Usuarios: casillas «Ve el seguimiento» y «Ve las solicitudes» para transportistas.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const DIA = '2026-10-01';
const setup = (email, cfg) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  const rows = [{ id: 'a', cliente: 'Radio Infinita', direccion: 'Vicuña Mackenna 1370', comuna: 'Ñuñoa', contacto: '', productos: '6x', estado: 'pendiente', tarifa: 10000, pagado: false }];
  window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', transportista: 'Transportes Barrientos', rows }) }],
    ['config/app', ${JSON.stringify(cfg)}]
  ] };
})()`;
const menu = p => p.$$eval('.sidebar .side-item[data-view] span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent).join(','));

console.log('El administrador marca las casillas nuevas');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl', { transportistas: ['colomba@burson.com', 'trs@fletes.cl'] }), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="config"]'); await p.waitForTimeout(200);
  const casillas = await p.$$eval('#configLista li:first-child .config-liq', ls => ls.map(l => l.textContent.trim()).join(','));
  check('cada correo tiene 4 casillas', casillas === 'Ve la liquidación,Ve el historial,Ve el seguimiento,Ve las solicitudes', casillas);
  check('el correo se sigue leyendo', (await p.$$eval('#configLista li span', ss => ss.filter(s => s.offsetWidth > 100).length)) === 2);
  await p.check('#configLista li:first-child [data-permiso="conSeguimiento"] input'); await p.waitForTimeout(400);
  await p.check('#configLista li:first-child [data-permiso="conSolicitudes"] input'); await p.waitForTimeout(400);
  const cfg = await p.evaluate(() => window.__fs.docs['config/app']);
  check('se guardan en config/app', cfg.conSeguimiento.join() === 'colomba@burson.com' && cfg.conSolicitudes.join() === 'colomba@burson.com', JSON.stringify(cfg));
  check('el mensaje confirma', (await p.textContent('#configMsg')).includes('ahora ve las Solicitudes'));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-usuarios.png') });
  sinErrores(p);
  await p.context().close();
}

for (const w of [1280, 390]) {
  console.log('Transportista con seguimiento y solicitudes (' + (w > 820 ? 'computador' : 'teléfono') + ')');
  const p = await open(b, { setup: setup('colomba@burson.com', { transportistas: ['colomba@burson.com'], conSeguimiento: ['colomba@burson.com'], conSolicitudes: ['colomba@burson.com'] }), width: w, height: 844 });
  await p.waitForTimeout(700);
  if (w > 820) {
    check('el menú suma Seguimiento y Solicitudes', (await menu(p)) === 'Solicitudes,Entregas,Seguimiento', await menu(p));
    await p.click('.side-item[data-view="seguimiento"]');
  } else {
    await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
    const items = await p.$$eval('#movilMas .movil-sheet-item', es => es.filter(e => e.offsetWidth).map(e => e.textContent.trim()));
    check('en Más aparecen Seguimiento y Solicitudes', items.includes('Seguimiento') && items.includes('Solicitudes'), items.join(','));
    await p.click('#movilMas [data-ir="seguimiento"]');
  }
  await p.waitForTimeout(300);
  check('abre Seguimiento, sin montos', !(await p.$eval('#viewSeguimiento', e => e.hidden)) && (await p.textContent('#segLista')).includes('Radio Infinita') && !(await p.textContent('#viewSeguimiento')).includes('$'));
  if (w > 820) await p.click('.side-item[data-view="solicitudes"]');
  else { await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150); await p.click('#movilMas [data-ir="solicitudes"]'); }
  await p.waitForTimeout(300);
  check('abre Solicitudes como quien pide (formulario primero, sin aprobar)', !(await p.$eval('#viewSolicitudes', e => e.hidden)) && (await p.textContent('#solFormTitulo')) === 'Nueva solicitud');
  await p.fill('#solNombre', 'Colomba Muñoz'); await p.fill('#solEmpresa', 'Burson');
  await p.fill('#solFilas .sol-desp:nth-child(1) input[data-k="cliente"]', 'Café Rojo');
  await p.click('#solEnviar'); await p.waitForTimeout(500);
  const lista = await p.evaluate(() => { const k = Object.keys(window.__fs.docs).find(x => x.startsWith('hojasDeRuta/sol_')); return k ? JSON.parse(window.__fs.docs[k].json).solicitudes : []; });
  check('envía la solicitud', lista.length === 1 && lista[0].por === 'colomba@burson.com' && lista[0].solicitante.empresa === 'Burson');
  check('no puede aprobar', !(await p.$('#solLista [data-acc="aprobar"]')));
  if (w <= 820) check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  sinErrores(p);
  await p.context().close();
}

console.log('Transportista sin las casillas');
{
  const p = await open(b, { setup: setup('trs@fletes.cl', { transportistas: ['trs@fletes.cl'] }), width: 1280 });
  await p.waitForTimeout(600);
  check('solo ve Entregas', (await menu(p)) === 'Entregas', await menu(p));
  await p.evaluate(() => document.querySelector('.side-item[data-view="seguimiento"]').click()); await p.waitForTimeout(150);
  check('no puede abrir Seguimiento', await p.$eval('#viewSeguimiento', e => e.hidden));
  sinErrores(p);
  await p.context().close();
}
await b.close();
