"use strict";

// Reglas listas para usar sobre un pago ya consultado. Hay dos casos típicos:
//
//   processOrderPayment         un PEDIDO (tienda): pendiente -> confirmado al pagar.
//   processHeldBookingPayment   una RESERVA con lugar retenido (turnos, canchas, clases).
//
// Las reglas NO conocen tu base de datos: vos le pasás un `store` con unas pocas funciones
// (cargar, guardar, etc.) y ellas deciden qué hacer. Usan un vocabulario neutro:
//   status:  "pending" | "confirmed" | "cancelled"
//   patch:   { paymentId, paymentStatus, status?, paidAt? }   <- lo que hay que guardar
// Tu `store.save` traduce eso a tus columnas y a tu idioma ("confirmado", "pagado", etc.).
//
// Resultado: { ignored: true, reason } si no hay nada que hacer, o { ok: true, patch, ... }.

const { evaluatePayment } = require("./payment");
const { isHoldExpired } = require("./hold");

const noop = () => {};

/**
 * Pedido de una tienda.
 * store.load(id)        -> { id, amount, status, paymentId } | null   (solo pedidos de TU negocio)
 * store.save(id, patch) -> void   (lanzar un error si falla, así Mercado Pago reintenta el aviso)
 */
async function processOrderPayment({ payment, id, reference, store, warn = noop }) {
  const order = await store.load(id);
  if (!order) return { ignored: true, reason: "pedido inexistente" };

  const ev = evaluatePayment({ payment, reference, expectedAmount: order.amount });
  if (!ev.ok) {
    warn(`pago ${payment.id} no coincide con el pedido ${id}: ${ev.reason}`);
    return { ignored: true, reason: ev.reason };
  }
  const samePayment = String(order.paymentId || "") === String(payment.id);
  // Un intento viejo (rechazado) que llega tarde no pisa el pago ya aprobado.
  if (order.status === "confirmed" && order.paymentId && !samePayment) {
    return { ignored: true, reason: "intento anterior" };
  }

  const patch = { paymentId: String(payment.id), paymentStatus: ev.paymentStatus };
  if (ev.outcome === "paid" && order.status === "pending") {
    patch.status = "confirmed";
    patch.paidAt = new Date().toISOString();
  } else if (ev.outcome === "refunded" && samePayment) {
    patch.status = "cancelled";
  } else if (ev.outcome === "paid" && order.status === "cancelled") {
    warn(`pedido ${id} está cancelado pero Mercado Pago registra un pago aprobado (${payment.id}): revisar a mano.`);
  }
  await store.save(id, patch);
  return { ok: true, patch };
}

/**
 * Reserva con lugar retenido.
 * store.load(id)               -> { id, amount, status, paymentId, createdAt } | null
 * store.save(id, patch)        -> void
 * store.isSlotFree(booking)    -> true si el lugar sigue libre (solo se consulta si la retención venció)
 * store.recordIncome(booking, amountPaid) -> asienta el cobro (ej. en caja). DEBE ser idempotente:
 *                                se vuelve a llamar si Mercado Pago repite el aviso.
 * holdMs: duración de la retención (ver holdMsFromEnv).
 */
async function processHeldBookingPayment({ payment, id, reference, store, holdMs, now = Date.now(), warn = noop }) {
  const booking = await store.load(id);
  if (!booking) return { ignored: true, reason: "reserva inexistente" };

  const ev = evaluatePayment({ payment, reference, expectedAmount: booking.amount });
  if (!ev.ok) {
    warn(`pago ${payment.id} no coincide con la reserva ${id}: ${ev.reason}`);
    return { ignored: true, reason: ev.reason };
  }
  const samePayment = String(booking.paymentId || "") === String(payment.id);
  if (booking.status === "confirmed" && booking.paymentId && !samePayment) {
    return { ignored: true, reason: "intento anterior" };
  }

  const patch = { paymentId: String(payment.id), paymentStatus: ev.paymentStatus };
  let recordIncome = false;

  if (ev.outcome === "paid") {
    if (booking.status === "confirmed") {
      recordIncome = true; // mismo pago repetido: se reintenta el asiento por si falló antes
    } else if (booking.status === "pending") {
      if (!isHoldExpired(booking, { now, holdMs }) || (await store.isSlotFree(booking))) {
        patch.status = "confirmed";
        patch.paidAt = new Date(now).toISOString();
        recordIncome = true;
      } else {
        // Pagó tarde y el lugar ya lo ocupó otra persona: no se confirma; hay que devolver el pago.
        patch.status = "cancelled";
        warn(`reserva ${id}: pago aprobado (${payment.id}) pero el lugar ya se ocupó. Hay que devolver el pago.`);
      }
    } else {
      warn(`reserva ${id} está cancelada pero Mercado Pago registra un pago aprobado (${payment.id}). Hay que devolver el pago.`);
    }
  } else if (ev.outcome === "refunded" && samePayment && booking.status === "confirmed") {
    patch.status = "cancelled";
  }

  await store.save(id, patch);
  if (recordIncome) await store.recordIncome(booking, Number(payment.transaction_amount));
  return { ok: true, patch, confirmed: patch.status === "confirmed" || (recordIncome && booking.status === "confirmed") };
}

module.exports = { processOrderPayment, processHeldBookingPayment };
