# @cmr/mercadopago-checkout

Cobro con **Mercado Pago (Checkout Pro)** para tiendas y reservas. Sin dependencias, Node ≥ 18, para **Express** y **Next.js**.

Sirve para dos casos:

| Caso | Qué cobra | Ejemplo |
|------|-----------|---------|
| **Pedido** | El total de una compra | Tienda online (Canito, Planeta Surf, Ferretería, Libros Mami) |
| **Reserva con lugar retenido** | Una seña, mientras el horario queda apartado unos minutos | Turnos (Canito, CMR Nexo), canchas |

## Cómo funciona (en criollo)

```
1. La clienta confirma el pedido/turno      → tu servidor lo guarda como PENDIENTE
2. Tu servidor le pide a Mercado Pago un enlace de pago (buildPreference + createPreference)
3. El navegador redirige a ese enlace        → la clienta paga en Mercado Pago
4. Mercado Pago le avisa a tu servidor       → webhook (es solo un "ping" con el id del pago)
5. Tu servidor le PREGUNTA a Mercado Pago el estado real del pago, y solo si coinciden
   referencia + moneda + monto, pasa el pedido a CONFIRMADO
```

**Regla de oro:** el navegador nunca confirma un pago. Solo confirma el servidor, después de preguntarle a Mercado Pago con el Access Token (que nunca sale del servidor).

## Cómo aplicarlo en otra app (6 pasos)

### 1. Copiá el módulo

Copiá la carpeta `mercadopago-checkout/` a tu proyecto (por ejemplo `lib/mercadopago-checkout/` o `packages/mercadopago-checkout/`). No hay nada que instalar.

### 2. Variables de entorno (en el servidor / Vercel, **nunca** en el código)

| Variable | Para qué |
|----------|----------|
| `MP_ACCESS_TOKEN` | Access Token de la aplicación de Mercado Pago (`APP_USR-...`). **Sin esta variable el cobro queda apagado.** Primero cargá la de **prueba**. |
| `PUBLIC_BASE_URL` | URL pública del sitio, ej. `https://www.mitienda.com` (recomendada). Se usa para el retorno y el aviso. |
| `MP_HOLD_MINUTES` | Opcional. Minutos que se retiene una reserva mientras se paga. Por defecto `10`. |

### 3. Agregá las columnas a tu base

Corré `sql/orders.sql` (pedidos) y/o `sql/bookings.sql` (reservas) adaptando el nombre de tu tabla.

### 4. Escribí tu "store" (la única parte que es tuya)

El módulo no conoce tu base de datos: le das dos funciones por cada cosa que se cobra.

```js
const store = {
  load: async (id) => ({ id, amount, status, paymentId }),   // o null si no existe
  save: async (id, patch) => { /* guardá patch.paymentId, patch.paymentStatus, patch.status, patch.paidAt */ },
};
```

`status` siempre es `"pending" | "confirmed" | "cancelled"`. Tu `save` traduce eso a tus columnas y a tu idioma (`"confirmado"`, `"pagado"`...).
Para reservas con lugar retenido el store tiene además `isSlotFree(booking)` y `recordIncome(booking, monto)` (ver "Reservas" abajo).

> En `server/payments.js` de Canito hay un ejemplo real con Supabase y estados en español.

### 5. Creá el enlace de pago y el aviso

Mirá un ejemplo completo y ejecutable en **`examples/express.js`** (Express) o **`examples/next-route.js`** (Next.js 14). Lo esencial:

```js
const mp = require("./mercadopago-checkout");
const client = mp.createClient({ accessToken: process.env.MP_ACCESS_TOKEN });

// (a) Al crear el pedido: pedir el enlace y devolverlo al navegador
const preference = mp.buildPreference({
  reference: mp.buildReference("order", pedido.id),            // "order:77"
  items: [{ id: 5, title: "Crema", quantity: 2, unitPrice: 15000 }],   // precios de TU base, no del navegador
  baseUrl, webhookPath: "/mp/webhook",
  backUrls: { success, failure, pending },
});
const { initPoint } = await client.createPreference(preference, { idempotencyKey: `order-${pedido.id}` });
// → res.json({ initPoint }) y en el navegador: window.location = initPoint

// (b) El aviso de Mercado Pago (Express; en Next usá adapters/next.js)
app.post("/mp/webhook", expressWebhook({
  isEnabled: mp.isEnabled,
  process: (req, paymentId) => mp.processNotification({
    client, paymentId,
    handlers: { order: (ctx) => mp.processOrderPayment({ ...ctx, store }) },
  }),
}));
```

