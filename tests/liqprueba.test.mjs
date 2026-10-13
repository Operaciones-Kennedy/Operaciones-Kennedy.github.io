// Liquidación: columna con la foto de referencia de la entrega (también en el PDF); la firma no va.
import { launch, open, check, sinErrores } from './harness.mjs';
const b = await launch();
const DIA = '2026-10-13';
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const rows = [
  { id: 'a', cliente: 'Céline Schumann', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', estado: 'entregado', tarifa: 8000, entrega: { recibidoPor: 'Ana Pérez', fotoUrl: GIF, firmaUrl: GIF, horaEntrega: '15:55' } },
  { id: 'b', cliente: 'Gino Costa', direccion: 'Mar Jónico 8020', comuna: 'Vitacura', estado: 'no-entregado', tarifa: 8000, entrega: { motivo: 'Cerrado' } },
  { id: 'c', cliente: 'Sabrina Mulligan', direccion: 'San Carlos de Apoquindo 936', comuna: 'Las Condes', estado: 'pendiente', tarifa: 8000 }
];
const p = await open(b, { setup: `(() => { localStorage.setItem('hojaDeRuta_actual', '${DIA}'); window.__fakeParams = { email: 'jefe@prueba.cl', admins: ['jefe@prueba.cl'], seed: [['hojasDeRuta/${DIA}', { json: JSON.stringify({ titulo: 't', fecha: '${DIA}', transportista: 'Transportes Barrientos', rows: ${JSON.stringify(rows)} }) }]] }; })()`, width: 1600 });
await p.waitForTimeout(700);
await p.click('.side-item[data-view="liquidaciones"]'); await p.waitForTimeout(300);
console.log('Columna «Prueba de entrega» en la Liquidación del día');
check('tiene la columna', (await p.$$eval('#tablaLiq thead th', t => t.map(x => x.textContent.trim()))).includes('Prueba de entrega'));
check('muestra solo la foto (sin firma), con enlace', (await p.$$('#tbodyLiq tr:nth-child(1) .liq-prueba a img')).length === 1 && (await p.textContent('#tbodyLiq tr:nth-child(1) .liq-prueba')).includes('Recibió: Ana Pérez'));
check('el no entregado muestra el motivo', (await p.textContent('#tbodyLiq tr:nth-child(2) .liq-prueba')) === 'Motivo: Cerrado');
check('sin entrega queda «—»', (await p.textContent('#tbodyLiq tr:nth-child(3) .liq-prueba')) === '—');
if(process.env.CAPTURA){ await (await p.$('#viewLiquidaciones .table-card')).screenshot({ path: process.env.CAPTURA }); }
const [pdf] = await Promise.all([p.waitForEvent('popup'), p.click('#btnImprimirLiq')]);
await pdf.waitForLoadState();
check('el PDF incluye las fotos', (await pdf.$$eval('thead th', t => t.map(x => x.textContent))).includes('Prueba de entrega') && (await pdf.$$('td.prueba img')).length === 1 && (await pdf.textContent('tbody')).includes('Recibió: Ana Pérez'));
await pdf.close();
sinErrores(p);
await b.close();
