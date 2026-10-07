# Ruteka — Despachos

**Ruteka** («todas tus rutas, en un solo lugar») es la página web para coordinar los despachos del día con el transportista: carga de la ruta desde Excel, mapa, registro de entregas con foto y firma, liquidación con el visto bueno del transportista, e historial y reportes por período.

Se publica sola con GitHub Pages en **https://operaciones-kennedy.github.io**. Cada cambio que se une a `main` queda en línea en uno o dos minutos.

## Qué hace

| Sección | Para qué sirve |
|---|---|
| **Ruta del día** (barra superior) | Cada día tiene su propia ruta. Se cambia de día con ◀ ▶, «Hoy» o la lista de rutas guardadas. |
| **Despachos** | Lista del día, importar/exportar Excel (con las fotos de respaldo y la hora de entrega), mapa, **🧭 Optimizar ruta** con horas estimadas y **💬 WhatsApp** al cliente. |
| **Entregas** | Lo que usa el transportista: cómo llegar (Google Maps/Waze), llamar, avisar por WhatsApp, y registrar la entrega con foto y firma. Funciona sin señal: la foto se sube sola al volver la conexión. |
| **Reportes → KPIs del día** | Estados, comunas y tarifas de la ruta abierta. |
| **Entregas → 🧾 Guía de despacho** | Respaldo imprimible (o PDF) de la ruta del día para el transportista: N° de guía, fecha, transportista, patente, punto de partida y cada despacho con productos, estado y espacio para «Recibí conforme», más firmas de entrega y recepción. «Una por cliente» saca, por cada destinatario, la **copia cliente** y la **copia transportista** (respaldo del traslado, con «Recepción conforme»: nombre de quien recibe, RUT, fecha, hora y firma), además de quién recibió y su firma si ya se entregó. Cada despacho en Entregas también tiene su botón «🧾 Guía» para sacar solo la de ese cliente. Sin montos. Es un documento interno: no reemplaza la guía de despacho electrónica del SII. |
| **Seguimiento** | Para la agencia (y los administradores): cada envío de la ruta en vivo, con su estado, la hora de cada paso (salió a ruta, entregado o no entregado y quién lo registró), quién recibió, foto, firma, hora estimada de llegada y la ubicación del camión en el mapa. Cada envío entregado tiene **📄 Comprobante de entrega** (N° CE-AAAAMMDD-NN): prueba de entrega imprimible o en PDF con destinatario, productos, quién recibió, hora, quién lo registró, trazabilidad, foto y firma, sin montos. «📄 Comprobantes de entrega» saca los de todos los entregados del día o del rango. |
| **Solicitudes** | La agencia pide rutas: quién solicita (nombre, empresa y teléfono, que quedan recordados en ese dispositivo), fecha de despacho, los despachos (cliente, dirección, comuna, contacto, productos) y observaciones. La operación tiene tres opciones: **aprobar** (los despachos pasan a la ruta de ese día, con «Solicitado por la agencia» y «Programado» en la trazabilidad), **proponer otra fecha** con un comentario, o **rechazar** con un motivo. Si le proponen otra fecha, la agencia la **acepta** (se programa sola), **propone otra** o **cancela**. Así siguen hasta ponerse de acuerdo, y cada paso queda en la conversación de la tarjeta. El menú muestra un contador: a la operación, lo que tiene por aprobar; a la agencia, las fechas que le propusieron. La operación también puede aprobar desde **Entregas** («📥 Solicitudes por aprobar»). Se guardan por mes en `hojasDeRuta/sol_AAAA-MM`. |
| **Reportes → Historial de entregas** | Cada entrega del período con hora, quién recibió (o el motivo si no se entregó), quién la registró, foto y firma; filtro, buscador y exportar a Excel. |
| **Reportes → Historial y reportes del período** | Cumplimiento, gasto en fletes, gráficos por día/mes, comuna y transportista, y buscador de clientes con su foto de entrega. |
| **Gestión de flotas → Liquidación del día / del período** | Pagos, facturas, visto bueno del transportista (Conforme / Observar) y comprobante en PDF. |