### 6. Probá con tarjetas de prueba

Con el Access Token **de prueba**: hacé un pedido, pagá con una tarjeta de prueba de Mercado Pago (titular `APRO` para que apruebe, `OTHE` para rechazo, según su documentación de pruebas) y comprobá que el pedido pasa a confirmado. Recién después cargá el token real.

## Reservas con lugar retenido (turnos, canchas)

Se usa `processHeldBookingPayment` en lugar de `processOrderPayment`, y `buildPreference` con dos opciones extra:

```js
mp.buildPreference({ /* ... */, instantPaymentsOnly: true, expiresInMs: mp.holdMsFromEnv() });
```

- `instantPaymentsOnly` quita el pago en efectivo con cupón (Rapipago / Pago Fácil, que se acredita horas después) y activa `binary_mode`: el pago se aprueba o se rechaza en el momento, sin quedar "en proceso".
- La reserva nace **pendiente** y ocupa el horario solo durante la retención (`MP_HOLD_MINUTES`, por defecto 10).
- Pasada la retención sin pago, `isHoldExpired(reserva, { holdMs })` da `true`: **mostrala como cancelada y liberá el horario, pero NO la borres ni la modifiques** (estado derivado). Así no se pierde ningún dato.
- Si el pago llega **tarde**: si el horario sigue libre se confirma igual; si ya lo ocupó otra persona queda cancelada y `warn` avisa que hay que **devolver el pago** (la devolución se hace a mano en Mercado Pago).
- El `store` de reservas agrega `isSlotFree(booking)` (¿sigue libre el horario?) y `recordIncome(booking, montoCobrado)` (asentar el cobro, p. ej. en caja; debe ser **idempotente** porque Mercado Pago puede repetir el aviso).

## Qué protege el módulo

- El monto, la moneda (ARS) y la referencia del pago se comparan con lo que tenés en tu base **antes** de confirmar. Un pago por menos plata o de otro pedido no confirma nada.
- El mismo aviso repetido es idempotente (no duplica cobros ni cajas).
- Un intento rechazado que llega tarde no pisa un pago ya aprobado.
- Un reembolso del pago aprobado cancela el pedido.
- Un pago aprobado sobre algo ya cancelado **no lo reactiva**: avisa por `warn` para devolverlo a mano.
- Si Mercado Pago o tu base fallan, el error sube y el aviso responde 5xx: Mercado Pago **reintenta solo**.
- El token va solo en el encabezado `Authorization`, nunca en una URL ni en el cuerpo.

## Referencia rápida

| Función | Qué hace |
|---------|----------|
| `isEnabled()` | `true` si hay `MP_ACCESS_TOKEN` |
| `createClient({ accessToken })` | `.createPreference(pref, { idempotencyKey })` → `{ id, initPoint }` · `.getPayment(id)` → pago o `null` |
| `buildReference(tipo, id)` / `parseReference(ref)` | `"order:77"` ⇄ `{ kind: "order", id: 77 }` (el tipo sirve para saber qué se pagó) |
| `buildPreference({...})` | Arma el pedido de pago (valida todo antes de mandarlo) |
| `evaluatePayment({ payment, reference, expectedAmount })` | Compara el pago con lo esperado → `{ ok, outcome: "paid" \| "refunded" \| null }` |
| `processOrderPayment` / `processHeldBookingPayment` | Reglas listas para pedidos / reservas |
| `processNotification({ client, paymentId, handlers })` | Consulta el pago y lo deriva al manejador según el tipo de referencia |
| `holdMsFromEnv()` / `isHoldExpired()` | Retención de reservas |
| `resolveBaseUrl({ fixedUrl, headers })` | URL pública del sitio |
| `adapters/express` · `adapters/next` | La ruta del aviso lista para usar |

Los errores de Mercado Pago son `MercadoPagoError` con `code` (`MP_PREFERENCE` / `MP_PAYMENT`), `status` (HTTP) y `detail`.

## Tests

```
cd packages/mercadopago-checkout && npm test
```

