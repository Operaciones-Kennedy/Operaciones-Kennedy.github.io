# Correo diario de avisos

Cada día hábil, a las 8:00 (hora de Chile), Ruteka te manda un correo con lo que tienes que gestionar:

- los recordatorios de **Mi agenda** de hoy y los atrasados, y los de los próximos 3 días;
- las solicitudes que esperan tu respuesta;
- los despachos de la ruta de hoy (y cuántos son directo Andina);
- los pagos pendientes al transportista: monto, cuántos no tienen N° de factura y el más antiguo.

Lo envía un script de Google (Apps Script) que vive en la cuenta de Gmail que envía los avisos. Es gratis y no necesita cambiar el plan de Firebase. Tu correo y las claves **no** van en el repositorio (es público): se guardan dentro del script.

## Instalación (una vez, unos 10 minutos)

### 1. Crea el usuario con el que el script lee Ruteka

1. Entra a la [consola de Firebase](https://console.firebase.google.com/) → proyecto **ruteka-f1c53** → **Authentication** → **Usuarios** → **Agregar usuario**.
2. Correo: el de la cuenta que envía (por ejemplo `avisosruteka@gmail.com`). Contraseña: una nueva, larga, que no uses en otro lado.

Ese usuario solo lee los datos; no es administrador.

### 2. Crea el script en la cuenta que envía

1. Entra a Gmail con la cuenta que envía y abre [script.google.com](https://script.google.com/) → **Nuevo proyecto**. Ponle de nombre «Avisos Ruteka».
2. Borra lo que trae el editor y pega todo el contenido de [`correo-diario.gs`](correo-diario.gs). Guarda (ícono de disquete).
3. Ve a **Configuración del proyecto** (engranaje) → **Propiedades del script** → **Agregar propiedad** y crea estas tres:

   | Propiedad | Valor |
   |---|---|
   | `PARA` | el correo que recibe los avisos |
   | `RUTEKA_EMAIL` | el usuario del paso 1 |
   | `RUTEKA_CLAVE` | su contraseña |

### 3. Prueba y deja programado

1. Vuelve al editor, elige la función **`probarAhora`** en la barra de arriba y toca **Ejecutar**. La primera vez Google pide permisos («Revisar permisos» → elige la cuenta → «Configuración avanzada» → «Ir a Avisos Ruteka» → **Permitir**).
2. Revisa que llegó el correo. Si cae en **Spam** o **Correo no deseado**, márcalo como «No es spam» y agrega la cuenta que envía a tus contactos.
3. Elige la función **`instalarAvisoDiario`** y toca **Ejecutar**. Desde ahí el correo llega solo cada día hábil a las 8:00.

Para cambiar la hora, edita `HORA_AVISO` al inicio del script y vuelve a ejecutar `instalarAvisoDiario`.

## Si algo falla

- En el editor, **Ejecuciones** (ícono de lista) muestra cada envío y el error si lo hubo.
- «No se pudo entrar a Ruteka»: revisa `RUTEKA_EMAIL` y `RUTEKA_CLAVE`, y que el usuario exista en Authentication.
- «Error al leer…» con «PERMISSION_DENIED»: el usuario no tiene correo o las reglas de Firestore no le permiten leer; revisa que esté creado con correo y contraseña.