**Roles.** Solo los correos de `ADMINISTRADORES_SHA256` (al inicio del `<script>` de `index.html`, guardados como SHA-256 del correo en minúsculas) ven todo. Cualquier otro usuario entra en *vista transportista*: solo Entregas, sin montos. En la página Usuarios, cada correo tiene cuatro casillas (guardadas en `config/app` y `hojasDeRuta/principal`): «Ve la liquidación» (`conLiquidacion`: liquidación del día y visto bueno, sin marcar pagos ni facturas), «Ve el historial» (`conHistorial`: Historial de entregas, sin montos), «Ve el seguimiento» (`conSeguimiento`: Seguimiento en vivo, sin montos) y «Ve las solicitudes» (`conSolicitudes`: pide rutas en Solicitudes, como la agencia; no aprueba). Es una restricción de pantalla: las tarifas viajan en el mismo documento de la ruta. Para sumar un administrador: `printf '%s' 'correo@dominio.cl' | sha256sum` y agregar el resultado a la lista. Además, agregar el correo en `esAdmin()` de las reglas de Firestore en la consola de Firebase (el archivo `firebase/firestore.rules` no guarda correos porque el repositorio es público).

**Departamento.** Dato interno del administrador para clasificar de qué departamento es el gasto de cada despacho: columna en la Ruta del día (también se importa y exporta en Excel, con encabezados como «Departamento», «Depto», «Área» o «Unidad»). KPIs del día e Historial y reportes tienen el gráfico «Gasto por departamento», y la Liquidación del período suma el gasto por departamento (resumen, filtro, columna y Excel «gasto-por-departamento»). No aparece en guías de despacho, comprobantes, Entregas, Seguimiento, Solicitudes ni Historial de entregas.

**Saldo PO.** En Pagos, la sección «Saldo PO» (solo administradores) registra cada orden de compra (N°, proveedor, monto, fecha y descripción; se guardan en `hojasDeRuta/po_indice`). Cada despacho se asigna a su PO en la columna «PO» de la Ruta del día (o con una columna «PO» / «Orden de compra» en el Excel). Para cada PO muestra lo usado (tarifas de sus despachos), lo facturado (despachos con N° de factura del proveedor), lo que falta facturar y el saldo disponible, y avisa si se excedió. El botón «📄 Saldo PO» arma el documento para imprimir o guardar en PDF, con los despachos y las facturas con mención a la PO; también se exporta a Excel. Una PO cerrada ya no se ofrece para despachos nuevos.

**Día o rango.** En la Ruta del día, Seguimiento, Entregas, KPIs del día y Liquidación del día, el selector «Día / Rango» de la barra de arriba permite ver varios días juntos (Desde / Hasta, o «Esta semana», «Este mes», «Mes pasado»). En Liquidación por rango se puede marcar pagado, anotar factura y dar el visto bueno: cada cambio se guarda en la ruta de su día. Entregas por rango es solo para revisar. La Ruta del día por rango muestra todos los despachos del período en una tabla (búsqueda, filtro por estado, total de tarifas y Excel «rutas-…»); para agregar o editar, el enlace de la fecha abre ese día.

**Agencia.** En **Ajustes → Usuarios → Agencia** se anotan los correos de la agencia (campo `agencias` de `config/app` y `hojasDeRuta/principal`). Entran en *vista agencia*: Seguimiento, Solicitudes e Historial de entregas, sin montos ni edición de rutas.

**Ubicación del camión.** En Entregas, el transportista toca «Compartir mi ubicación». Mientras Ruteka está abierta en pantalla, la posición se envía cada 30 segundos a `hojasDeRuta/gps_AAAA-MM-DD`. Una página web no puede enviar la ubicación con el teléfono bloqueado o con otra app abierta: en ese caso la agencia ve «última ubicación conocida · hace X min».

