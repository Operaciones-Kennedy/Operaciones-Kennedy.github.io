import { launch, open, check, FIX, sinErrores } from './harness.mjs';
import path from 'path';
const b = await launch();
const p = await open(b, { setup: `(() => {
  localStorage.setItem('hojaDeRuta_actual', '2026-09-24');
  const rows = [
    { id: 'a', cliente: 'Céline Schumann', direccion: 'Las Hualtatas 6172', comuna: 'Vitacura', contacto: '+569 8585 9910', productos: '6x Manzana Gas', estado: 'en-ruta', tarifa: 8000, eta: '15:40' },
    { id: 'b', cliente: 'Gino Costa', direccion: 'Mar Jónico 8020', comuna: 'Vitacura', contacto: '9 9991 1866', productos: '6x Limón', estado: 'entregado', tarifa: 8000, entrega: { recibidoPor: 'Gino', horaEntrega: '16:03', fotoUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/foto.jpg?alt=media&token=abc' } },
    { id: 'c', cliente: 'IMEDIA', direccion: 'Reina Victoria 6854', comuna: 'La Reina', contacto: '—', productos: '', estado: 'no-entregado', tarifa: 25000, entrega: { motivo: 'No había nadie' } }];
  window.__fakeParams = { seed: [['hojasDeRuta/2026-09-24', { json: JSON.stringify({ titulo: 't', fecha: '2026-09-24', rows }) }]] };
})()` });
await p.waitForTimeout(500);
const hrefs = await p.$$eval('#tbody a.wsp-btn', as => as.map(a => a.href));
check('botón 💬 en la tabla solo si hay teléfono (2 de 3)', hrefs.length === 2);
const dec = h => decodeURIComponent(h.split('?text=')[1]);
check('en ruta: número con 56 y hora estimada', hrefs[0].startsWith('https://wa.me/56985859910?text=') && dec(hrefs[0]).includes('va en camino a Las Hualtatas 6172, Vitacura') && dec(hrefs[0]).includes('15:40'), dec(hrefs[0]));
check('entregado: hora, quién recibió y foto', dec(hrefs[1]).includes('fue entregado a las 16:03 y lo recibió Gino') && dec(hrefs[1]).includes('Foto de la entrega: https://firebasestorage'), dec(hrefs[1]).replace(/\n/g, ' / '));
await p.evaluate(() => document.querySelector('.side-item[data-view="chofer"]').click()); await p.waitForTimeout(200);
const btns = await p.$$eval('#viewChofer .chofer-nav a.wsp', as => as.map(a => a.textContent));
check('en Entregas: "Avisar por WhatsApp"', btns.includes('💬 Avisar por WhatsApp'), btns.join(' | '));
await p.click('.chofer-resueltos-toggle'); await p.waitForTimeout(100);
await p.click('#viewChofer .chofer-compact-row'); await p.waitForTimeout(150);
const btns2 = await p.$$eval('#viewChofer .chofer-nav a.wsp', as => as.map(a => a.textContent));
check('entregado: "Enviar comprobante"', btns2.includes('💬 Enviar comprobante'), btns2.join(' | '));
sinErrores(p);
await b.close();
