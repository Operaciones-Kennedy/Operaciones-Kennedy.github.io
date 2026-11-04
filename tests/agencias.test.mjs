// Agencias: columna «Agencia» en la Ruta del día, «Mis despachos» para cada agencia y aviso por correo al entregar.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const hoy = new Date();
const HOY = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
const MES = HOY.slice(0, 7);
const ahora = new Date().toISOString();
const rows = [
  { id: 'a', cliente: 'Teatro Municipal', direccion: 'Agustinas 794', comuna: 'Santiago', estado: 'entregado', tarifa: 8000, solicitudId: 's1', entrega: { fotoUrl: GIF, horaEntrega: '15:20', recibidoPor: 'Carolina', registradoAt: ahora } },
  { id: 'b', cliente: 'Radio Infinita', direccion: 'Vicuña Mackenna 1370', comuna: 'Ñuñoa', estado: 'pendiente', tarifa: 8000, solicitudId: 's1' },
  { id: 'c', cliente: 'Otro cliente', direccion: 'Merced 10', comuna: 'Santiago', estado: 'entregado', tarifa: 8000, agencia: 'Azerta', entrega: { fotoUrl: GIF, registradoAt: ahora } },
  { id: 'd', cliente: 'Cargado a mano', direccion: 'Lastarria 90', comuna: 'Santiago', estado: 'pendiente', tarifa: 8000 }
];
const sols = [{ id: 's1', creadoAt: ahora, por: 'colomba@burson.com', solicitante: { nombre: 'Colomba Muñoz', empresa: 'Burson Chile' }, estado: 'programada', fecha: HOY, despachos: [] }];
const seed = [
  ['hojasDeRuta/' + HOY, { json: JSON.stringify({ titulo: 't', fecha: HOY, transportista: 'Transportes Barrientos', rows }) }],
  ['hojasResumen/' + HOY, { fecha: HOY, despachos: rows.length }],
  ['hojasDeRuta/sol_' + MES, { json: JSON.stringify({ solicitudes: sols }) }],
  ['config/app', { agencias: ['colomba@burson.com'] }]
];
const setup = (email, extra) => `(() => { localStorage.setItem('hojaDeRuta_actual', '${HOY}'); ${extra || ''} window.__fakeParams = { email: '${email}', admins: ['jefe@prueba.cl'], seed: ${JSON.stringify(seed)} }; })()`;

console.log('Columna «Agencia» y aviso por correo (administrador)');
{
  const p = await open(b, { setup: setup('jefe@prueba.cl'), width: 1280 });
  await p.waitForTimeout(800);
  const ths = await p.$$eval('#tabla thead th', t => t.map(x => x.textContent.trim()));
  check('columna Agencia después de PO', ths[4] === 'Agencia', ths.join(','));
  check('muestra la agencia asignada', (await p.inputValue('#tbody tr:nth-child(3) .agencia-celda select')) === 'Azerta');
  await p.selectOption('#tbody tr:nth-child(4) .agencia-celda select', 'Wiin'); await p.waitForTimeout(900);
  check('se guarda en el despacho', (await rowsOf(p, 'hojasDeRuta', HOY)).rows[3].agencia === 'Wiin');
  await p.evaluate(() => window.__avisarEntregasAgencias()); await p.waitForTimeout(900);
  const mails = await p.evaluate(() => Object.entries(window.__fs.docs).filter(([k]) => k.startsWith('mail/')).map(([, v]) => v));
  check('encola un correo a la agencia por el despacho entregado', mails.length === 1 && mails[0].to[0] === 'colomba@burson.com' && mails[0].tipo === 'entrega' && mails[0].message.html.includes('Teatro Municipal') && mails[0].message.html.includes('Recibió: Carolina'), JSON.stringify(mails));
  check('marca el despacho como avisado', !!(await rowsOf(p, 'hojasDeRuta', HOY)).rows[0].avisoEntregaAt);
  await p.evaluate(() => window.__avisarEntregasAgencias()); await p.waitForTimeout(600);
  check('no repite el aviso', (await p.evaluate(() => Object.keys(window.__fs.docs).filter(k => k.startsWith('mail/')).length)) === 1);
  sinErrores(p);
  await p.context().close();
}

console.log('«Mis despachos» para la agencia');
{
  const p = await open(b, { setup: setup('colomba@burson.com', "localStorage.setItem('ruteka_visto_colomba@burson.com', '2020-01-01T00:00:00Z');"), width: 1280 });
  await p.waitForTimeout(800);
  check('la agencia ve «Mis despachos» en el menú', await p.isVisible('.side-item[data-view="reporte"][data-solo-agencia]') && !(await p.isVisible('.side-item[data-view="reporte"][data-solo-admin]')));
  await p.click('.side-item[data-view="reporte"][data-solo-agencia]'); await p.waitForTimeout(1200);
  const txt = await p.textContent('#rgCuerpo');
  check('el título dice su agencia', (await p.textContent('#viewReporte h1')) === 'Mis despachos' && txt.includes('Mis despachos · Burson'), txt.slice(0, 120));
  check('solo ve sus despachos', (await p.$$('.rg-env')).length === 2 && txt.includes('Teatro Municipal') && !txt.includes('Otro cliente') && !txt.includes('Cargado a mano'));
  check('no ve la comparación entre agencias', !txt.includes('Agencias y puntos de contacto'));
  check('avisa las entregas nuevas', txt.includes('1 entrega(s) nueva(s)') && (await p.$$('.rg-env.nueva')).length === 1);
  check('no muestra montos', !txt.includes('$'));
  sinErrores(p);
  await p.context().close();
}
await b.close();
