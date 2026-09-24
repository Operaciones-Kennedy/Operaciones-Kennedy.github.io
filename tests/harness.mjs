// Utilidades de las pruebas: abre la página en Chromium con un Firebase simulado
// (tests/fake-firestore.js) y sin internet para mapas ni geolocalización.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(DIR, '..');
export const FIX = path.join(DIR, 'fixtures');
export const PAGE = path.join(RAIZ, 'index.html');
const require = createRequire(import.meta.url);
const lib = fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'), 'utf8');
const fake = fs.readFileSync(path.join(DIR, 'fake-firestore.js'), 'utf8');

export async function launch(){ return chromium.launch(); }

// setup: código (función o texto) que corre en la página antes que todo:
// define window.__fakeParams = { email, seed: [['coleccion/id', datos], …] } y localStorage.
export async function open(browser, { setup, width = 1280, height = 900 } = {}){
  const ctx = await browser.newContext({ viewport: { width, height } });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if(m.type() === 'error' && !/ERR_FAILED|ERR_NAME|Failed to load resource/.test(m.text())) p.errors.push('console: ' + m.text()); });
  p.on('dialog', d => { p.errors.push('DIÁLOGO NATIVO: ' + d.message()); d.accept(); });
  await p.route(/gstatic/, r => r.fulfill({ contentType: 'application/javascript', body: r.request().url().includes('app-compat') ? fake : '' }));
  await p.route(/cdnjs.*xlsx/, r => r.fulfill({ contentType: 'application/javascript', body: lib }));
  await p.route(/maps\.googleapis|nominatim|openstreetmap/, r => r.abort());
  if(setup) await p.addInitScript(setup);
  await p.goto('file://' + PAGE);
  await p.waitForTimeout(400);
  return p;
}

export const rowsOf = (p, coll, id) => p.evaluate(([c, i]) => window.__fs.json(c, i), [coll, id]);

export function check(name, cond, extra = ''){
  console.log((cond ? '  ✔ ' : '  ✘ ') + name + (extra && !cond ? ' — ' + extra : ''));
  if(!cond) process.exitCode = 1;
}
export function sinErrores(p){
  check('sin errores de JavaScript', !p.errors.length, p.errors.join(' | '));
}
