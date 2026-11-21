"use strict";

// Aviso de pago de Mercado Pago ("webhook"). Regla de oro: el aviso es solo un PING.
// Lo único que se usa de él es el id del pago; el estado real se le pregunta a Mercado Pago
// con nuestro token, así nadie puede fingir un pago mandando un aviso falso.

const { buildReference, parseReference } = require("./references");

// El id del pago viene en la URL (?data.id=123&type=payment) o en el cuerpo ({ data: { id } }).
function parseNotification({ query, body } = {}) {
  const q = query || {};
  const b = body && typeof body === "object" ? body : {};
  const topic = String(q.type || q.topic || b.type || b.topic || "");
  const rawId = q["data.id"] ?? b?.data?.id ?? (topic === "payment" ? q.id : undefined);
  return { topic, paymentId: rawId == null ? "" : String(rawId) };
}

/**
 * Consulta el pago y se lo pasa al manejador de lo que se pagó, según el tipo de la referencia.
 *
 *   handlers = {
 *     order:   ({ payment, id, reference, warn }) => processOrderPayment({ ...ctx, store }),
 *     booking: ({ payment, id, reference, warn }) => processHeldBookingPayment({ ...ctx, store, holdMs }),
 *   }
 *
 * Devuelve { ignored: true, reason } si no hay nada que hacer, o lo que devuelva el manejador.
 * Si Mercado Pago falla (5xx), el error se lanza: el webhook responde 5xx y Mercado Pago reintenta.
 */
async function processNotification({ client, paymentId, handlers, warn = () => {} }) {
  const payment = await client.getPayment(paymentId);
  if (!payment) return { ignored: true, reason: "pago inexistente" };

  const parsed = parseReference(payment.external_reference);
  if (!parsed) return { ignored: true, reason: "sin referencia" };
  const handler = handlers?.[parsed.kind];
  if (!handler) return { ignored: true, reason: "tipo sin manejador" };

  // Se rearma la referencia a partir del id, así una referencia "rara" (ej. con ceros) no coincide.
  return handler({ payment, id: parsed.id, reference: buildReference(parsed.kind, parsed.id), warn });
}

// Freno básico: el mismo aviso repetido en pocos segundos no dispara otra consulta a Mercado Pago.
function createDebouncer({ windowMs = 3000, maxEntries = 500 } = {}) {
  const seen = new Map();
  return {
    seenRecently(key) {
      const now = Date.now();
      if (now - (seen.get(key) || 0) < windowMs) return true;
      seen.set(key, now);
      if (seen.size > maxEntries) for (const [k, t] of seen) if (now - t > 60000) seen.delete(k);
      return false;
    },
  };
}

module.exports = { parseNotification, processNotification, createDebouncer };
