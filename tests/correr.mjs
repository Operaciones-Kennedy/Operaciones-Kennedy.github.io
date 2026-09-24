// Corre todas las pruebas (tests/*.test.mjs) una tras otra y resume el resultado.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DIR } from './harness.mjs';
const soloEstas = process.argv.slice(2);
const archivos = fs.readdirSync(DIR).filter(f => f.endsWith('.test.mjs')).filter(f => !soloEstas.length || soloEstas.some(s => f.includes(s))).sort();
let fallas = 0;
for (const f of archivos) {
  console.log('\n▶ ' + f);
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { stdio: 'inherit' });
  if (r.status !== 0) { fallas++; console.log('  ✘ ' + f + ' falló'); }
}
console.log('\n' + (fallas ? '✘ ' + fallas + ' archivo(s) con fallas' : '✔ Todas las pruebas pasaron') + ' (' + archivos.length + ' archivos)');
process.exit(fallas ? 1 : 0);
