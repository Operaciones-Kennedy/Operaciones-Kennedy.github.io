// Roles con un Firebase que bloquea config y hojasResumen (reglas sin actualizar).
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const setup = (email, extra) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-23');
  const rows = [{ id: 'a', cliente: 'Céline', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', contacto: '+569 8585 9910', productos: '6x', estado: 'entregado', tarifa: 8000 }];
  window.__fakeParams = { email: '${email}', denegar: ['config', 'hojasResumen'], seed: [
    ['hojasDeRuta/2026-09-23', { json: JSON.stringify(Object.assign({ titulo: 't', fecha: '2026-09-23', transportista: 'Transportes Barrientos', rows }, ${extra || '{}'})) }]] };
})()`;
const visibles = (p, sel) => p.$$eval(sel, es => es.filter(e => e.offsetWidth).map(e => e.textContent.trim()));

console.log('Administrador anota al transportista con Firebase bloqueando config');
{
  const p = await open(b, { setup: setup('philip@kennedy.cl'), width: 1280 });
  await p.waitForTimeout(600);
  check('avisa que faltan permisos en Firebase', await p.isVisible('#avisoPermisos') && (await p.textContent('#avisoPermisos')).includes('firestore.rules'));
  await p.click('.side-item[data-view="config"]'); await p.waitForTimeout(200);
  await p.fill('#configEmail', 'Transporte@Barrientos.cl'); await p.click('#configForm button[type=submit]'); await p.waitForTimeout(900);
  check('queda en la lista de la página', (await visibles(p, '#configLista li span')).includes('transporte@barrientos.cl'));
  check('aunque Firebase bloquee config, queda para todas las rutas', (await p.textContent('#configMsg')).includes('todas las rutas'));
  const st = await rowsOf(p, 'hojasDeRuta', '2026-09-23');
  check('se guarda dentro de la ruta del día', (st.transportistas || []).includes('transporte@barrientos.cl'), JSON.stringify(st.transportistas));
  await p.fill('#configEmail', 'philip@kennedy.cl'); await p.click('#configForm button[type=submit]'); await p.waitForTimeout(200);
  check('no deja agregarse a uno mismo', (await p.textContent('#configMsg')).includes('tu propio correo'));
  await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(150);
  await p.fill('#liqTransportistaEmail', 'otro@fletes.cl'); await p.press('#liqTransportistaEmail', 'Tab'); await p.waitForTimeout(900);
  const st2 = await rowsOf(p, 'hojasDeRuta', '2026-09-23');
  check('el correo de Liquidación también entra a la lista', (st2.transportistas || []).includes('otro@fletes.cl'));
  await p.click('#hojaNext'); await p.waitForTimeout(300);
  await p.click('.side-item[data-view="config"]'); await p.waitForTimeout(150);
  check('el día siguiente hereda la lista', (await visibles(p, '#configLista li span')).join(',') === 'otro@fletes.cl,transporte@barrientos.cl', (await visibles(p, '#configLista li span')).join(','));
  sinErrores(p);
  await p.context().close();
}
for (const [w, nombre] of [[1280, 'computador'], [390, 'teléfono']]) {
  console.log('Transportista en el ' + nombre + ' (Firebase bloqueando config)');
  const p = await open(b, { setup: setup('transporte@barrientos.cl', '{ transportistas: ["transporte@barrientos.cl"] }'), width: w, height: 844 });
  await p.waitForTimeout(600);
  check('entra en vista transportista', await p.evaluate(() => document.body.classList.contains('modo-transportista')));
  if (w > 820) check('menú lateral: solo Entregas y Liquidación del día', (await visibles(p, '.sidebar .side-item[data-view] span')).join(',') === 'Entregas,Liquidación del día', (await visibles(p, '.sidebar .side-item[data-view] span')).join(','));
  else check('menú inferior: Entregas, Pagos, Más', (await visibles(p, '.movil-tab span')).join(',') === 'Entregas,Pagos,Más', (await visibles(p, '.movil-tab span')).join(','));
  check('no ve el aviso de permisos', !(await p.isVisible('#avisoPermisos')));
  check('abre en Entregas', !(await p.$eval('#viewChofer', e => e.hidden)));
  sinErrores(p);
  await p.context().close();
}
console.log('El administrador lo agrega mirando otro día; el transportista abre el 23/09');
{
  const p = await open(b, { setup: setup('philip@kennedy.cl').replace("localStorage.setItem('hojaDeRuta_actual', '2026-09-23')", "localStorage.setItem('hojaDeRuta_actual', '2026-09-24')"), width: 1280 });
  await p.waitForTimeout(500);
  await p.click('.side-item[data-view="config"]'); await p.waitForTimeout(150);
  await p.fill('#configEmail', 'transporte@barrientos.cl'); await p.click('#configForm button[type=submit]'); await p.waitForTimeout(900);
  const principal = await p.evaluate(() => window.__fs.docs['hojasDeRuta/principal']);
  check('queda en la lista para todos los días', principal && principal.transportistas.includes('transporte@barrientos.cl'), JSON.stringify(principal));
  check('el mensaje confirma que vale para todas las rutas', (await p.textContent('#configMsg')).includes('todas las rutas'));
  sinErrores(p);
  await p.context().close();
}
{
  const p = await open(b, { setup: setup('transporte@barrientos.cl').replace("denegar: ['config', 'hojasResumen'], seed: [", "denegar: ['config', 'hojasResumen'], seed: [['hojasDeRuta/principal', { transportistas: ['transporte@barrientos.cl'] }], "), width: 390, height: 844 });
  await p.waitForTimeout(600);
  check('en el 23/09 (sin lista en la ruta) igual entra como transportista', await p.evaluate(() => document.body.classList.contains('modo-transportista')));
  check('menú inferior: Entregas, Pagos, Más', (await visibles(p, '.movil-tab span')).join(',') === 'Entregas,Pagos,Más', (await visibles(p, '.movil-tab span')).join(','));
  await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
  check('Más muestra la versión', /Versión \d{4}-\d{2}-\d{2}/.test(await p.textContent('#movilVersion')));
  sinErrores(p);
  await p.context().close();
}
await b.close();
