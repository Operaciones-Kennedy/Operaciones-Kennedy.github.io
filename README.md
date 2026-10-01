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
| **Seguimiento** | Para la agencia (y los administradores): cada envío de la ruta en vivo, con su estado, la hora de cada paso (salió a ruta, entregado o no entregado y quién lo registró), quién recibió, foto, firma, hora estimada de llegada y la ubicación del camión en el mapa. |
| **Solicitudes** | La agencia pide rutas: fecha de despacho, los despachos (cliente, dirección, comuna, contacto, productos) y observaciones. La operación las ve con un contador en el menú y las **programa** en la ruta de un día (los despachos pasan a esa ruta, con «Solicitado por la agencia» y «Programado» en la trazabilidad) o las **rechaza** con un motivo. Se guardan por mes en `hojasDeRuta/sol_AAAA-MM`. |
| **Reportes → Historial de entregas** | Cada entrega del período con hora, quién recibió (o el motivo si no se entregó), quién la registró, foto y firma; filtro, buscador y exportar a Excel. |
| **Reportes → Historial y reportes del período** | Cumplimiento, gasto en fletes, gráficos por día/mes, comuna y transportista, y buscador de clientes con su foto de entrega. |
| **Gestión de flotas → Liquidación del día / del período** | Pagos, facturas, visto bueno del transportista (Conforme / Observar) y comprobante en PDF. |

**Roles.** Solo los correos de `ADMINISTRADORES_SHA256` (al inicio del `<script>` de `index.html`, guardados como SHA-256 del correo en minúsculas) ven todo. Cualquier otro usuario entra en *vista transportista*: solo Entregas, sin montos. En la página Transportistas, cada correo tiene dos casillas (guardadas en `config/app` y `hojasDeRuta/principal`): «Ve la liquidación» (`conLiquidacion`: liquidación del día y visto bueno, sin marcar pagos ni facturas) y «Ve el historial» (`conHistorial`: Historial de entregas, sin montos). Es una restricción de pantalla: las tarifas viajan en el mismo documento de la ruta. Para sumar un administrador: `printf '%s' 'correo@dominio.cl' | sha256sum` y agregar el resultado a la lista. Además, agregar el correo en `esAdmin()` de las reglas de Firestore en la consola de Firebase (el archivo `firebase/firestore.rules` no guarda correos porque el repositorio es público).

**Día o rango.** En Seguimiento, Entregas, KPIs del día y Liquidación del día, el selector «Día / Rango» de la barra de arriba permite ver varios días juntos (Desde / Hasta, o «Esta semana», «Este mes», «Mes pasado»). En Liquidación por rango se puede marcar pagado, anotar factura y dar el visto bueno: cada cambio se guarda en la ruta de su día. Entregas por rango es solo para revisar.

**Agencia.** En **Ajustes → Usuarios → Agencia** se anotan los correos de la agencia (campo `agencias` de `config/app` y `hojasDeRuta/principal`). Entran en *vista agencia*: Seguimiento, Solicitudes e Historial de entregas, sin montos ni edición de rutas.

**Ubicación del camión.** En Entregas, el transportista toca «Compartir mi ubicación». Mientras Ruteka está abierta en pantalla, la posición se envía cada 30 segundos a `hojasDeRuta/gps_AAAA-MM-DD`. Una página web no puede enviar la ubicación con el teléfono bloqueado o con otra app abierta: en ese caso la agencia ve «última ubicación conocida · hace X min».

**App instalable.** En el teléfono, abrir la página y usar «Agregar a la pantalla de inicio» (o el botón 📲 del menú en Android/Chrome).

## Cómo se guardan los datos (Firebase)

Proyecto Firebase `tablero-de-trabajos`, compartido con el Panel de Operaciones.

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

⚠️ Antes de publicarlas, compáralas con las reglas actuales. El mismo proyecto lo usa el Panel de Operaciones, y hay que conservar las reglas de sus colecciones.

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
