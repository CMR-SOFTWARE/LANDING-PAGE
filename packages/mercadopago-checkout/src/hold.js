"use strict";

// "Retención": mientras la clienta paga, la reserva queda PENDIENTE y ocupa el lugar durante una
// ventana corta (por defecto 10 minutos). Pasado ese tiempo sin pago se la considera vencida.
//
// Importante: "vencida" es un estado DERIVADO. Quien use esto debería MOSTRARLA como cancelada y
// liberar el lugar, pero sin escribir ni borrar nada en la base. Así nunca se pierde un dato, y si
// el pago llega tarde todavía se puede confirmar (ver processHeldBookingPayment).

const DEFAULT_HOLD_MINUTES = 10;

// Minutos de retención desde una variable de entorno (por defecto MP_HOLD_MINUTES).
// Valores raros (vacío, texto, 0, negativos, más de 4 horas) usan el valor por defecto.
function holdMsFromEnv(env = process.env, varName = "MP_HOLD_MINUTES") {
  const minutes = Number(env[varName]);
  const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 240;
  return (valid ? minutes : DEFAULT_HOLD_MINUTES) * 60 * 1000;
}

// booking = { status: "pending" | ..., createdAt: fecha ISO }. Solo una reserva pendiente puede vencer.
function isHoldExpired(booking, { now = Date.now(), holdMs }) {
  if (!booking || booking.status !== "pending") return false;
  const created = Date.parse(booking.createdAt);
  return Number.isFinite(created) && created < now - holdMs;
}

module.exports = { holdMsFromEnv, isHoldExpired, DEFAULT_HOLD_MINUTES };
