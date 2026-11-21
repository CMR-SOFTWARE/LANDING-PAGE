"use strict";

// Punto de entrada del módulo. Todo lo que se usa desde afuera se importa de acá:
//
//   const mp = require("./packages/mercadopago-checkout");
//
// Los adaptadores de framework se importan aparte (para no cargar Next si usás Express):
//   require("./packages/mercadopago-checkout/adapters/express")
//   require("./packages/mercadopago-checkout/adapters/next")

module.exports = {
  ...require("./config"), // isEnabled, resolveBaseUrl
  ...require("./client"), // createClient, MercadoPagoError
  ...require("./references"), // buildReference, parseReference
  ...require("./preference"), // buildPreference, withQuery, normalizeBaseUrl, formatDate
  ...require("./payment"), // evaluatePayment
  ...require("./hold"), // holdMsFromEnv, isHoldExpired
  ...require("./notification"), // parseNotification, processNotification, createDebouncer
  ...require("./policies"), // processOrderPayment, processHeldBookingPayment
  ...require("./webhook"), // handleWebhook
  ...require("./orders"), // API de Orders: buildOrder, createOrdersClient, processOrderNotification, handleOrderWebhook...
};