Cubren las reglas (montos, repeticiones, pagos tardíos, reembolsos), el cliente, los adaptadores de Express y Next, y el ejemplo de Express de punta a punta con un Mercado Pago simulado.

## Lo que está verificado y lo que NO

**Verificado contra la documentación oficial de Mercado Pago:** crear preferencias (`POST /checkout/preferences`), consultar pagos (`GET /v1/payments/{id}`), `external_reference`, `expires` / `expiration_date_from` / `expiration_date_to`, `binary_mode` y `payment_methods.excluded_payment_types`.

**NO verificado todavía (probar con el primer pago de prueba real):**
- Que el pago llegue a la cuenta correcta y qué nombre de vendedor ve la clienta.
- Si Mercado Pago agrega `payment_id` / `collection_id` en la URL de vuelta (el código lo usa si viene, pero no depende de eso: el aviso también confirma).
- Qué ve la clienta si abre el enlace después de que venció.
- **Firma del aviso (`x-signature`): no está implementada.** Hoy no hace falta para la seguridad (el servidor siempre consulta el pago a Mercado Pago antes de confirmar), pero es una mejora posible.

## Dudas frecuentes

- **¿Funciona con Next.js sin configurar nada?** Sí: es CommonJS sin dependencias y el adaptador usa `Request`/`Response` estándar.
- **¿Puedo cobrar otra cosa (clases, inscripciones)?** Sí: elegí un tipo de referencia nuevo (`buildReference("clase", id)`) y agregá su manejador en `handlers`.
- **¿Y las comisiones / otros medios de pago?** Las define la cuenta de Mercado Pago de quien cobra; no se manejan acá.

## API de Orders (recomendada para integraciones nuevas)

Mercado Pago recomienda **Checkout Pro vía API de Orders** para integraciones nuevas: Preferences sigue con soporte, pero las funciones nuevas salen solo en Orders. Las dos conviven en este módulo; Orders vive en archivos aparte (`src/orders.js`, `adapters/next-orders.js`).

```js
const mp = require("./mercadopago-checkout");
const client = mp.createOrdersClient({ accessToken: process.env.MP_ACCESS_TOKEN });

// (a) Crear la orden y mandar al navegador a checkoutUrl
const order = mp.buildOrder({
  reference: mp.buildReference("order", pedido.id),
  items: [{ id: 5, title: "Crema", quantity: 2, unitPrice: 15000 }],   // precios de TU base
  backUrls: { success, failure, pending },
  payerEmail,
});
const { id, checkoutUrl } = await client.createOrder(order, { idempotencyKey: `order-${pedido.id}` }); // idempotencia OBLIGATORIA

// (b) El aviso (Next.js / Vercel). Las mismas reglas de siempre, reusadas sin cambios.
const { nextOrdersWebhook } = require("./mercadopago-checkout/adapters/next-orders");
export const POST = nextOrdersWebhook({
  isEnabled: mp.isEnabled,
  process: (req, orderId) => mp.processOrderNotification({
    client, orderId,
    handlers: { order: (ctx) => mp.processOrderPayment({ ...ctx, store }) },   // store.paymentId = id de la orden
  }),
});
```

| Preferences | Orders |
|-------------|--------|
| `buildPreference` + `createClient().createPreference` → `initPoint` | `buildOrder` + `createOrdersClient().createOrder` → `checkoutUrl` |
| montos numéricos | montos en texto `"15000.00"` (`toAmount`) |
| aviso `type=payment`, id numérico | aviso de órdenes (`order` / `orders` / `orders_v2`), id tipo `ORD01...` |
| `notification_url` en la preferencia | URL del aviso en el **panel** (Tus integraciones → app → Webhooks) |
| aprobado = `approved` | aprobado = `processed` + `accredited` + total pagado completo (`orderAsPayment`) |

**Verificado con un pago real** (landing CMR, 2026-11-21, credenciales de prueba): la orden se crea, el aviso llega con el evento **"Order (Mercado Pago)"** configurado en el panel y la contratación se confirma. Detalles aprendidos ahí:

