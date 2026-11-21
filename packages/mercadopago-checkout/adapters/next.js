"use strict";

// Adaptador para Next.js (App Router, route handlers). Uso, en app/api/mp/webhook/route.js:
//
//   import { nextWebhook } from "<ruta>/mercadopago-checkout/adapters/next";
//   export const POST = nextWebhook({
//     isEnabled: () => mp.isEnabled(),
//     process: (request, paymentId) => miAppProcesaElPago(paymentId),   // ver README
//   });
//
// Devuelve una función (Request) => Response, que es lo que Next espera de un handler POST.

const { handleWebhook } = require("../src/webhook");
const { createDebouncer } = require("../src/notification");

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function nextWebhook({ isEnabled, process, debouncer = createDebouncer() }) {
  return async function POST(request) {
    try {
      const query = Object.fromEntries(new URL(request.url).searchParams);
      const body = await request.json().catch(() => ({}));
      const result = await handleWebhook({
        isEnabled,
        query,
        body,
        process: (paymentId) => process(request, paymentId),
        debouncer,
      });
      return json(result.body, result.status);
    } catch (error) {
      console.error("[mercadopago] webhook:", error); // Mercado Pago recibe un 5xx y reintenta
      return json({ error: "Error interno." }, 500);
    }
  };
}

module.exports = { nextWebhook };
