// Ninguna vista debe salirse del ancho de la pantalla (celular, tablet y computador).
import { launch, open, check, sinErrores } from './harness.mjs';
const VISTAS = ['despachos', 'chofer', 'reportes', 'liquidaciones', 'historial', 'liqperiodo'];
const b = await launch();
for (const w of [360, 390, 520, 768, 1440]) {
  const p = await open(b, { width: w, height: 800, setup: `(() => {
    localStorage.setItem('hojaDeRuta_actual', '2026-09-24');
    const rows = Array.from({ length: 6 }, (_, i) => ({ id: 'r' + i, cliente: 'Cliente con nombre bastante largo ' + i, direccion: 'Av. Presidente Kennedy 5757, piso -3, Las Condes', comuna: 'Las Condes', contacto: '+569 1234 567' + i, productos: '6x Manzana Gas / 6x Limón Gas 500ml', estado: ['pendiente','en-ruta','entregado','no-entregado'][i % 4], tarifa: 8000 }));
    window.__fakeParams = { seed: [['hojasDeRuta/2026-09-24', { json: JSON.stringify({ titulo: 'HOJA DE RUTA — Despachos PACS', fecha: '2026-09-24', rows }) }]] };
  })()` });
  await p.waitForTimeout(300);
  const malas = [];
  for (const v of VISTAS) {
    await p.evaluate(v => document.querySelector('.side-item[data-view="' + v + '"]').click(), v);
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth, fuera = [];
      document.querySelectorAll('#sheet *').forEach(el => {
        const bx = el.getBoundingClientRect();
        if (!bx.width || !bx.height) return;
        for (let q = el.parentElement; q && q.id !== 'sheet'; q = q.parentElement) { const o = getComputedStyle(q).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return; }
        if (bx.right > vw + 1) fuera.push(el.tagName.toLowerCase() + '.' + [...el.classList].join('.'));
      });
      return { sw: document.documentElement.scrollWidth, vw, fuera };
    });
    if (r.sw > r.vw || r.fuera.length) malas.push(v + ' (' + r.fuera.slice(0, 3).join(', ') + ')');
  }
  check(w + 'px: ninguna vista se sale de la pantalla', !malas.length, malas.join(' | '));
  sinErrores(p);
  await p.context().close();
}
await b.close();
