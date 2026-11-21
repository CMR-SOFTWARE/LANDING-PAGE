# Contratar un plan con Mercado Pago (API de Orders)

Botón **"Pagar con Mercado Pago"** en las tarjetas del Plan Web y el Plan Gestión (`index.html`, sección `#planes`).
Cobra **un mes completo** del plan como pago único (sin seña ni reserva). El mes siguiente el cliente vuelve a pagar con el mismo botón.

Usa **Checkout Pro con la API de Orders**, la que Mercado Pago recomienda para integraciones nuevas. La API de Preferences sigue con soporte, pero según Mercado Pago las funciones nuevas salen solo en Orders. No anunció fecha de cierre.

## Cómo funciona

```
Navegador ── POST /api/checkout {servicio, nombre, email, telefono}
               └─ precio sacado de public.servicios (NUNCA del navegador)
               └─ contratación nace "pendiente" en public.contrataciones
               └─ POST /v1/orders (referencia "servicio:<id>", montos "80000.00") → { checkoutUrl }
Navegador ── redirige SOLO a https://*.mercadopago.com(.ar)
Mercado Pago ── POST /api/mp/webhook  (ping con el id de la ORDEN, ej. ORD01...)
               └─ el servidor CONSULTA GET /v1/orders/{id}
               └─ si referencia + moneda ARS + monto coinciden y la orden está
                  processed/accredited con el total pagado → "confirmada"
Navegador vuelve a /?mp=ok|error|pendiente#planes → aviso informativo, NO confirma nada
```

- Al volver con `mp=ok` o `mp=pendiente`, el cartel trae un botón **"Mandar comprobante por WhatsApp"** que abre `wa.me/5493364578599` con el mensaje armado ("pagué la contratación N° X"). Lo toca el cliente: no es automático. Mercado Pago, aparte, le manda el comprobante por mail.
- Si Mercado Pago falla al crear la orden: la contratación queda **cancelada** (no se borra) y se responde 502.
- Reembolso total o contracargo → la contratación pasa a **cancelada**.
- Nada se borra: la base no le da permiso de DELETE ni al servidor.
- Lógica de pagos: módulo `packages/mercadopago-checkout`. Orders está en archivos NUEVOS (`src/orders.js`, `adapters/next-orders.js`, `test/orders.test.js`); lo de Preferences quedó igual.

## Archivos

| Archivo | Qué es |
|---------|--------|
| `api/checkout.js` | `GET` → `{ enabled }` · `POST` → crea contratación y orden, devuelve `checkoutUrl` |
| `api/mp/webhook.js` | Aviso de órdenes de Mercado Pago |
| `api/_lib/contrataciones.js` | Validación, store (load/save) y reglas propias de la landing |
| `api/_lib/supabase-rest.js` | Acceso a Supabase por REST, sin dependencias |
| `api/_lib/mp-url.js` | Regla "solo dominios de Mercado Pago" |
| `public/pago-servicio.js` / `.css` | Botón, formulario y aviso de vuelta |
| `supabase/migrations/20261121120000_contrataciones_mercadopago.sql` | Tablas `servicios` y `contrataciones` (**ya aplicada**) |
| `supabase/migrations/20261121130000_contrataciones_mp_order.sql` | Columna `mp_order_id` (solo agrega) |
| `test/*.test.js` | `npm test` (Mercado Pago y Supabase simulados) |

## Puesta en marcha (lo hace una persona, no el código)

1. **SQL**: en el proyecto Supabase *CMR Landing Page + CMR Nexo* (`wnzugiqyezrkywwfrbdw`) correr `20261121130000_contrataciones_mp_order.sql` (la primera migración ya está aplicada).
2. **Aplicación de Mercado Pago** (developers → Tus integraciones): Checkout Pro con **Tipo de API: API de Orders**. Copiar el **Access Token de prueba**.
3. **Variables en Vercel** (Settings → Environment Variables, del lado servidor, sin `VITE_`), primero **solo Preview**:
   - `MP_ACCESS_TOKEN` → el de **prueba** (Sensitive). Sin esta variable el botón no aparece y todo queda apagado.
   - `SUPABASE_URL` → `https://wnzugiqyezrkywwfrbdw.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` → clave secreta del proyecto (Sensitive). Nunca con `VITE_`.
   - `PUBLIC_BASE_URL` → solo en Production: `https://cmrsoftwaresolutions.com`
4. **Webhook en el panel de Mercado Pago** (la app → Webhooks → Configurar notificaciones), evento de **Órdenes**:
   - Modo prueba: `https://<url del preview de la rama>/api/mp/webhook`. Usar la URL fija de la rama que da Vercel (`...-git-feat-pago-servicios-mercadopago-...vercel.app`), no la de un deploy puntual.
   - Modo productivo: `https://cmrsoftwaresolutions.com/api/mp/webhook`.
5. **Deployment Protection** de Vercel: si los previews piden login, el aviso rebota con 401. Desactivarla para la prueba y volver a activarla después.
6. **Prueba**: contratar en el preview, pagar en ventana de incógnito con tarjeta de prueba (titular `APRO` aprueba, `OTHE` rechaza) y verificar en `public.contrataciones` que quede `confirmada`, con `mp_order_id` y `paid_at`.
7. Recién después: token real en Production + webhook productivo.

**Cambiar un precio**: `update public.servicios set precio = 90000 where slug = 'plan-web';` y actualizar también el texto de la tarjeta en `index.html` (se cobra lo que diga la base).
**Dejar de vender un plan**: `update public.servicios set activo = false where slug = '...';` (no se borra).

## Verificado con un pago de prueba real (2026-11-21, preview de la rama)

- Contratación #4, Plan Web $80.000, tarjeta de prueba APRO: Mercado Pago acreditó, el **aviso llegó** a `/api/mp/webhook` (evento "Order (Mercado Pago)" configurado en el panel), el servidor consultó la orden y la contratación pasó a `confirmada` con `mp_order_id`, `mp_status = approved` y `paid_at`.
- Vercel publica `api/*.js` en este proyecto Vite (`GET /api/checkout` → `{"enabled":true}`).
- **La API de Orders no acepta ":" en `external_reference`** (error `property_value ... does not match pattern`). Se manda `servicio-<id>` y se traduce de vuelta a `servicio:<id>`.
- Consultar una orden con un id inventado devuelve **400** (no 404): se trata como orden inexistente.
- Si Mercado Pago rechaza crear la orden, el motivo queda en `contrataciones.mp_status` (`order_error: <código> <detalle>`).

## Lo que NO está verificado

- **La vuelta automática a la landing** después de pagar: la pantalla de Mercado Pago mostró "te llevaremos a ." con la dirección vacía. A confirmar.
- Un pago **rechazado** (titular `OTHE`) y un **reembolso** contra Mercado Pago real (están cubiertos por los tests simulados).
- Nada con el **token real** todavía.
- Firma `x-signature` del aviso: no implementada (no hace falta: el servidor siempre consulta la orden a Mercado Pago).
- No hay límite de intentos: alguien podría crear muchas contrataciones pendientes (no cobra nada, pero ensucia la tabla).

Fuentes: [Checkout Pro vía Orders](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-orders/overview) · [Crear orden](https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-pro/create-order/post) · [Consultar orden](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro/get-order/get) · [Estados](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/payment-management/status/order-status) · [Webhooks](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/resources/notifications/webhooks)