- `external_reference` **no acepta ":"**: `buildOrder` manda `servicio-12` y `orderAsPayment` lo vuelve a `servicio:12` (no hace falta hacer nada).
- `GET /v1/orders/{id}` con un id inventado devuelve **400**, no 404: `getOrder` lo trata como orden inexistente.
- Si Mercado Pago rechaza la orden, `e.status` y `e.detail` traen el motivo: guardalo en tu base para poder verlo (los logs de Vercel duran poco).
- Sigue sin confirmar si la orden tiene un campo para la URL del aviso: se configura en el panel.

## Replicarlo completo en otra app (ej. Canito Skin)

Lo que se armó en la landing de CMR, para copiar. Cada proyecto es independiente: se **copia**, no se comparte.

| Pieza | De dónde (repo LANDING-PAGE) | Qué cambiar |
|-------|------------------------------|-------------|
| Módulo de pagos | `packages/mercadopago-checkout/` | Nada. Copiarlo entero. |
| Tablas | `supabase/migrations/2026112112*.sql` | Usarlas de molde: tu tabla de pedidos necesita `estado`, `monto`, `mp_order_id` (único), `mp_status`, `paid_at`. Sin DELETE para el servidor. |
| Lógica del cobro | `api/_lib/contrataciones.js` | Molde del "store" y de crear el cobro: el precio sale de TU base, nace `pendiente`, si Mercado Pago falla queda `cancelada` y se guarda el motivo. Cambiar `REFERENCIA` (ej. `"order"` para el market, `"turno"` para turnos). |
| Endpoints | `api/checkout.js`, `api/mp/webhook.js` | En Next.js van en `app/api/.../route.js` con el mismo código (`export const POST = ...`). |
| Regla "solo Mercado Pago" | `api/_lib/mp-url.js` | Nada. |
| Botón, formulario, QR y aviso de vuelta | `public/pago-servicio.js` + `.css` | `WHATSAPP_CMR` (número del cliente), los textos y los `data-servicio*` de los botones. En React se puede copiar la lógica (`esUrlDeMercadoPago`, `matrizQR`, `dibujarQR`, `linkWhatsApp`) a un componente. |
| Librería del QR | `public/vendor/qrcode-generator-1.4.4.js` | Nada (MIT, sin dependencias). Cargarla antes del script del botón. |
| Tests | `test/pago-servicio.test.js`, `test/mp-url.test.js` | Molde: Mercado Pago y la base simulados. |
| Guía de puesta en marcha | `docs/PAGOS-MERCADOPAGO.md` | Pasos de Supabase, Vercel y el panel de Mercado Pago. |

**Pagar con QR**: el QR lleva al **mismo** checkout de Mercado Pago (no es el QR "de caja" de Mercado Pago). El cliente lo escanea con el celular y paga ahí; el aviso y la confirmación son los mismos. El QR solo se dibuja si el link es de Mercado Pago.

**WhatsApp**: al volver con el pago aprobado o pendiente aparece "Mandar comprobante por WhatsApp" con el plan y el número de pedido. El nombre del plan se toma de la página, nunca del texto de la URL. Lo toca el cliente: no es un aviso automático.

## Cuando el cliente no es desarrollador: que solo conecte su cuenta

Hay dos formas. En las dos, **la plata va a la cuenta de Mercado Pago del cliente**, y el desarrollo lo hace CMR.

1. **Credenciales del cliente, cargadas por CMR** (lo que hay hoy, sin código nuevo). Una sola vez, en una llamada compartiendo pantalla: el cliente entra a *Mercado Pago Developers* con SU cuenta, crea la aplicación (Checkout Pro, API de Orders) y pega el Access Token **él mismo** en Vercel (o CMR lo carga ahí, sin pasarlo por chat ni mail). Contra: el cliente ve el panel de desarrollador una vez, y si el token se filtra hay que regenerarlo.
2. **"Conectar Mercado Pago" con OAuth** (a construir). CMR tiene UNA aplicación; el cliente toca un botón en su panel, inicia sesión en Mercado Pago y toca "Autorizar". Nunca ve credenciales. Hace falta:
   - una URL de vuelta;
   - guardar sus tokens cifrados en la base;
   - renovarlos antes de que venzan. El `access_token` dura 180 días; hay que pedir `offline_access` y guardar el `refresh_token` nuevo en cada renovación.

   Bonus: permite cobrarle a CMR una comisión por venta (`marketplace_fee`). Sirve para varios clientes (CMR Nexo, canchas).
