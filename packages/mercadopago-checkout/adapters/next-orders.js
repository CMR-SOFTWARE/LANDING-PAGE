"use strict";

// Adaptador del aviso de ÓRDENES (API de Orders) para Next.js / funciones de Vercel con
// Request/Response estándar. Uso:
//
//   const { nextOrdersWebhook } = require("<ruta>/mercadopago-checkout/adapters/next-orders");
//   export const POST = nextOrdersWebhook({
//     isEnabled: () => mp.isEnabled(),
//     process: (request, orderId) => mp.processOrderNotification({ client, orderId, handlers }),
//   });

const { handleOrderWebhook } = require("../src/orders");
const { createDebouncer } = require("../src/notification");

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function nextOrdersWebhook({ isEnabled, process, debouncer = createDebouncer() }) {
  return async function POST(request) {
    try {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      const body = await request.json().catch(() => ({}));
      const result = await handleOrderWebhook({
        isEnabled,
        query,
        body,
        process: (orderId) => process(request, orderId),
        debouncer,
      });
      return json(result.body, result.status);
    } catch (error) {
      console.error("[mercadopago] webhook de órdenes:", error); // 5xx: Mercado Pago reintenta
      return json({ error: "Error interno." }, 500);
    }
  };
}

module.exports = { nextOrdersWebhook };
