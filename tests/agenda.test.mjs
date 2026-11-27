// Mi agenda (recordatorios con recorte) y envíos «Directo Andina» sin costo.
import { launch, open, rowsOf, check, sinErrores } from './harness.mjs';
const b = await launch();
const f = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hoy = new Date();
const HOY = f(hoy), MES = HOY.slice(0, 7);
const AYER = f(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1));
const MANANA = f(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const fila = (id, cliente, extra) => Object.assign({ id, cliente, direccion: 'Calle ' + id, comuna: 'Santiago', estado: 'pendiente', tarifa: 35000, pagado: false }, extra || {});
const rows = [fila('a', 'Teatro Municipal'), fila('b', 'Colegio Andino', { envio: 'andina', tarifa: 0, servicio: 'Directo Andina' })];
const agenda = { items: [
  { id: 'ag1', fecha: AYER, tipo: 'pedir', frente: 'Comité Olímpico', texto: '4 cajas', hecho: false },
  { id: 'ag2', fecha: MANANA, tipo: 'coordinar', frente: 'Colegios', texto: 'Entrega directa', entrega: MANANA, hecho: false }
] };
const sols = [{ id: 's1', creadoAt: new Date().toISOString(), por: 'ops@burson.com', solicitante: { nombre: 'Colomba', empresa: 'Burson' }, estado: 'pendiente', fecha: MANANA, despachos: [{ cliente: 'X' }] }];
const seed = [
  ['hojasDeRuta/' + HOY, { json: JSON.stringify({ titulo: 't', fecha: HOY, transportista: 'Transportes Barrientos', rows }) }],
  ['hojasResumen/' + HOY, { fecha: HOY, despachos: 2, andina: 1 }],
  ['hojasDeRuta/agenda', { json: JSON.stringify(agenda) }],
  ['hojasDeRuta/sol_' + MES, { json: JSON.stringify({ solicitudes: sols }) }]
];
const p = await open(b, { setup: `(() => { localStorage.setItem('hojaDeRuta_actual', '${HOY}'); window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: ${JSON.stringify(seed)} }; })()`, width: 1280 });
await p.waitForTimeout(800);
const agendaGuardada = () => p.evaluate(() => JSON.parse(window.__fs.docs['hojasDeRuta/agenda'].json).items);

console.log('Directo Andina en la Ruta del día y en la liquidación');
check('la tarifa ofrece «Directo Andina · sin costo» y la fila lo muestra', (await p.$eval('#tbody tr:nth-child(2) select.tarifa', s => s.value + '|' + s.classList.contains('andina'))) === 'andina|true');
await p.selectOption('#tbody tr:nth-child(1) select.tarifa', 'andina'); await p.waitForTimeout(800);
const r0 = (await rowsOf(p, 'hojasDeRuta', HOY)).rows[0];
check('elegirlo deja el envío sin costo', r0.envio === 'andina' && r0.tarifa === 0, JSON.stringify(r0));
await p.selectOption('#tbody tr:nth-child(1) select.tarifa', '35000'); await p.waitForTimeout(800);
check('y se puede volver a la tarifa normal', !(await rowsOf(p, 'hojasDeRuta', HOY)).rows[0].envio);
await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(300);
const liq = await p.textContent('#tbodyLiq');
check('la liquidación del día no incluye el envío directo Andina', liq.includes('Teatro Municipal') && !liq.includes('Colegio Andino'));

console.log('Mi agenda');
check('el menú avisa 1 pendiente (el atrasado)', (await p.textContent('#agBadge')) === '1' && await p.isVisible('#agBadge'));
await p.click('.side-item[data-view="agenda"]'); await p.waitForTimeout(500);
const hoyTxt = await p.textContent('#agHoy');
check('«Hoy tengo que…» muestra lo atrasado y las solicitudes por responder', hoyTxt.includes('Pedir a Andina · atrasado') && hoyTxt.includes('Comité Olímpico') && hoyTxt.includes('1 solicitud(es) esperan tu respuesta'), hoyTxt);
const grid = await p.textContent('#agGrid');
check('el calendario muestra recordatorios, la ruta con su directo Andina y la solicitud por responder', grid.includes('Colegios · Entrega directa') && grid.includes('Ruta · 2 despacho(s) · 1 directo Andina') && grid.includes('Por responder · Burson'), grid.slice(0, 300));
await p.click('#agNuevo');
await p.selectOption('#agTipo', 'pedir');
await p.fill('#agFecha', MANANA);
await p.fill('#agFrente', 'EK');
await p.fill('#agTexto', '2 cajas para el lanzamiento');
await p.setInputFiles('#agArchivo', { name: 'whatsapp.png', mimeType: 'image/png', buffer: PNG });
check('muestra la vista previa del recorte', await p.isVisible('#agPrevia'));
await p.click('#agGuardar'); await p.waitForTimeout(900);
const items = await agendaGuardada();
const nuevo = items.find(x => x.frente === 'EK');
check('guarda el recordatorio con su recorte en Storage', items.length === 3 && nuevo && nuevo.fecha === MANANA && nuevo.recorte && /^hojasDeRuta\/agenda\//.test(nuevo.recorte.path), JSON.stringify(nuevo));
check('y abre su detalle con el recorte', await p.isVisible('#agDetalle') && !!(await p.$('#agDetalle img.ag-rec')) && (await p.textContent('#agDetalle')).includes('2 cajas para el lanzamiento'));
await p.click('#agHoy .ag-hoy-item.pedir input'); await p.waitForTimeout(800);
check('marcar en «Hoy tengo que…» lo deja hecho', (await agendaGuardada()).find(x => x.id === 'ag1').hecho === true && (await p.textContent('#agBadge')) === '0');
await p.click('.ag-ficha.coordinar'); await p.waitForTimeout(200);
await p.click('#agDetalle [data-acc="crear"]'); await p.waitForTimeout(400);
check('«Crear solicitud con esto» abre Solicitudes con los datos y Directo Andina', !(await p.$eval('#viewSolicitudes', e => e.hidden)) && (await p.inputValue('#solEmpresa')) === 'Colegios' && (await p.inputValue('#solFecha')) === MANANA && await p.isChecked('input[name="solEnvio"][value="andina"]'));
await p.fill('#solNombre', 'Philip');
await p.fill('#solFilas input[data-k="cliente"]', 'Colegio Los Andes');
await p.click('#solEnviar'); await p.waitForTimeout(900);
const solGuardada = await p.evaluate(m => JSON.parse(window.__fs.docs['hojasDeRuta/sol_' + m].json).solicitudes.find(s => s.solicitante.empresa === 'Colegios'), MES);
check('la solicitud queda marcada como Directo Andina', solGuardada && solGuardada.envio === 'andina', JSON.stringify(solGuardada));
check('y su tarjeta lo dice', (await p.textContent('#solLista')).includes('Directo Andina · sin costo'));
sinErrores(p);
await b.close();
