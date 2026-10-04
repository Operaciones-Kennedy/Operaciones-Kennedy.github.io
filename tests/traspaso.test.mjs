// traspaso.html: copia los datos de Ruteka del proyecto compartido al proyecto propio.
import path from 'path';
import { launch, check, RAIZ } from './harness.mjs';

// Firebase simulado con dos proyectos (initializeApp con nombre), cada uno con sus usuarios y datos.
const fake = `(() => {
  const P = window.__dosProyectos;
  const apps = {};
  function proyecto(cfg){
    const datos = P[cfg.projectId];
    let user = null;
    const negar = () => Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    const db = {
      collection: col => ({
        get: async () => {
          if(!user) return negar();
          const docs = Object.keys(datos.docs).filter(k => k.startsWith(col + '/')).map(k => ({ id: k.slice(col.length + 1), data: () => JSON.parse(JSON.stringify(datos.docs[k])) }));
          return { docs };
        },
        doc: id => ({
          get: async () => { if(!user) return negar(); const d = datos.docs[col + '/' + id]; return { exists: !!d, data: () => d }; },
          set: async data => {
            if(!user) return negar();
            if((datos.soloLectura || []).includes(col)) return negar();
            datos.docs[col + '/' + id] = JSON.parse(JSON.stringify(data));
          }
        })
      })
    };
    const auth = {
      signInWithEmailAndPassword: async (email, clave) => {
        if(datos.usuarios[email] === undefined) throw Object.assign(new Error('no'), { code: 'auth/user-not-found' });
        if(datos.usuarios[email] !== clave) throw Object.assign(new Error('no'), { code: 'auth/invalid-credential' });
        user = { email };
      }
    };
    return { auth: () => auth, firestore: () => db };
  }
  window.firebase = { initializeApp(cfg, nombre){ return apps[nombre] = proyecto(cfg); } };
})();`;

const b = await launch();
async function abrir(soloLectura){
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route(/gstatic/, r => r.fulfill({ contentType: 'application/javascript', body: r.request().url().includes('app-compat') ? fake : '' }));
  await p.route(/fonts\./, r => r.abort());
  await p.addInitScript(sl => {
    window.__dosProyectos = {
      'tablero-de-trabajos': { usuarios: { 'jefe@prueba.cl': 'vieja' }, docs: {
        'hojasDeRuta/2026-10-01': { json: '{"rows":[]}' },
        'hojasDeRuta/sol_2026-10': { json: '{"solicitudes":[]}' },
        'hojasDeRuta/chat_trs@fletes.cl': { json: '{"mensajes":[]}' },
        'hojasResumen/2026-10-01': { fecha: '2026-10-01', despachos: 3 },
        'config/app': { transportistas: ['trs@fletes.cl'], agencias: ['ops@agencia.cl'] },
        'tableros/demandas': { del: 'otro panel' }
      } },
      'ruteka-f1c53': { usuarios: { 'jefe@prueba.cl': 'nueva' }, docs: {}, soloLectura: sl }
    };
  }, soloLectura || []);
  await p.goto('file://' + path.join(RAIZ, 'traspaso.html'));
  return p;
}

console.log('Traspaso al proyecto nuevo');
{
  const p = await abrir();
  await p.fill('#correo', 'Jefe@Prueba.cl'); await p.fill('#claveAnterior', 'vieja'); await p.fill('#claveNueva', 'mala');
  await p.click('#revisar'); await p.waitForTimeout(150);
  check('con la clave mala del nuevo, lo dice', (await p.textContent('#msg1')).includes('proyecto nuevo') && await p.$eval('#paso2', e => e.hidden));
  await p.fill('#claveNueva', 'nueva');
  await p.click('#revisar'); await p.waitForTimeout(200);
  const filas = await p.$$eval('#tabla tr', trs => trs.map(t => t.textContent));
  check('muestra qué se va a copiar', filas.join('|') === 'hojasDeRuta30|hojasResumen10|config/app10', filas.join('|'));
  await p.click('#copiar'); await p.waitForTimeout(300);
  const nuevo = await p.evaluate(() => window.__dosProyectos['ruteka-f1c53'].docs);
  check('copia rutas, solicitudes, chat, resúmenes y configuración', Object.keys(nuevo).sort().join(',') === 'config/app,hojasDeRuta/2026-10-01,hojasDeRuta/chat_trs@fletes.cl,hojasDeRuta/sol_2026-10,hojasResumen/2026-10-01' && nuevo['config/app'].agencias[0] === 'ops@agencia.cl', Object.keys(nuevo).join(','));
  check('no copia lo del otro panel', !nuevo['tableros/demandas']);
  check('no toca el proyecto anterior', Object.keys(await p.evaluate(() => window.__dosProyectos['tablero-de-trabajos'].docs)).length === 6);
  check('termina con el resumen', !(await p.$eval('#paso3', e => e.hidden)) && (await p.textContent('#resumen')).includes('5 documentos'));
  check('la tabla se actualiza', (await p.$$eval('#tabla tr', trs => trs.map(t => t.textContent))).join('|') === 'hojasDeRuta33|hojasResumen11|config/app11');
  check('no se sale de la pantalla', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  if(process.env.CAPTURA) await p.screenshot({ path: process.env.CAPTURA, fullPage: true });
  check('sin errores de JavaScript', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

console.log('Si el proyecto nuevo bloquea una parte');
{
  const p = await abrir(['config']);
  await p.fill('#correo', 'jefe@prueba.cl'); await p.fill('#claveAnterior', 'vieja'); await p.fill('#claveNueva', 'nueva');
  await p.click('#revisar'); await p.waitForTimeout(200);
  await p.click('#copiar'); await p.waitForTimeout(300);
  check('avisa cuántos faltaron y por qué', (await p.textContent('#msg2')).includes('4 de 5') && (await p.textContent('#log')).includes('esAdmin()') && await p.$eval('#paso3', e => e.hidden));
  check('sin errores de JavaScript', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}
await b.close();
