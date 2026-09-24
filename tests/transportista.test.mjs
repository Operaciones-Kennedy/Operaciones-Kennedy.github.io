import { launch, open, rowsOf, check, FIX, sinErrores } from './harness.mjs';
import path from 'path';


const b = await launch();
const setup = (email) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-24');
  const rows = [
    { id: 'a', cliente: 'Céline Schumann', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', contacto: '+569 8585 9910', productos: '6x', estado: 'pendiente', tarifa: 8000, pagado: false },
    { id: 'b', cliente: 'Gino Costa', direccion: 'Mar Jónico 8020', comuna: 'Vitacura', contacto: '9 9991 1866', productos: '6x', estado: 'pendiente', tarifa: 8000, pagado: false, lat: -33.38, lng: -70.55 }];
  window.__fakeParams = { email: '${email}', seed: [
    ['hojasDeRuta/2026-09-24', { json: JSON.stringify({ titulo: 't', transportista: 'Juan', fecha: '2026-09-24', rows }), fecha: '2026-09-24' }],
    ['config/app', { transportistas: ['juan@transportes.cl'] }]] };
})()`;
console.log('Transportista');
{
  const p = await open(b, { setup: setup('Juan@Transportes.cl'), width: 390, height: 844 });
  await p.waitForTimeout(500);
  check('entra en modo transportista', await p.evaluate(() => document.body.classList.contains('modo-transportista')));
  check('abre directo en Entregas', !(await p.$eval('#viewChofer', e => e.hidden)));
  check('no ve Despachos ni Reportes', !(await p.isVisible('#navDespachos')) && !(await p.isVisible('#navReportes')));
  check('chip "Vista transportista"', await p.isVisible('#rolChip'));
  await p.evaluate(() => document.querySelector('.side-item[data-view="despachos"]').click()); await p.waitForTimeout(150);
  check('no puede abrir Despachos por otro lado', !(await p.$eval('#viewChofer', e => e.hidden)) && await p.$eval('#viewDespachos', e => e.hidden));
  const links = await p.$$eval('#viewChofer .chofer-nav a', as => as.map(a => a.className + '=' + a.getAttribute('href')));
  check('Cómo llegar (Google Maps) con dirección', links.some(l => l.startsWith('maps=https://www.google.com/maps/dir/?api=1&destination=Las%20Hualtatas')), links[0]);
  check('Waze usa coordenadas si las hay', links.some(l => l === 'waze=https://waze.com/ul?ll=-33.38,-70.55&navigate=yes'));
  check('Llamar normaliza teléfonos (9 9991 1866 → +56999911866)', links.includes('tel=tel:+56985859910') && links.includes('tel=tel:+56999911866'), links.filter(l => l.startsWith('tel')).join(' '));
  
  await p.evaluate(() => document.querySelector('.side-item[data-view="liquidaciones"]').click()); await p.waitForTimeout(200);
  check('en Liquidación no puede marcar pagado ni facturas', await p.$eval('#tbodyLiq input[type=checkbox]', e => e.disabled) && await p.$eval('#tbodyLiq input.prueba', e => e.disabled) && await p.$eval('#liqTransportistaEmail', e => e.disabled));
  check('sí puede dar visto bueno', (await p.$$('#tbodyLiq button.vb-ok')).length === 2);

  console.log('Foto sin señal');
  await p.evaluate(() => document.querySelector('.side-item[data-view="chofer"]').click()); await p.waitForTimeout(200);
  await p.click('#viewChofer .chofer-card:first-of-type button.primary');
  await p.fill('#viewChofer .chofer-form input[type=text]', 'Céline');
  await p.setInputFiles('#viewChofer .chofer-form input[type=file]', path.join(FIX, 'foto.jpg'));
  await p.context().setOffline(true);
  await p.click('#viewChofer .chofer-form button.primary');
  await p.waitForTimeout(1500);
  let st = await rowsOf(p, 'hojasDeRuta', '2026-09-24');
  const a = st.rows.find(r => r.id === 'a');
  check('sin señal: queda entregado con foto pendiente', a.estado === 'entregado' && a.entrega.fotoPendiente === true && !a.entrega.fotoUrl);
  check('estado arriba: esperando señal', (await p.textContent('#syncMsg')).includes('esperando señal'), await p.textContent('#syncMsg'));
  await p.click('.chofer-resueltos-toggle'); await p.waitForTimeout(150);
  const txtCh = (await p.textContent('#viewChofer')).replace(/\s+/g, ' ');
  check('aviso de foto esperando señal', txtCh.includes('Foto esperando señal'), txtCh.slice(0, 300));
  const enCola = await p.evaluate(() => new Promise(r => { const q = indexedDB.open('hojaDeRutaPendientes'); q.onsuccess = () => { const g = q.result.transaction('fotos').objectStore('fotos').getAll(); g.onsuccess = () => r(g.result.length); }; }));
  check('la foto queda guardada en el teléfono', enCola === 1);
  await p.context().setOffline(false);
  await p.waitForTimeout(2000);
  st = await rowsOf(p, 'hojasDeRuta', '2026-09-24');
  const a2 = st.rows.find(r => r.id === 'a');
  check('al volver la señal se sube sola', !!a2.entrega.fotoUrl && !a2.entrega.fotoPendiente, JSON.stringify(a2.entrega).slice(0, 120));
  sinErrores(p);
  await p.context().close();
}
console.log('Administrador');
{
  const p = await open(b, { setup: setup('philip@kennedy.cl') });
  await p.waitForTimeout(500);
  check('ve todo (no es transportista)', !(await p.evaluate(() => document.body.classList.contains('modo-transportista'))) && await p.isVisible('#navDespachos'));
  await p.evaluate(() => document.querySelector('.side-item[data-view="liquidaciones"]').click()); await p.waitForTimeout(200);
  await p.fill('#liqTransportistaEmail', 'Pedro@Fletes.cl'); await p.press('#liqTransportistaEmail', 'Tab'); await p.waitForTimeout(500);
  const cfg = await p.evaluate(() => window.__fs.docs['config/app'].transportistas);
  check('anotar el correo lo agrega como transportista', cfg.includes('pedro@fletes.cl') && cfg.includes('juan@transportes.cl'), cfg.join(','));
  sinErrores(p);
  await p.context().close();
}
await b.close();
