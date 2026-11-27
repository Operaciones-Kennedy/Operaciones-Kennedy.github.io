/**
 * Ruteka · correo diario de avisos (Google Apps Script).
 *
 * Se instala en la cuenta de Gmail que envía los avisos (por ejemplo avisosruteka@gmail.com)
 * y cada día hábil, a la hora que elijas, manda un resumen con lo que hay que gestionar:
 * recordatorios de «Mi agenda», solicitudes por responder, despachos del día y pagos
 * pendientes al transportista.
 *
 * Los datos privados NO van en este archivo (el repositorio es público). Se guardan en
 * Configuración del proyecto → Propiedades del script:
 *   PARA          correo que recibe los avisos
 *   RUTEKA_EMAIL  usuario de Ruteka con el que el script lee los datos
 *   RUTEKA_CLAVE  su contraseña
 * Instrucciones completas: avisos/README.md
 */

const PROYECTO = 'ruteka-f1c53';
const API_KEY = 'AIzaSyBMzlvZlBg1FZZzx3n-GRVFm9gB6iIN1Y8'; // clave web pública de Ruteka (la misma de index.html)
const URL_RUTEKA = 'https://operaciones-kennedy.github.io';
const ZONA = 'America/Santiago';
const HORA_AVISO = 8;            // hora del correo (0–23), en hora de Chile
const DIAS_PAGOS = 180;          // cuántos días hacia atrás se revisan los pagos pendientes
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO + '/databases/(default)/documents/';

/** Ejecútala una vez para programar el correo diario. */
function instalarAvisoDiario() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'enviarAvisosDelDia')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('enviarAvisosDelDia').timeBased().everyDays(1).atHour(HORA_AVISO).inTimezone(ZONA).create();
  Logger.log('Listo: el aviso se enviará cada día hábil cerca de las ' + HORA_AVISO + ':00.');
}

/** Ejecútala para mandar un correo de prueba ahora mismo (aunque sea fin de semana). */
function probarAhora() { enviarAvisosDelDia(true); }

function enviarAvisosDelDia(forzar) {
  const props = PropertiesService.getScriptProperties();
  const para = props.getProperty('PARA');
  if (!para) throw new Error('Falta la propiedad PARA (correo que recibe los avisos).');
  const ahora = new Date();
  const diaSemana = Number(Utilities.formatDate(ahora, ZONA, 'u')); // 1 = lunes … 7 = domingo
  if (!forzar && diaSemana > 5) return;
  const hoy = Utilities.formatDate(ahora, ZONA, 'yyyy-MM-dd');
  const token = iniciarSesion(props.getProperty('RUTEKA_EMAIL'), props.getProperty('RUTEKA_CLAVE'));

  // 1) Recordatorios de Mi agenda: los de hoy y los atrasados que no están hechos.
  const agenda = (jsonDe(leer('hojasDeRuta/agenda', token)) || {}).items || [];
  const recordatorios = agenda.filter(x => !x.hecho && x.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const proximos = agenda.filter(x => !x.hecho && x.fecha > hoy && x.fecha <= sumarDias(hoy, 3));

  // 2) Solicitudes por responder (este mes y el anterior).
  const meses = [hoy.slice(0, 7), Utilities.formatDate(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1), ZONA, 'yyyy-MM')];
  const sols = [].concat(...meses.map(m => ((jsonDe(leer('hojasDeRuta/sol_' + m, token)) || {}).solicitudes || [])));
  const porResponder = sols.filter(s => s.estado === 'pendiente');

  // 3) Despachos de hoy.
  const ruta = jsonDe(leer('hojasDeRuta/' + hoy, token));
  const despHoy = ((ruta && ruta.rows) || []).filter(r => r.cliente || r.direccion);
  const andinaHoy = despHoy.filter(r => r.envio === 'andina').length;

  // 4) Pagos pendientes al transportista (sin los envíos directos de Andina, que no tienen costo).
  const pagos = pagosPendientes(token, hoy);

  const n = recordatorios.length + porResponder.length;
  const asunto = 'Ruteka · ' + fechaCorta(hoy) + ': ' + (n ? n + ' cosa(s) por gestionar' : 'todo al día');
  const html = armarCorreo({ hoy, recordatorios, proximos, porResponder, despHoy, andinaHoy, pagos, n });
  MailApp.sendEmail({ to: para, subject: asunto, htmlBody: html, name: 'Avisos Ruteka' });
}

function pagosPendientes(token, hoy) {
  const desde = sumarDias(hoy, -DIAS_PAGOS);
  const fechas = [];
  let pagina = '';
  do {
    const r = leer('hojasResumen?pageSize=300' + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''), token);
    ((r && r.documents) || []).forEach(d => {
      const f = valor(d.fields && d.fields.fecha);
      const n = Number(valor(d.fields && d.fields.despachos) || 0);
      if (/^\d{4}-\d{2}-\d{2}$/.test(f || '') && f >= desde && f <= hoy && n) fechas.push(f);
    });
    pagina = r && r.nextPageToken;
  } while (pagina);
  let total = 0, despachos = 0, sinFactura = 0, masAntiguo = '';
  for (let i = 0; i < fechas.length; i += 100) {
    const nombres = fechas.slice(i, i + 100).map(f => 'projects/' + PROYECTO + '/databases/(default)/documents/hojasDeRuta/' + f);
    const resp = pedir(BASE.replace(/documents\/$/, 'documents:batchGet'), token, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ documents: nombres }) });
    resp.filter(x => x.found).forEach(x => {
      const st = jsonDe(x.found) || {};
      const fecha = x.found.name.split('/').pop();
      (st.rows || []).forEach(r => {
        const tarifa = Number(r.tarifa) || 0;
        if (r.envio === 'andina' || !tarifa || r.pagado || !(r.cliente || r.direccion)) return;
        total += tarifa; despachos++;
        if (!String(r.numeroFactura || '').trim()) sinFactura++;
        if (!masAntiguo || fecha < masAntiguo) masAntiguo = fecha;
      });
    });
  }
  return { total, despachos, sinFactura, masAntiguo };
}

