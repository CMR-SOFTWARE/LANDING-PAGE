"use strict";

// Adaptador para Express. Uso:
//
//   const { expressWebhook } = require("./packages/mercadopago-checkout/adapters/express");
//   app.post("/api/mp/webhook", expressWebhook({
//     isEnabled: () => mp.isEnabled(),
//     process: (req, paymentId) => miAppProcesaElPago(paymentId),   // ver README
//   }));
//
// Necesita que el servidor use express.json() (para leer el cuerpo del aviso).

const { handleWebhook } = require("../src/webhook");
const { createDebouncer } = require("../src/notification");

function expressWebhook({ isEnabled, process, debouncer = createDebouncer() }) {
  return async function mercadoPagoWebhook(req, res, next) {
    try {
      const result = await handleWebhook({
        isEnabled,
        query: req.query,
        body: req.body,
        process: (paymentId) => process(req, paymentId),
        debouncer,
      });
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error); // Mercado Pago recibe un 5xx y reintenta
    }
  };
}

module.exports = { expressWebhook };
