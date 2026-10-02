// Vista agencia: Seguimiento en vivo (estados, trazabilidad, ubicación del camión) sin montos ni edición.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const DIA = '2026-09-30';
const setup = (email, extra) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '${DIA}');
  const rows = [
    { id: 'a', cliente: 'Radio Infinita', direccion: 'Vicuña Mackenna 1370', comuna: 'Ñuñoa', contacto: '', productos: '6x', estado: 'pendiente', tarifa: 10000, pagado: false },
    { id: 'b', cliente: 'Chilevisión', direccion: 'Pedro Montt 2354', comuna: 'Santiago', contacto: '', productos: '6x', estado: 'entregado', tarifa: 10000, pagado: false,
      entrega: { recibidoPor: 'Ignacio Suárez', horaEntrega: '11:30', registradoPor: 'trs.barrientos80@gmail.com', registradoAt: '${DIA}T11:30:00', fotoUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }];
  window.__fakeParams = Object.assign({ email: '${email}', admins: ['jefe@prueba.cl'], seed: [
    ['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', transportista: 'Transportes Barrientos', rows }) }],
    ['config/app', { transportistas: ['chofer@fletes.cl'], agencias: ['ops@agencia.cl'] }]
  ].concat(${extra || '[]'}) });
})()`;
const menu = (p, w) => w > 820 ? p.$$eval('.sidebar .side-item[data-view] span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent).join(','))
                               : p.$$eval('.movil-tab span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent).join(','));

console.log('El administrador agrega un correo de agencia');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(600);
  await p.click('.side-item[data-view="config"]'); await p.waitForTimeout(200);
  check('la página Usuarios muestra la agencia anotada', (await p.$$eval('#agenciaLista li span', s => s.map(x => x.textContent))).join(',') === 'ops@agencia.cl');
  await p.fill('#agenciaEmail', 'Jefa@Agencia.cl'); await p.click('#agenciaForm button[type=submit]'); await p.waitForTimeout(500);
  const cfg = await p.evaluate(() => window.__fs.docs['config/app']);
  const pr = await p.evaluate(() => window.__fs.docs['hojasDeRuta/principal']);
  check('se guarda en config/app y en la copia general', cfg.agencias.includes('jefa@agencia.cl') && pr.agencias.includes('jefa@agencia.cl'), JSON.stringify(cfg));
  await p.fill('#agenciaEmail', 'jefe@prueba.cl'); await p.click('#agenciaForm button[type=submit]'); await p.waitForTimeout(200);
  check('no deja agregarse a uno mismo', (await p.textContent('#agenciaMsg')).includes('tu propio correo'));
  check('el administrador también ve Seguimiento', await p.isVisible('.side-item[data-view="seguimiento"]'));
  await p.click('.side-item[data-view="despachos"]'); await p.waitForTimeout(150);
  await p.click('#btnAddRow'); await p.waitForTimeout(100);
  await p.click('#tbody tr:last-child td:nth-child(2)'); await p.keyboard.type('Nuevo cliente');
  await p.click('#hojaInfo'); await p.waitForTimeout(900);
  const nuevo = (await rowsOf(p, 'hojasDeRuta', DIA)).rows.find(r => r.cliente === 'Nuevo cliente');
  check('un despacho nuevo guarda cuándo se creó', nuevo && /^\d{4}-\d{2}-\d{2}T/.test(nuevo.creadoAt || ''), JSON.stringify(nuevo));
  sinErrores(p);
  await p.context().close();
}

for (const w of [1280, 390]) {
  console.log('Agencia (' + (w > 820 ? 'computador' : 'teléfono') + ')');
  const gps = `[['hojasDeRuta/gps_${DIA}', { lat: -33.45, lng: -70.62, atMs: Date.now() - 120000, activo: true, por: 'chofer@fletes.cl' }]]`;
  const p = await open(b, { setup: setup('ops@agencia.cl', gps), width: w, height: 844 });
  await p.waitForTimeout(700);
  check('entra en vista agencia', await p.evaluate(() => document.body.classList.contains('modo-agencia')) && (await p.textContent('#rolChip')) === 'Vista agencia');
  check('menú: Solicitudes, Seguimiento e Historial de entregas', (await menu(p, w)) === (w > 820 ? 'Solicitudes,Seguimiento,Historial de entregas' : 'Seguimiento,Solicitudes,Más'), await menu(p, w));
  check('abre en Seguimiento', !(await p.$eval('#viewSeguimiento', e => e.hidden)));
  const txt = await p.textContent('#viewSeguimiento');
  check('muestra los envíos con su estado', txt.includes('Radio Infinita') && txt.includes('Chilevisión') && txt.includes('1 Entregado'));
  check('trazabilidad: hora y quién registró la entrega', txt.includes('11:30') && txt.includes('trs.barrientos80@gmail.com') && txt.includes('Recibió: Ignacio Suárez'));
  check('ubicación del camión en vivo', (await p.textContent('#segGps')).includes('En vivo') && (await p.textContent('#segGps')).includes('hace 2 min'), await p.textContent('#segGps'));
  check('no muestra montos', !txt.includes('$'));
  const pasos = () => p.$$eval('#segLista .seg-card', cs => cs.map(c => [...c.querySelectorAll('.seg-paso')].map(li => (li.classList.contains('actual') ? '>' : '') + (li.classList.contains('hecho') ? '✓' : '·') + li.querySelector('b').textContent).join(' ') + ' | camión ' + (c.querySelector('.seg-camion svg') ? c.querySelector('.seg-camion').style.left : 'no')));
  const p1 = await pasos();
  check('pasos: pendiente queda en «Programado» con el camión', p1[0] === '✓Pedido creado >✓Programado ·En ruta ·Entregado | camión 37.5%', p1[0]);
  check('pasos: entregado completa los cuatro y su camión llegó', p1[1] === '✓Pedido creado ✓Programado ✓En ruta >✓Entregado | camión 87.5%', p1[1]);
  await p.evaluate(() => document.querySelector('.side-item[data-view="chofer"]').click()); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.side-item[data-view="despachos"]').click()); await p.waitForTimeout(150);
  check('no puede abrir Entregas ni la Ruta del día', !(await p.$eval('#viewSeguimiento', e => e.hidden)) && await p.$eval('#viewChofer', e => e.hidden) && await p.$eval('#viewDespachos', e => e.hidden));
  // El transportista marca «en ruta» desde otro teléfono: la agencia lo ve sin recargar.
  await p.evaluate(dia => {
    const st = window.__fs.json('hojasDeRuta', dia);
    st.rows[0].estado = 'en-ruta';
    st.rows[0].eventos = [{ tipo: 'en-ruta', at: dia + 'T10:05:00', por: 'chofer@fletes.cl' }];
    window.__fs.remoteWrite('hojasDeRuta', dia, { json: JSON.stringify(st) });
  }, DIA);
  await p.waitForTimeout(300);
  const txt2 = await p.textContent('#segLista');
  check('el camión avanza a «En ruta» con su hora', (await pasos())[0] === '✓Pedido creado ✓Programado >✓En ruta ·Entregado | camión 62.5%' && !!(await p.$('#segLista .seg-card:first-child .seg-camion.avanza')) && (await p.textContent('#segLista .seg-card:first-child .seg-pasos')).includes('10:05'), (await pasos())[0]);
  check('se actualiza en vivo con la hora de salida a ruta', txt2.includes('10:05') && txt2.includes('Salió a ruta') && (await p.textContent('#segChips')).includes('1 En ruta'), txt2.slice(0, 200));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA.replace('.png', '-' + w + '.png'), fullPage: true });
  if (w <= 820) {
    check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
    const items = await p.$$eval('#movilMas .movil-sheet-item', es => es.filter(e => e.offsetWidth).map(e => e.textContent.trim()));
    check('en Más: Historial de entregas y Cerrar sesión', items.join(',') === 'Historial de entregas,Cerrar sesión', items.join(','));
  }
  sinErrores(p);
  await p.context().close();
}

console.log('El transportista comparte su ubicación y marca «en ruta»');
{
  const p = await open(b, { setup: setup('chofer@fletes.cl'), width: 390, height: 844 });
  await p.context().grantPermissions(['geolocation']);
  await p.context().setGeolocation({ latitude: -33.4372, longitude: -70.6506 });
  await p.waitForTimeout(600);
  check('no ve Seguimiento', !(await p.isVisible('.movil-tab[data-tab="seguimiento"]')) && await p.$eval('#viewSeguimiento', e => e.hidden));
  await p.click('#btnGps'); await p.waitForTimeout(800);
  const g = await p.evaluate(dia => window.__fs.docs['hojasDeRuta/gps_' + dia], DIA);
  check('envía la ubicación', g && Math.abs(g.lat + 33.4372) < 1e-6 && g.activo === true && g.por === 'chofer@fletes.cl', JSON.stringify(g));
  check('el botón queda en «Dejar de compartir»', (await p.textContent('#btnGps')) === 'Dejar de compartir' && (await p.textContent('#gpsEstado')).includes('Compartiendo'));
  await p.click('#viewChofer .chofer-card-actions button:has-text("Marcar en ruta")'); await p.waitForTimeout(900);
  const st = await rowsOf(p, 'hojasDeRuta', DIA);
  const ev = (st.rows.find(r => r.id === 'a').eventos || [])[0];
  check('queda el evento «en ruta» con hora y quién', ev && ev.tipo === 'en-ruta' && ev.por === 'chofer@fletes.cl' && /^\d{4}-\d{2}-\d{2}T/.test(ev.at), JSON.stringify(ev));
  await p.click('#btnGps'); await p.waitForTimeout(300);
  const g2 = await p.evaluate(dia => window.__fs.docs['hojasDeRuta/gps_' + dia], DIA);
  check('al dejar de compartir queda inactivo', g2.activo === false && (await p.textContent('#btnGps')) === 'Compartir mi ubicación');
  sinErrores(p);
  await p.context().close();
}
await b.close();
