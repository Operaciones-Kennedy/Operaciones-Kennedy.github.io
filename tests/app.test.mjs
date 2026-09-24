// La página se puede instalar como app y abre sin señal (service worker).
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { RAIZ, check } from './harness.mjs';
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const url = 'http://localhost:' + server.address().port + '/';
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
await p.route(/gstatic|cdnjs|googleapis|nominatim/, r => r.abort());
await p.goto(url);
const man = await p.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
check('manifest válido (standalone, íconos 192 y 512)', man.display === 'standalone' && man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512'));
await p.evaluate(() => navigator.serviceWorker.ready);
await p.reload(); await p.waitForTimeout(500);
check('service worker activo', await p.evaluate(() => !!navigator.serviceWorker.controller));
await ctx.setOffline(true);
await p.reload(); await p.waitForTimeout(500);
check('sin señal la app abre igual', (await p.title()).includes('Ruteka') && await p.isVisible('#loginScreen .login-box'));
await b.close();
server.close();
