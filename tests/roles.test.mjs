// Roles con un Firebase que bloquea config y hojasResumen (reglas sin actualizar).
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const setup = (email, extra) => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-23');
  const rows = [{ id: 'a', cliente: 'Céline', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', contacto: '+569 8585 9910', productos: '6x', estado: 'entregado', tarifa: 8000 }];
  window.__fakeParams = { email: '${email}', denegar: ['config', 'hojasResumen'], seed: [
    ['hojasDeRuta/principal', { conLiquidacion: ['transporte@barrientos.cl'] }],
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
  const p = await open(b, { setup: setup('transporte@barrientos.cl').replace("denegar: ['config', 'hojasResumen'], seed: [", "denegar: ['config', 'hojasResumen'], seed: [['hojasDeRuta/principal', { transportistas: ['transporte@barrientos.cl'], conLiquidacion: ['transporte@barrientos.cl'] }], ").replace("['hojasDeRuta/principal', { conLiquidacion: ['transporte@barrientos.cl'] }],", ""), width: 390, height: 844 });
  await p.waitForTimeout(600);
  check('en el 23/09 (sin lista en la ruta) igual entra como transportista', await p.evaluate(() => document.body.classList.contains('modo-transportista')));
  check('menú inferior: Entregas, Pagos, Más', (await visibles(p, '.movil-tab span')).join(',') === 'Entregas,Pagos,Más', (await visibles(p, '.movil-tab span')).join(','));
  await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
  check('Más muestra la versión', /Versión \d{4}-\d{2}-\d{2}/.test(await p.textContent('#movilVersion')));
  sinErrores(p);
  await p.context().close();
}
await b.close();

// ---- Regla principal: solo los administradores de la lista ven todo ----
{
  const b2 = await launch();
  const caso = (email, extra) => `(() => {
    localStorage.setItem('hojaDeRuta_actual', '2026-09-23');
    const rows = [{ id: 'a', cliente: 'Céline', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', contacto: '', productos: '', estado: 'entregado', tarifa: 8000 }];
    window.__fakeParams = Object.assign({ email: '${email}', denegar: ['config', 'hojasResumen'], seed: [['hojasDeRuta/2026-09-23', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-23', rows }) }]] }, ${extra});
  })()`;
  for (const [titulo, email, extra, esperado] of [
    ['Correo real de administrador (lista del código)', 'PFuentesArroyo@coca-cola.com', '{ usarListaReal: true }', 'admin'],
    ['Otro correo real de administrador', 'philip.fuentes93@gmail.com', '{ usarListaReal: true }', 'admin'],
    ['Cualquier otro correo, sin anotarlo en ninguna lista', 'transporte@barrientos.cl', '{ usarListaReal: true }', 'transportista'],
    ['Administrador de prueba', 'jefe@prueba.cl', '{ admins: ["jefe@prueba.cl"] }', 'admin'],
    ['No administrador de prueba', 'chofer@prueba.cl', '{ admins: ["jefe@prueba.cl"] }', 'transportista']
  ]) {
    console.log(titulo);
    for (const w of [1280, 390]) {
      const p = await open(b2, { setup: caso(email, extra), width: w, height: 844 });
      await p.waitForTimeout(600);
      const trans = await p.evaluate(() => document.body.classList.contains('modo-transportista'));
      const menu = w > 820 ? await p.$$eval('.sidebar .side-item[data-view] span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent).join(','))
                           : await p.$$eval('.movil-tab span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent).join(','));
      if (esperado === 'transportista') check((w > 820 ? 'computador' : 'teléfono') + ': solo ve ' + menu, trans && (menu === 'Entregas' || menu === 'Entregas,Más'), menu);
      else check((w > 820 ? 'computador' : 'teléfono') + ': ve el menú completo', !trans && menu.split(',').length >= 5, menu);
      sinErrores(p);
      await p.context().close();
    }
  }
  await b2.close();
}

// ---- Ayudantes: solo Entregas, sin montos; «Ve la liquidación» solo para quien se marca ----
{
  const b3 = await launch();
  const caso = (email) => `(() => {
    localStorage.setItem('hojaDeRuta_actual', '2026-09-23');
    const rows = [{ id: 'a', cliente: 'Céline', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', contacto: '', productos: '', estado: 'pendiente', tarifa: 8000 }];
    window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: [
      ['hojasDeRuta/2026-09-23', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-23', rows }) }],
      ['config/app', { transportistas: ['dueno@fletes.cl', 'ayudante@fletes.cl', 'nuevo@fletes.cl'], conLiquidacion: ['dueno@fletes.cl'], conHistorial: ['ayudante@fletes.cl'] }]] };
  })()`;
  const menu = (p, w) => w > 820 ? p.$$eval('.sidebar .side-item[data-view] span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent).join(','))
                                 : p.$$eval('.movil-tab span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent).join(','));
  for (const w of [1280, 390]) {
    console.log('Ayudante sin liquidación (' + (w > 820 ? 'computador' : 'teléfono') + ')');
    const p = await open(b3, { setup: caso('ayudante@fletes.cl'), width: w, height: 844 });
    await p.waitForTimeout(600);
    check('menú: Entregas e Historial de entregas, sin Pagos', (await menu(p, w)) === (w > 820 ? 'Entregas,Historial de entregas' : 'Entregas,Más'), await menu(p, w));
    check('no ve el monto del despacho', !(await p.textContent('#choferList')).includes('$8.000'));
    await p.evaluate(() => document.querySelector('.side-item[data-view="liquidaciones"]').click()); await p.waitForTimeout(150);
    check('no puede abrir la liquidación por otro lado', await p.$eval('#viewLiquidaciones', e => e.hidden) && !(await p.$eval('#viewChofer', e => e.hidden)));
    if (w > 820) await p.click('.side-item[data-view="entregashist"]');
    else { await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150); await p.click('#movilMas [data-ir="entregashist"]'); }
    await p.waitForTimeout(200);
    await p.fill('#rDesdeE', '2026-09-01'); await p.dispatchEvent('#rDesdeE', 'change');
    await p.fill('#rHastaE', '2026-09-30'); await p.dispatchEvent('#rHastaE', 'change');
    await p.selectOption('#ehEstado', 'todas'); await p.waitForTimeout(400);
    check('abre su Historial de entregas', !(await p.$eval('#viewEntregasHist', e => e.hidden)) && (await p.textContent('#ehFilas')).includes('Céline'));
    check('el historial no muestra montos', !(await p.textContent('#viewEntregasHist')).includes('$'));
    if (w <= 820) check('en el teléfono queda marcada la pestaña Más', (await p.textContent('.movil-tab.activa')).trim() === 'Más');
    sinErrores(p);
    await p.context().close();
  }
  for (const w of [1280, 390]) {
    console.log('Transportista con «Ve la liquidación» (' + (w > 820 ? 'computador' : 'teléfono') + ')');
    const p = await open(b3, { setup: caso('Dueno@Fletes.cl'), width: w, height: 844 });
    await p.waitForTimeout(600);
    check('menú: Entregas y liquidación', (await menu(p, w)) === (w > 820 ? 'Entregas,Liquidación del día' : 'Entregas,Pagos,Más'), await menu(p, w));
    check('ve el monto del despacho', (await p.textContent('#choferList')).includes('$8.000'));
    sinErrores(p);
    await p.context().close();
  }
  for (const w of [1280, 390]) {
    console.log('Transportista sin casillas marcadas (' + (w > 820 ? 'computador' : 'teléfono') + ')');
    const p = await open(b3, { setup: caso('nuevo@fletes.cl'), width: w, height: 844 });
    await p.waitForTimeout(600);
    check('menú: solo Entregas', (await menu(p, w)) === (w > 820 ? 'Entregas' : 'Entregas,Más'), await menu(p, w));
    await p.evaluate(() => document.querySelector('.side-item[data-view="entregashist"]').click()); await p.waitForTimeout(150);
    check('no puede abrir el historial por otro lado', await p.$eval('#viewEntregasHist', e => e.hidden) && !(await p.$eval('#viewChofer', e => e.hidden)));
    if (w <= 820) {
      await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
      check('en Más no aparece Historial de entregas', !(await p.isVisible('#movilMas [data-ir="entregashist"]')));
    }
    sinErrores(p);
    await p.context().close();
  }
  console.log('El administrador marca y desmarca «Ve la liquidación»');
  {
    const p = await open(b3, { setup: caso('jefe@prueba.cl'), width: 1280 });
    await p.waitForTimeout(600);
    await p.click('.side-item[data-view="config"]'); await p.waitForTimeout(150);
    const casillas = () => p.$$eval('#configLista li', lis => lis.map(li => li.querySelector('span').textContent + '=' + li.querySelector('input').checked).join(','));
    check('la lista muestra quién ve la liquidación', (await casillas()) === 'ayudante@fletes.cl=false,dueno@fletes.cl=true,nuevo@fletes.cl=false', await casillas());
    await p.check('#configLista li:first-child input'); await p.waitForTimeout(500);
    const cfg = await p.evaluate(() => window.__fs.docs['config/app']);
    const pr = await p.evaluate(() => window.__fs.docs['hojasDeRuta/principal']);
    check('se guarda en config/app y en la copia general', cfg.conLiquidacion.includes('ayudante@fletes.cl') && pr.conLiquidacion.includes('ayudante@fletes.cl'), JSON.stringify(cfg));
    await p.uncheck('#configLista li:nth-child(2) input'); await p.waitForTimeout(500);
    const cfg2 = await p.evaluate(() => window.__fs.docs['config/app']);
    check('desmarcar lo quita', !cfg2.conLiquidacion.includes('dueno@fletes.cl') && cfg2.conLiquidacion.includes('ayudante@fletes.cl'), JSON.stringify(cfg2));
    check('el administrador sigue viendo todo', !(await p.evaluate(() => document.body.classList.contains('sin-dinero') || document.body.classList.contains('sin-historial'))));
    const hist = () => p.$$eval('#configLista li', lis => lis.map(li => li.querySelector('span').textContent + '=' + li.querySelector('[data-permiso="conHistorial"] input').checked).join(','));
    check('muestra quién ve el historial', (await hist()) === 'ayudante@fletes.cl=true,dueno@fletes.cl=false,nuevo@fletes.cl=false', await hist());
    await p.check('#configLista li:nth-child(3) [data-permiso="conHistorial"] input'); await p.waitForTimeout(500);
    const cfg3 = await p.evaluate(() => window.__fs.docs['config/app']);
    check('«Ve el historial» se guarda', cfg3.conHistorial.includes('nuevo@fletes.cl') && cfg3.conHistorial.includes('ayudante@fletes.cl'), JSON.stringify(cfg3));
    await p.evaluate(() => window.__fs.remoteWrite('config', 'app', Object.assign({}, window.__fs.docs['config/app'], { conLiquidacion: ['dueno@fletes.cl', 'nuevo@fletes.cl'] })));
    await p.waitForTimeout(300);
    check('la página se actualiza sola si la lista cambia en línea', (await casillas()).includes('nuevo@fletes.cl=true'), await casillas());
    sinErrores(p);
    await p.context().close();
  }
  await b3.close();
}
console.log('Página Transportistas en el teléfono');
{
  const b4 = await launch();
  const p = await open(b4, { setup: `(() => { window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: [['config/app', { transportistas: ['jormansvivas19@gmail.com', 'ruben24m@gmail.com', 'trs.barrientos80@gmail.com'], conLiquidacion: ['trs.barrientos80@gmail.com'] }]] }; })()`, width: 390, height: 844 });
  await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('.side-item[data-view="config"]').click()); await p.waitForTimeout(300);
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check('casilla y botón Quitar dentro de cada fila', await p.$$eval('#configLista li', lis => lis.every(li => { const r = li.getBoundingClientRect(); return [...li.children].every(c => { const x = c.getBoundingClientRect(); return x.left >= r.left - 1 && x.right <= r.right + 1; }); })));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA });
  sinErrores(p);
  await p.context().close();
  await b4.close();
}