**Chat en línea.** El botón 💬 abajo a la derecha abre un chat entre la operación y cada usuario (transportistas y agencia). Los usuarios conversan con «Operación»; los administradores ven todas las conversaciones, con los mensajes sin leer, y pueden escribirle a cualquiera de la lista («Escribir a…»). Se actualiza en vivo y muestra el número de mensajes sin leer en el botón y en la pestaña del navegador. Cada conversación se guarda en `hojasDeRuta/chat_<correo>` (últimos 500 mensajes) y el resumen en `hojasDeRuta/chat_indice`. Igual que el resto de `hojasDeRuta`, cualquier usuario con sesión podría leerlos desde la consola: no es para datos sensibles.

**App instalable.** En el teléfono, abrir la página y usar «Agregar a la pantalla de inicio» (o el botón 📲 del menú en Android/Chrome).

## Cómo se guardan los datos (Firebase)

Proyecto Firebase propio: `ruteka-f1c53`. Hasta octubre de 2026 Ruteka usaba el proyecto `tablero-de-trabajos`, compartido con el panel de demandas; los datos se copiaron con `traspaso.html` y las fotos antiguas siguen guardadas allí (sus enlaces funcionan igual).

| Dónde | Qué |
|---|---|
| `hojasDeRuta/AAAA-MM-DD` | La ruta de ese día. Campo `json` con toda la hoja: título, punto de partida, transportista y despachos. |
| `hojasDeRuta/principal` | La hoja única que se usaba antes. La primera vez que alguien entra se copia sola a su fecha, y queda marcada con `migradoA`. No se borra. |
| `hojasResumen/AAAA-MM-DD` | Resumen de cada ruta (cantidad, entregados, total). Se usa para la lista de rutas y el historial. |
| `config/app` | `transportistas`: lista de correos con vista transportista. |
| Storage `hojasDeRuta/<día>/<despacho>/…` | Fotos de entrega, firmas y facturas. |

Al guardar, la página no reemplaza la lista completa. Envía solo lo que cambió en ese dispositivo y lo combina con lo que hay en línea (en una transacción). Así dos personas pueden trabajar a la vez sin pisarse.

### Reglas de seguridad

En `firebase/` están las reglas recomendadas:

- `firebase/firestore.rules` → consola de Firebase → **Firestore Database → Reglas**
- `firebase/storage.rules` → consola de Firebase → **Storage → Reglas**

En `firestore.rules`, reemplaza `correo-admin@ejemplo.cl` por los correos de administrador antes de publicar (el repositorio es público y no los guarda).

## Pruebas automáticas

`tests/` contiene pruebas que abren la página en Chrome con un Firebase simulado y revisan:

- la migración a una ruta por día y el guardado combinado;
- la importación de Excel con fotos (en celda, flotantes, desde internet y WPS);
- los duplicados y el visto bueno;
- el historial y la liquidación del período;
- la vista del transportista y el modo sin señal;
- WhatsApp y la ruta optimizada;
- la app instalable;
- que ninguna vista se salga de la pantalla en celular.

Corren solas en GitHub (pestaña **Actions → Pruebas**) en cada pull request. Para correrlas en un computador:

```bash
cd tests
npm install
npx playwright install chromium   # solo la primera vez
npm test
```

## Marca

- **Nombre y lema:** bloque `MARCA` al inicio del `<script>` de `index.html`.
- **Colores y letras:** bloque «MARCA — RUTEKA» al inicio del `<style>` (`--marca-tinta`, `--marca-principal`, `--marca-acento`, `--marca-fondo`, `--marca-letra-titulos`, `--marca-letra-texto`). Todas las pantallas toman los colores de ahí.
- **Ícono de la app:** `icons/ruteka-*.png`, `icons/ruteka.svg` y `favicon.ico` (y `manifest.json`). Si cambias el ícono, cámbiale también el nombre al archivo para que los teléfonos lo vuelvan a descargar.
