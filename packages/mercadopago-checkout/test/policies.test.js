"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mp = require("../src");

const MIN = 60 * 1000;
const T0 = Date.parse("2026-11-20T15:00:00.000Z");

// ---------------------------------------------------------------- PEDIDO (tienda)
function entornoPedido(inicial) {
  const db = { order: inicial ? { ...inicial } : null, saved: [], warnings: [] };
  return {
    db,
    ctx: {
      reference: "order:77",
      warn: (m) => db.warnings.push(m),
      store: {
        load: async (id) => (db.order && db.order.id === id ? { ...db.order } : null),
        save: async (id, patch) => { Object.assign(db.order, patch); db.saved.push(patch); },
      },
    },
  };
}
const pedidoPend = { id: 77, amount: 45000, status: "pending", paymentId: null };
const pagoP = (o = {}) => ({ id: 1, status: "approved", external_reference: "order:77", currency_id: "ARS", transaction_amount: 45000, ...o });
const cobrarPedido = (e, p) => mp.processOrderPayment({ payment: p, id: 77, ...e.ctx });

test("pedido: pago aprobado confirma y guarda el pago", async () => {
  const e = entornoPedido(pedidoPend);
  const r = await cobrarPedido(e, pagoP());
  assert.equal(r.ok, true);
  assert.deepEqual([e.db.order.status, e.db.order.paymentId, e.db.order.paymentStatus], ["confirmed", "1", "approved"]);
  assert.ok(e.db.order.paidAt);
});

test("pedido: el mismo aviso repetido es idempotente", async () => {
  const e = entornoPedido(pedidoPend);
  await cobrarPedido(e, pagoP());
  const paidAt = e.db.order.paidAt;
  await cobrarPedido(e, pagoP());
  assert.equal(e.db.order.status, "confirmed");
  assert.equal(e.db.order.paidAt, paidAt);
});

test("pedido: pago por menos plata, de otro pedido o inexistente NO confirma ni escribe", async () => {
  for (const o of [{ transaction_amount: 1 }, { external_reference: "order:999" }, { external_reference: "turno:77" }, { currency_id: "USD" }]) {
    const e = entornoPedido(pedidoPend);
    const r = await cobrarPedido(e, pagoP(o));
    assert.equal(r.ignored, true, JSON.stringify(o));
    assert.equal(e.db.saved.length, 0);
    assert.equal(e.db.order.status, "pending");
  }
  assert.equal((await cobrarPedido(entornoPedido(null), pagoP())).ignored, true);
});

test("pedido: rechazado lo deja pendiente (puede reintentar); un intento tardío no pisa el pago aprobado", async () => {
  const e = entornoPedido(pedidoPend);
  await cobrarPedido(e, pagoP({ id: 2, status: "rejected" }));
  assert.deepEqual([e.db.order.status, e.db.order.paymentStatus], ["pending", "rejected"]);
  await cobrarPedido(e, pagoP({ id: 5 }));
  const r = await cobrarPedido(e, pagoP({ id: 4, status: "rejected" }));
  assert.equal(r.ignored, true);
  assert.deepEqual([e.db.order.paymentId, e.db.order.status], ["5", "confirmed"]);
});

test("pedido: el reembolso del pago aprobado cancela; un pago aprobado sobre un pedido cancelado avisa y no lo reactiva", async () => {
  const e = entornoPedido(pedidoPend);
  await cobrarPedido(e, pagoP({ id: 5 }));
  await cobrarPedido(e, pagoP({ id: 5, status: "refunded" }));
  assert.equal(e.db.order.status, "cancelled");

  const c = entornoPedido({ ...pedidoPend, status: "cancelled" });
  await cobrarPedido(c, pagoP({ id: 6 }));
  assert.equal(c.db.order.status, "cancelled");
  assert.equal(c.db.warnings.length, 1);
});

test("pedido: si Mercado Pago o la base fallan el error sube (para que Mercado Pago reintente)", async () => {
  const e = entornoPedido(pedidoPend);
  e.ctx.store.save = async () => { throw new Error("base caída"); };
  await assert.rejects(cobrarPedido(e, pagoP()), /base caída/);
});

// ---------------------------------------------------------------- RESERVA con lugar retenido
function entornoReserva(inicial, { libre = true, fallaIngreso = 0 } = {}) {
  const db = { booking: inicial ? { ...inicial } : null, saved: [], warnings: [], incomes: [], fails: fallaIngreso };
  return {
    db,
    ctx: {
      reference: "booking:5",
      warn: (m) => db.warnings.push(m),
      now: T0 + 3 * MIN,
      holdMs: 10 * MIN,
      store: {
        load: async (id) => (db.booking && db.booking.id === id ? { ...db.booking } : null),
        save: async (id, patch) => { Object.assign(db.booking, patch); db.saved.push(patch); },
        isSlotFree: async () => libre,
        recordIncome: async (b, amount) => {
          if (db.fails > 0) { db.fails--; throw new Error("caja caída"); }
          if (!db.incomes.some((i) => i.id === b.id)) db.incomes.push({ id: b.id, amount }); // idempotente
        },
      },
    },
  };
}
const reservaPend = { id: 5, amount: 10000, status: "pending", paymentId: null, createdAt: new Date(T0).toISOString() };
const pagoR = (o = {}) => ({ id: 9, status: "approved", external_reference: "booking:5", currency_id: "ARS", transaction_amount: 10000, ...o });
const cobrarReserva = (e, p) => mp.processHeldBookingPayment({ payment: p, id: 5, ...e.ctx });

