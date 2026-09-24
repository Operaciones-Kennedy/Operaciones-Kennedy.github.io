import { launch, open, rowsOf, check, FIX, sinErrores } from './harness.mjs';
import path from 'path';
const b = await launch();
const setup = `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-24');
  const mk = (id, lng, estado, extra) => Object.assign({ id, cliente: 'C-' + id, direccion: 'Dir ' + id, comuna: 'Santiago', contacto: '', productos: '', estado: estado || 'pendiente', tarifa: 8000 }, lng == null ? {} : { lat: -33.44, lng }, extra || {});
  const rows = [mk('A', -70.50), mk('B', -70.56), mk('X', null), mk('E', -70.60, 'entregado'), mk('C', -70.54), mk('D', -70.52)];
  window.__fakeParams = { seed: [['hojasDeRuta/2026-09-24', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-24', puntoPartida: 'Kennedy', startLat: -33.44, startLng: -70.58, _geoStartQuery: 'Kennedy, Chile', rows: rows.map(r => Object.assign(r, { _geoQuery: [r.direccion, r.comuna, 'Chile'].join(', ') })) }) }]] };
})()`;
const p = await open(b, { setup });
await p.waitForTimeout(500);
await p.click('#btnOptimizar');
await p.waitForSelector('.app-dialog-msg');
const msg = (await p.textContent('.app-dialog-msg')).replace(/\n+/g, ' / ');
await p.click('.app-dialog button.primary'); await p.waitForTimeout(900);
let st = await rowsOf(p, 'hojasDeRuta', '2026-09-24');
const orden = st.rows.map(r => r.id).join('');
check('orden: entregado primero, luego B C D A por cercanía, sin ubicación al final', orden === 'EBCDAX', orden);
check('mensaje con km, hora de término y aviso de sin ubicación', /Recorrido estimado: [\d.]+ km/.test(msg) && /termina aprox\. a las \d\d:\d\d/.test(msg) && msg.includes('1 despacho(s) sin ubicación'), msg);
const etas = st.rows.filter(r => r.eta).map(r => r.eta);
check('horas estimadas crecientes desde las 09:00', etas.length === 4 && etas[0] > '09:00' && etas.every((e, i) => i === 0 || e > etas[i - 1]), etas.join(' '));
check('la tabla muestra la hora estimada', (await p.textContent('#tbody')).includes('~' + etas[0] + ' (estimada)'));
await p.fill('#horaSalida', '14:00'); await p.dispatchEvent('#horaSalida', 'change'); await p.waitForTimeout(900);
st = await rowsOf(p, 'hojasDeRuta', '2026-09-24');
check('cambiar la salida recalcula las horas', st.rows.find(r => r.id === 'B').eta >= '14:00' && st.horaSalida === '14:00', st.rows.find(r => r.id === 'B').eta);
await p.click('#btnOptimizar'); await p.waitForSelector('.app-dialog button');
await p.click('.app-dialog button:first-child'); await p.waitForTimeout(900);
st = await rowsOf(p, 'hojasDeRuta', '2026-09-24');
check('Deshacer vuelve al orden anterior', st.rows.map(r => r.id).join('') === 'EBCDAX' , st.rows.map(r => r.id).join(''));
{
  const q = await open(b, { setup });
  await q.waitForTimeout(400);
  await q.click('#btnOptimizar'); await q.waitForSelector('.app-dialog button');
  await q.click('.app-dialog button:first-child'); await q.waitForTimeout(900);
  const s2 = await rowsOf(q, 'hojasDeRuta', '2026-09-24');
  check('Deshacer (primera vez) restaura el orden original', s2.rows.map(r => r.id).join('') === 'ABXECD' && !s2.rows.some(r => r.eta), s2.rows.map(r => r.id).join(''));
}
sinErrores(p);
await b.close();
