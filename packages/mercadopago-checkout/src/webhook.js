"use strict";

// Lógica del webhook, independiente del framework. Los adaptadores (Express, Next.js) solo
// traducen el pedido HTTP a { query, body } y la respuesta { status, body } a su formato.
//
// Siempre responde 200 salvo que sea un error NUESTRO (5xx), para que Mercado Pago reintente
// únicamente cuando corresponde.

const { parseNotification } = require("./notification");

async function handleWebhook({ isEnabled, query, body, process, debouncer }) {
  if (!isEnabled()) return { status: 503, body: { error: "No disponible." } };

  const { topic, paymentId } = parseNotification({ query, body });
  // Solo interesan los avisos de pago con un id numérico; el resto se ignora sin error.
  if (topic !== "payment" || !/^[0-9]{1,20}$/.test(paymentId)) return { status: 200, body: { ok: true, ignored: true } };
  if (debouncer?.seenRecently(paymentId)) return { status: 200, body: { ok: true, repeated: true } };

  await process(paymentId); // acá la app consulta el pago y actualiza su base
  return { status: 200, body: { ok: true } };
}

module.exports = { handleWebhook };
