"use strict";

// ¿Este pago corresponde a lo que esperábamos cobrar? Se compara el pago que informa
// Mercado Pago (consultado por el servidor, nunca el que dice el navegador) con lo esperado.
//
// Devuelve { ok, reason, paymentStatus, outcome }:
//   ok=false  -> el pago NO corresponde (referencia, moneda o monto distintos): no se toca nada.
//   outcome   -> "paid" (aprobado) | "refunded" (reembolsado o contracargo) | null (cualquier otro estado)

function evaluatePayment({ payment, reference, expectedAmount, currency = "ARS" }) {
  const paymentStatus = String(payment?.status || "");
  const reject = (reason) => ({ ok: false, reason, paymentStatus, outcome: null });

  if (String(payment?.external_reference ?? "") !== String(reference ?? "")) return reject("referencia distinta");
  if (String(payment?.currency_id || "") !== currency) return reject("moneda distinta");

  const paid = Number(payment?.transaction_amount);
  const expected = Number(expectedAmount);
  // Tolera diferencias de centavos; cualquier otra diferencia no confirma.
  if (!Number.isFinite(paid) || !Number.isFinite(expected) || Math.abs(paid - expected) > 0.01) {
    return reject("monto distinto");
  }

  if (paymentStatus === "approved") return { ok: true, reason: null, paymentStatus, outcome: "paid" };
  if (paymentStatus === "refunded" || paymentStatus === "charged_back") {
    return { ok: true, reason: null, paymentStatus, outcome: "refunded" };
  }
  return { ok: true, reason: null, paymentStatus, outcome: null };
}

module.exports = { evaluatePayment };
