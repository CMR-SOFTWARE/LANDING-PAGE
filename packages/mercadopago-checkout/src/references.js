"use strict";

// La "referencia externa" viaja a Mercado Pago dentro de la preferencia y vuelve dentro del
// pago. Dice QUÉ se estaba pagando: "tipo:id", por ejemplo "order:77" o "booking:5".
// El tipo evita confundir el pedido 77 con la reserva 77 (si la app cobra de las dos cosas).
//
// El tipo lo elige cada app (en minúscula, sin espacios): "order", "pedido", "turno", etc.

const KIND = /^[a-z][a-z0-9_]{0,19}$/;
const REFERENCE = /^([a-z][a-z0-9_]{0,19}):([0-9]{1,15})$/;

function buildReference(kind, id) {
  if (!KIND.test(String(kind))) throw new TypeError(`buildReference: tipo inválido "${kind}".`);
  if (!/^[0-9]{1,15}$/.test(String(id))) throw new TypeError(`buildReference: id inválido "${id}".`);
  return `${kind}:${id}`;
}

// Devuelve { kind, id } o null si no tiene el formato esperado (así se ignora lo ajeno).
function parseReference(reference) {
  const m = REFERENCE.exec(String(reference ?? ""));
  return m ? { kind: m[1], id: Number(m[2]) } : null;
}

module.exports = { buildReference, parseReference };
