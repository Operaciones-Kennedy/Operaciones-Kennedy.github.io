// En el teléfono: menú inferior, barra superior y panel "Más". En el computador: menú lateral.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const setup = email => `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-24');
  const rows = [{ id: 'a', cliente: 'Céline', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', contacto: '+569 8585 9910', productos: '6x', estado: 'pendiente', tarifa: 8000 }];
  window.__fakeParams = { email: '${email}', seed: [
    ['hojasDeRuta/2026-09-24', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-24', rows }) }],
    ['config/app', { transportistas: ['juan@transportes.cl'], conLiquidacion: ['juan@transportes.cl'] }]] };
})()`;
const visible = (p, sel) => p.$eval(sel, e => !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).visibility !== 'hidden');
const tabs = p => p.$$eval('.movil-tab', bs => bs.filter(b => b.offsetWidth).map(b => b.textContent.trim()));
const vista = p => p.evaluate(() => ['viewDespachos','viewChofer','viewReportes','viewLiquidaciones','viewHistorial','viewLiqPeriodo'].find(id => !document.getElementById(id).hidden));

console.log('Administrador en el teléfono');
{
  const p = await open(b, { setup: setup('philip@kennedy.cl'), width: 390, height: 844 });
  await p.waitForTimeout(500);
  check('sin menú lateral', !(await visible(p, '.sidebar')));
  check('barra superior con logo e inicial', await visible(p, '.movil-top') && (await p.textContent('#movilAvatar')) === 'P');
  check('menú inferior: Ruta, Entregas, Reportes, Pagos, Más', (await tabs(p)).join(',') === 'Ruta,Entregas,Reportes,Pagos,Más', (await tabs(p)).join(','));
  check('pestaña activa al inicio: Ruta', (await p.textContent('.movil-tab.activa')).trim() === 'Ruta');
  await p.click('.movil-tab[data-tab="chofer"]'); await p.waitForTimeout(150);
  check('Entregas abre la vista de entregas', (await vista(p)) === 'viewChofer' && (await p.textContent('.movil-tab.activa')).trim() === 'Entregas');
  await p.click('.movil-tab[data-tab="liquidaciones"]'); await p.waitForTimeout(150);
  check('Pagos abre la liquidación', (await vista(p)) === 'viewLiquidaciones');
  await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
  check('Más abre el panel con la cuenta', !(await p.$eval('#movilMas', e => e.hidden)) && (await p.textContent('#movilMasEmail')) === 'philip@kennedy.cl');
  await p.click('.movil-sheet-item[data-ir="liqperiodo"]'); await p.waitForTimeout(300);
  check('Liquidación del período desde Más (y marca Pagos)', (await vista(p)) === 'viewLiqPeriodo' && await p.$eval('#movilMas', e => e.hidden) && (await p.textContent('.movil-tab.activa')).trim() === 'Pagos');
  await p.click('#movilAvatar'); await p.waitForTimeout(100);
  await p.click('.movil-sheet-fondo', { position: { x: 20, y: 20 } }); await p.waitForTimeout(100);
  check('tocar fuera cierra el panel', await p.$eval('#movilMas', e => e.hidden));
  const pie = await p.evaluate(() => { const c = document.querySelector('main.content'); return parseFloat(getComputedStyle(c).paddingBottom); });
  check('el contenido deja espacio para el menú inferior', pie >= 90, String(pie));
  sinErrores(p);
  await p.context().close();
}
console.log('Transportista en el teléfono');
{
  const p = await open(b, { setup: setup('juan@transportes.cl'), width: 390, height: 844 });
  await p.waitForTimeout(500);
  check('menú inferior: Entregas, Pagos, Más', (await tabs(p)).join(',') === 'Entregas,Pagos,Más', (await tabs(p)).join(','));
  await p.click('.movil-tab[data-tab="mas"]'); await p.waitForTimeout(150);
  const items = await p.$$eval('.movil-sheet-item', bs => bs.filter(b => b.offsetWidth).map(b => b.textContent.trim()));
  check('en Más solo ve Historial de entregas y Cerrar sesión (sin opciones de administrador)', items.join(',') === 'Historial de entregas,Cerrar sesión', items.join(','));
  sinErrores(p);
  await p.context().close();
}
console.log('Computador');
{
  const p = await open(b, { setup: setup('philip@kennedy.cl'), width: 1280, height: 900 });
  await p.waitForTimeout(400);
  check('menú lateral visible y sin menú inferior ni barra superior', await visible(p, '.sidebar') && !(await visible(p, '.movil-nav')) && !(await visible(p, '.movil-top')));
  check('al abrir queda marcada Ruta del día', (await p.getAttribute('#navDespachos', 'aria-current')) === 'page');
  const textos = await p.$$eval('.sidebar .side-item[data-view] span', ss => ss.filter(x => x.offsetWidth).map(x => x.textContent));
  check('menú lateral ancho con las 8 opciones escritas', textos.join(',') === 'Ruta del día,Entregas,KPIs del día,Historial y reportes,Historial de entregas,Liquidación del día,Liquidación del período,Transportistas', textos.join(','));
  await p.click('.side-item[data-view="historial"]'); await p.waitForTimeout(300);
  check('un clic abre la vista y la marca activa', (await vista(p)) === 'viewHistorial' && (await p.getAttribute('.side-item[data-view="historial"]', 'aria-current')) === 'page');
  await p.setViewportSize({ width: 960, height: 800 }); await p.waitForTimeout(150);
  const ancho = await p.$eval('.sidebar', e => e.getBoundingClientRect().width);
  check('en pantallas medianas se contrae a solo íconos', ancho <= 80 && !(await p.$$eval('.sidebar .side-item span', ss => ss.some(x => x.offsetWidth))), String(ancho));
  sinErrores(p);
  await p.context().close();
}
await b.close();
