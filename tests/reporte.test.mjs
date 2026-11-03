// Reporte de gestión: KPI, agencias (desde las solicitudes), comunas, calidad y detalle con foto. Sin montos.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const ok = (id, cliente, comuna, extra) => Object.assign({ id, cliente, direccion: 'Calle ' + id, comuna, estado: 'entregado', tarifa: 8000, entrega: { fotoUrl: GIF, horaEntrega: '15:20', recibidoPor: 'Ana' } }, extra || {});
const d1 = [
  ok('a1', 'Teatro Municipal', 'Santiago', { solicitudId: 's1' }),
  ok('a2', 'Radio Infinita', 'Ñuñoa', { solicitudId: 's1' }),
  ok('a3', 'Café Rojo', 'Las Condes', { solicitudId: 's2', eventos: [{ tipo: 'no-entregado', at: '2026-10-05T15:00:00Z' }, { tipo: 'entregado', at: '2026-10-06T12:00:00Z' }] }),
  { id: 'a4', cliente: 'Local cerrado', direccion: 'Calle a4', comuna: 'Providencia', estado: 'no-entregado', tarifa: 8000, entrega: { motivo: 'Local cerrado' }, solicitudId: 's3' }
];
const d2 = [ok('b1', 'Showroom', 'Las Condes', { entrega: { horaEntrega: '10:05' } }), ok('b2', 'Oficina', 'las condes')];
const sols = [
  { id: 's1', creadoAt: '2026-10-01T12:00:00Z', solicitante: { nombre: 'Colomba Muñoz', empresa: 'Burson Chile' }, estado: 'programada', despachos: [] },
  { id: 's2', creadoAt: '2026-10-02T12:00:00Z', solicitante: { nombre: 'Daniela P.', empresa: 'Agencia Azerta' }, estado: 'programada', despachos: [] },
  { id: 's3', creadoAt: '2026-10-03T12:00:00Z', solicitante: { nombre: 'Javiera O.', empresa: 'ek' }, estado: 'programada', despachos: [] }
];
const seed = [
  ['hojasDeRuta/2026-10-06', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-06', transportista: 'Transportes Barrientos', rows: d1 }) }],
  ['hojasDeRuta/2026-10-14', { json: JSON.stringify({ titulo: 't', fecha: '2026-10-14', transportista: 'Transportes Barrientos', rows: d2 }) }],
  ['hojasResumen/2026-10-06', { fecha: '2026-10-06', despachos: 4 }],
  ['hojasResumen/2026-10-14', { fecha: '2026-10-14', despachos: 2 }],
  ['hojasDeRuta/sol_2026-10', { json: JSON.stringify({ solicitudes: sols }) }]
];
const p = await open(b, { setup: `(() => { localStorage.setItem('hojaDeRuta_actual', '2026-11-03'); window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: ${JSON.stringify(seed)} }; })()`, width: 1280 });
await p.waitForTimeout(700);
await p.click('.side-item[data-view="reporte"]'); await p.waitForTimeout(300);
await p.fill('#rDesdeG', '2026-10-01'); await p.dispatchEvent('#rDesdeG', 'change');
await p.fill('#rHastaG', '2026-10-31'); await p.dispatchEvent('#rHastaG', 'change'); await p.waitForTimeout(900);
console.log('Reporte de gestión con datos del período');
const kpis = await p.$$eval('.rg-kpi', ks => ks.map(k => k.textContent.replace(/\s+/g, ' ').trim()));
check('despachos y rutas', kpis[0].includes('6') && kpis[0].includes('2 ruta(s)'), kpis[0]);
check('tasa de entrega 5 de 6 cerrados', kpis[1].includes('83,3%'), kpis[1]);
check('primer intento descuenta el reintento', kpis[2].includes('66,7%') && kpis[2].includes('1 entregado(s) tras reintento'), kpis[2]);
check('foto de respaldo (una entrega sin foto)', kpis[3].includes('80,0%') && kpis[3].includes('4 de 5'), kpis[3]);
check('comunas sin duplicar por mayúsculas', kpis[4].startsWith('Comunas atendidas4'), kpis[4]);
check('agencias activas desde las solicitudes', kpis[5].startsWith('Agencias activas3') && kpis[5].includes('3 pide(n) por Ruteka'), kpis[5]);
const ags = await p.$$eval('.rg-ag', a => a.map(x => x.textContent.replace(/\s+/g, ' ')));
check('las 6 agencias aparecen, con su canal', ags.length === 6 && ags.find(a => a.startsWith('Burson2 desp.')).includes('Pide por Ruteka') && ags.find(a => a.startsWith('Burson')).includes('Colomba Muñoz') && ags.find(a => a.startsWith('Wiin')).includes('Sin actividad'), ags.join(' / '));
check('avisa los despachos sin agencia', (await p.textContent('#rgCuerpo')).includes('2 despacho(s) del período no tienen agencia'));
check('el resumen menciona la gestión con las agencias', (await p.textContent('.rg-resumen')).includes('ingresan sus solicitudes directamente en Ruteka'));
check('motivo de no entrega', (await p.textContent('#rgCuerpo')).includes('Local cerrado'));
check('detalle con foto de cada entrega', (await p.$$('.rg-env')).length === 6 && (await p.$$('.rg-env img')).length === 4);
await p.click('.rg-filtros [data-rg-ag="Burson"]'); await p.waitForTimeout(150);
check('filtrar el detalle por agencia', (await p.$$('.rg-env')).length === 2);
check('no muestra montos', !(await p.textContent('#rgCuerpo')).includes('$'));
await p.click('.rg-filtros [data-rg-ag=""]'); await p.waitForTimeout(150);
if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA, fullPage: true });
sinErrores(p);
await b.close();