test("reserva: pago aprobado a tiempo confirma y asienta lo realmente cobrado", async () => {
  const e = entornoReserva(reservaPend);
  const r = await cobrarReserva(e, pagoR());
  assert.equal(r.ok, true);
  assert.equal(r.confirmed, true);
  assert.deepEqual([e.db.booking.status, e.db.booking.paymentId], ["confirmed", "9"]);
  assert.ok(e.db.booking.paidAt);
  assert.deepEqual(e.db.incomes, [{ id: 5, amount: 10000 }]);
});

test("reserva: el mismo aviso repetido no duplica el cobro", async () => {
  const e = entornoReserva(reservaPend);
  await cobrarReserva(e, pagoR());
  await cobrarReserva(e, pagoR());
  assert.equal(e.db.booking.status, "confirmed");
  assert.equal(e.db.incomes.length, 1);
});

test("reserva: pago tardío con el lugar libre confirma igual", async () => {
  const e = entornoReserva(reservaPend, { libre: true });
  e.ctx.now = T0 + 30 * MIN;
  await cobrarReserva(e, pagoR());
  assert.equal(e.db.booking.status, "confirmed");
  assert.equal(e.db.incomes.length, 1);
});

test("reserva: pago tardío con el lugar ocupado NO confirma, queda cancelada y avisa devolver", async () => {
  const e = entornoReserva(reservaPend, { libre: false });
  e.ctx.now = T0 + 30 * MIN;
  await cobrarReserva(e, pagoR());
  assert.deepEqual([e.db.booking.status, e.db.booking.paymentStatus], ["cancelled", "approved"]);
  assert.equal(e.db.incomes.length, 0);
  assert.match(e.db.warnings.join(" "), /devolver/);
});

test("reserva: pago aprobado sobre una reserva cancelada no la reactiva y avisa devolver", async () => {
  const e = entornoReserva({ ...reservaPend, status: "cancelled" });
  await cobrarReserva(e, pagoR());
  assert.equal(e.db.booking.status, "cancelled");
  assert.equal(e.db.incomes.length, 0);
  assert.match(e.db.warnings.join(" "), /devolver/);
});

test("reserva: monto distinto, otra moneda o referencia de otro tipo NO confirman", async () => {
  for (const o of [{ transaction_amount: 1 }, { currency_id: "USD" }, { external_reference: "order:5" }, { external_reference: "booking:6" }, { external_reference: "5" }]) {
    const e = entornoReserva(reservaPend);
    const r = await cobrarReserva(e, pagoR(o));
    assert.equal(r.ignored, true, JSON.stringify(o));
    assert.equal(e.db.booking.status, "pending");
    assert.equal(e.db.saved.length, 0);
    assert.equal(e.db.incomes.length, 0);
  }
});

test("reserva: rechazado la deja pendiente; un intento tardío no pisa el pago aprobado; el reembolso cancela", async () => {
  const e = entornoReserva(reservaPend);
  await cobrarReserva(e, pagoR({ id: 8, status: "rejected" }));
  assert.deepEqual([e.db.booking.status, e.db.booking.paymentStatus], ["pending", "rejected"]);
  assert.equal(e.db.incomes.length, 0);

  await cobrarReserva(e, pagoR({ id: 9 }));
  const tardio = await cobrarReserva(e, pagoR({ id: 8, status: "rejected" }));
  assert.equal(tardio.ignored, true);
  assert.equal(e.db.booking.paymentId, "9");

  await cobrarReserva(e, pagoR({ id: 9, status: "refunded" }));
  assert.equal(e.db.booking.status, "cancelled");
});

test("reserva: si falla el asiento del cobro el error sube y el reintento lo completa sin duplicar", async () => {
  const e = entornoReserva(reservaPend, { fallaIngreso: 1 });
  await assert.rejects(cobrarReserva(e, pagoR()), /caja caída/);
  assert.equal(e.db.booking.status, "confirmed");
  assert.equal(e.db.incomes.length, 0);
  await cobrarReserva(e, pagoR()); // Mercado Pago reintenta el aviso
  assert.equal(e.db.incomes.length, 1);
  await cobrarReserva(e, pagoR());
  assert.equal(e.db.incomes.length, 1);
});

test("reserva: una reserva inexistente se ignora", async () => {
  assert.equal((await cobrarReserva(entornoReserva(null), pagoR())).ignored, true);
});
