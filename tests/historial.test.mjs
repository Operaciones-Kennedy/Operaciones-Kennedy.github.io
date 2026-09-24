import { launch, open, rowsOf, check, FIX, sinErrores } from './harness.mjs';
import path from 'path';
const b = await launch();
console.log('T1 migración de la hoja única');
{
  const p = await open(b, { setup: () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ id: 'r' + i, cliente: 'Cliente ' + (i + 1), direccion: 'Calle ' + (i + 1), comuna: '', contacto: '', productos: '', estado: 'entregado', hora: '', prueba: '', tarifa: 8000, pagado: false }));
    window.__fakeParams = { seed: [['hojasDeRuta/principal', { json: JSON.stringify({ titulo: 'HOJA DE RUTA — Despachos PACS', puntoPartida: 'Av. Presidente Kennedy 5757', transportista: 'Juan', fecha: '', rows }), updatedAt: { toDate: () => new Date(2026, 8, 23, 20, 0) }, updatedBy: 'x' }]] };
  }});
  await p.waitForTimeout(600);
  const fecha = await p.inputValue('#hojaFecha');
  check('abre la ruta migrada (23/09)', fecha === '2026-09-23', fecha);
  check('muestra 15 despachos', (await p.$$('#tbody tr')).length === 15);
  const legacy = await p.evaluate(() => window.__fs.docs['hojasDeRuta/principal'].migradoA);
  check('marca la hoja original como migrada, sin borrarla', legacy === '2026-09-23' && !!(await p.evaluate(() => window.__fs.docs['hojasDeRuta/principal'].json)));
  check('crea el resumen de la ruta', !!(await p.evaluate(() => window.__fs.docs['hojasResumen/2026-09-23'])));
  const opts = await p.$$eval('#hojaRecientes option', o => o.map(x => x.textContent));
  check('la lista de rutas guardadas la muestra', opts.some(t => t.startsWith('23/09/2026 · 15 desp.')), opts.join(' | '));
  check('info del día', (await p.textContent('#hojaInfo')).includes('15 despacho'), await p.textContent('#hojaInfo'));

  console.log('T2 pasar al día siguiente y cargar un despacho');
  await p.click('#hojaNext'); await p.waitForTimeout(300);
  check('abre 24/09 vacía', (await p.inputValue('#hojaFecha')) === '2026-09-24' && (await p.textContent('#hojaInfo')).includes('0 despacho'));
  check('hereda título y punto de partida', (await p.textContent('#titulo')).includes('PACS') && (await p.textContent('#puntoPartida')).includes('Kennedy'));
  check('no crea el documento solo por mirar el día', !(await p.evaluate(() => window.__fs.docs['hojasDeRuta/2026-09-24'])));
  await p.click('#tbody tr:first-child td:nth-child(2)');
  await p.keyboard.type('Nuevo Cliente');
  await p.click('#hojaInfo'); await p.waitForTimeout(900);
  const d24 = await rowsOf(p, 'hojasDeRuta', '2026-09-24');
  check('se guarda en el documento del 24/09', d24 && d24.rows.some(r => r.cliente === 'Nuevo Cliente'));
  const d23 = await rowsOf(p, 'hojasDeRuta', '2026-09-23');
  check('el 23/09 no cambia', d23.rows.length === 15 && !d23.rows.some(r => r.cliente === 'Nuevo Cliente'));
  await p.selectOption('#hojaRecientes', '2026-09-23'); await p.waitForTimeout(300);
  check('volver al 23/09 desde la lista', (await p.$$('#tbody tr')).length === 15);
  if(p.errors.length) console.log('  errores:', p.errors);
  await p.context().close();
}
console.log('T3 cambios simultáneos de dos personas');
{
  const p = await open(b, { setup: () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ id: 'r' + i, cliente: 'Cliente ' + (i + 1), direccion: 'Calle ' + (i + 1), comuna: '', contacto: '', productos: '', estado: 'pendiente', hora: '', prueba: '', tarifa: 8000, pagado: false }));
    localStorage.setItem('hojaDeRuta_actual', '2026-09-25');
    window.__fakeParams = { seed: [['hojasDeRuta/2026-09-25', { json: JSON.stringify({ titulo: 't', puntoPartida: '', transportista: '', fecha: '2026-09-25', rows }) }]] };
  }});
  await p.waitForTimeout(400);
  // Justo antes de que este dispositivo guarde, "otra persona" marca entregado el 2 y borra el 4.
  await p.evaluate(() => { window.__beforeCommit = null; });
  await p.evaluate(() => {
    const st = window.__fs.json('hojasDeRuta', '2026-09-25');
    st.rows[1].estado = 'entregado';
    st.rows = st.rows.filter(r => r.id !== 'r3');
    // Se escribe sin avisar a esta pestaña (como si el aviso aún no llegara)
    window.__fs.docs['hojasDeRuta/2026-09-25'] = { json: JSON.stringify(st) };
  });
  await p.fill('#tbody tr:first-child input.tarifa', '12000');
  await p.dispatchEvent('#tbody tr:first-child input.tarifa', 'change');
  await p.click('#hojaInfo'); await p.waitForTimeout(1000);
  const fin = await rowsOf(p, 'hojasDeRuta', '2026-09-25');
  check('se conserva mi cambio (tarifa 12000 en el 1)', fin.rows.find(r => r.id === 'r0').tarifa == 12000);
  check('se conserva el cambio del otro (2 entregado)', fin.rows.find(r => r.id === 'r1').estado === 'entregado');
  check('el despacho que borró el otro no reaparece', !fin.rows.some(r => r.id === 'r3'), fin.rows.map(r => r.id).join(','));
  await p.waitForTimeout(300);
  check('la pantalla muestra la versión combinada', (await p.$$('#tbody tr')).length === 3);
  if(p.errors.length) console.log('  errores:', p.errors);
  await p.context().close();
}
console.log('T4 pestaña vieja con 30 despachos no pisa la lista de 15');
{
  const p = await open(b, { setup: () => {
    const mk = n => Array.from({ length: n }, (_, i) => ({ id: 'r' + i, cliente: 'C' + i, direccion: 'D' + i, comuna: '', contacto: '', productos: '', estado: 'entregado', hora: '', prueba: '', tarifa: 8000, pagado: false }));
    localStorage.setItem('hojaDeRuta_actual', '2026-09-26');
    window.__fakeParams = { seed: [['hojasDeRuta/2026-09-26', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-26', rows: mk(30) }) }]] };
  }});
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const st = window.__fs.json('hojasDeRuta', '2026-09-26');
    st.rows = st.rows.slice(0, 15);
    window.__fs.docs['hojasDeRuta/2026-09-26'] = { json: JSON.stringify(st) }; // la importación hecha en otra pestaña
  });
  // Esta pestaña vieja guarda coordenadas de un despacho que ya no existe
  await p.fill('#tbody tr:nth-child(20) input.tarifa', '9000');
  await p.dispatchEvent('#tbody tr:nth-child(20) input.tarifa', 'change');
  await p.click('#hojaInfo'); await p.waitForTimeout(1000);
  const fin = await rowsOf(p, 'hojasDeRuta', '2026-09-26');
  check('siguen 15 despachos en línea', fin.rows.length === 15, String(fin.rows.length));
  if(p.errors.length) console.log('  errores:', p.errors);
  await p.context().close();
}
console.log('T9 rutas guardadas sin resumen (reglas antiguas)');
{
  const p = await open(b, { setup: () => {
    const hoja = (n, est) => JSON.stringify({ titulo: 'PACS', transportista: 'Juan', rows: Array.from({ length: n }, (_, i) => ({ id: 'x' + i, cliente: 'C' + i, direccion: 'D' + i, estado: est, tarifa: 5000 })) });
    window.__fakeParams = { seed: [
      ['hojasDeRuta/2026-09-20', { json: hoja(4, 'entregado') }],
      ['hojasDeRuta/2026-09-21', { json: hoja(2, 'pendiente') }],
      ['hojasDeRuta/2026-09-22', { json: JSON.stringify({ rows: [{ id: 'v' }] }) }],
      ['hojasResumen/2026-09-21', { fecha: '2026-09-21', despachos: 2, entregados: 0 }]
    ] };
  }});
  await p.waitForTimeout(900);
  const r20 = await p.evaluate(() => window.__fs.docs['hojasResumen/2026-09-20']);
  check('crea el resumen que faltaba', r20 && r20.despachos === 4 && r20.entregados === 4 && r20.totalTarifa === 20000, JSON.stringify(r20));
  check('no toca el resumen que ya estaba', (await p.evaluate(() => window.__fs.docs['hojasResumen/2026-09-21'].updatedBy)) === undefined);
  check('no crea resumen de una ruta vacía', !(await p.evaluate(() => window.__fs.docs['hojasResumen/2026-09-22'])));
  const opts = await p.$$eval('#hojaRecientes option', o => o.map(x => x.textContent));
  check('aparece en rutas guardadas', opts.some(t => t.startsWith('20/09/2026 · 4 desp.')), opts.join(' | '));
  if(p.errors.length) console.log('  errores:', p.errors);
  await p.context().close();
}
await b.close();
