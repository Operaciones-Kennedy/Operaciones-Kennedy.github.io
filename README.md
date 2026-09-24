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
| **Reportes → Historial y reportes del período** | Cumplimiento, gasto en fletes, gráficos por día/mes, comuna y transportista, y buscador de clientes con su foto de entrega. |
| **Gestión de flotas → Liquidación del día / del período** | Pagos, facturas, visto bueno del transportista (Conforme / Observar) y comprobante en PDF. |

**Roles.** Los correos anotados como transportista (campo «Correo del transportista» en Liquidación del día) entran en *vista transportista*: solo ven Entregas y la liquidación, y no pueden marcar pagos ni facturas.

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
- **Ícono de la app:** `icons/` (y `manifest.json`).