function armarCorreo(d) {
  const linea = t => '<p style="margin:0 0 6px;padding:8px 10px;background:#F4F7F6;border-radius:8px;font-size:14px;line-height:1.4">' + t + '</p>';
  const bloque = (titulo, color, items, vacio) => '<p style="margin:16px 0 6px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:' + color + '">' + titulo + '</p>' +
    (items.length ? items.map(linea).join('') : '<p style="margin:0;font-size:14px;color:#6B8280">' + vacio + '</p>');
  const tipos = { pedir: 'Pedir a Andina', coordinar: 'Coordinar con Andina', otro: 'Recordatorio' };
  const rec = d.recordatorios.map(x => '<b>' + esc(tipos[x.tipo] || 'Recordatorio') + '</b>' + (x.fecha < d.hoy ? ' <span style="color:#B3261E">(atrasado, ' + fechaCorta(x.fecha) + ')</span>' : '') + ' · ' + esc([x.frente, x.texto].filter(Boolean).join(' · ') || 'sin detalle') + (x.entrega ? ' · entrega ' + fechaCorta(x.entrega) : ''));
  const prox = d.proximos.map(x => fechaCorta(x.fecha) + ' · ' + esc(tipos[x.tipo] || 'Recordatorio') + ' · ' + esc(x.frente || ''));
  const sol = d.porResponder.map(s => '<b>' + esc((s.solicitante && (s.solicitante.empresa || s.solicitante.nombre)) || 'Solicitud') + '</b> pidió ' + (s.despachos || []).length + ' despacho(s) para el ' + fechaCorta(s.fecha) + (s.envio === 'andina' ? ' · directo Andina' : ''));
  const hoyTxt = d.despHoy.length ? [d.despHoy.length + ' despacho(s) en la ruta de hoy' + (d.andinaHoy ? ' · ' + d.andinaHoy + ' directo Andina (sin costo)' : '')] : [];
  const p = d.pagos;
  const pagos = p.despachos ? [p.despachos + ' despacho(s) por pagar al transportista · <b>' + dinero(p.total) + '</b>', p.sinFactura + ' sin N° de factura · el más antiguo es del ' + fechaCorta(p.masAntiguo)] : [];
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#12302E;max-width:620px">' +
    '<div style="background:#12302E;color:#F4F7F6;padding:16px 20px;border-radius:10px 10px 0 0"><p style="margin:0;font-size:20px;font-weight:bold">' +
    (d.n ? 'Buenos días. Hoy tienes ' + d.n + ' cosa(s) por gestionar.' : 'Buenos días. Hoy no hay nada atrasado.') + '</p></div>' +
    '<div style="padding:4px 20px 20px;border:1px solid #D5E2E0;border-top:none;border-radius:0 0 10px 10px">' +
    bloque('Recordatorios de hoy', '#A04F0F', rec, 'Nada pendiente en Mi agenda.') +
    (prox.length ? bloque('Próximos 3 días', '#4A615F', prox, '') : '') +
    bloque('Solicitudes por responder', '#0B7A6B', sol, 'No hay solicitudes esperando respuesta.') +
    bloque('Despachos de hoy', '#0B7A6B', hoyTxt, 'No hay ruta cargada para hoy.') +
    bloque('Pagos al transportista', '#4A615F', pagos, 'No hay pagos pendientes.') +
    '<p style="margin:20px 0 0"><a href="' + URL_RUTEKA + '" style="background:#0B7A6B;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:8px;display:inline-block">Abrir Ruteka</a></p>' +
    '</div></div>';
}

/* ---------- Acceso a Ruteka (Firebase) ---------- */
function iniciarSesion(email, clave) {
  if (!email || !clave) throw new Error('Faltan las propiedades RUTEKA_EMAIL y RUTEKA_CLAVE.');
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ email: email, password: clave, returnSecureToken: true })
  });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo entrar a Ruteka con ' + email + ': ' + r.getContentText());
  return JSON.parse(r.getContentText()).idToken;
}
function leer(ruta, token) {
  const r = UrlFetchApp.fetch(BASE + ruta, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw new Error('Error al leer ' + ruta + ': ' + r.getContentText());
  return JSON.parse(r.getContentText());
}
function pedir(url, token, opciones) {
  const r = UrlFetchApp.fetch(url, Object.assign({ headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }, opciones));
  if (r.getResponseCode() !== 200) throw new Error('Error en ' + url + ': ' + r.getContentText());
  return JSON.parse(r.getContentText());
}
function jsonDe(doc) {
  const s = doc && doc.fields && doc.fields.json && doc.fields.json.stringValue;
  return s ? JSON.parse(s) : null;
}
function valor(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  return null;
}

/* ---------- Utilidades ---------- */
function sumarDias(f, n) {
  const [y, m, d] = f.split('-').map(Number);
  return Utilities.formatDate(new Date(y, m - 1, d + n, 12), ZONA, 'yyyy-MM-dd');
}
function fechaCorta(f) { return f ? f.split('-').reverse().slice(0, 2).join('/') : '—'; }
function dinero(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function esc(t) { return String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
