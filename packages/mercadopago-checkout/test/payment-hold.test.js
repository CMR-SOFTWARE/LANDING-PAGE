"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mp = require("../src");

const MIN = 60 * 1000;
const pago = (o = {}) => ({ id: 1, status: "approved", external_reference: "order:77", currency_id: "ARS", transaction_amount: 45000, ...o });
const evaluar = (p, esperado = 45000) => mp.evaluatePayment({ payment: p, reference: "order:77", expectedAmount: esperado });

test("evaluatePayment: pago aprobado y coincidente", () => {
  const r = evaluar(pago());
  assert.deepEqual([r.ok, r.outcome, r.paymentStatus], [true, "paid", "approved"]);
});

test("evaluatePayment: monto, moneda o referencia distintos NO se aceptan", () => {
  const casos = [{ transaction_amount: 100 }, { transaction_amount: 44999 }, { currency_id: "USD" }, { external_reference: "order:78" },
    { external_reference: "turno:77" }, { external_reference: "77" }, { external_reference: undefined }];
  for (const o of casos) {
    const r = evaluar(pago(o));
    assert.equal(r.ok, false, JSON.stringify(o));
    assert.equal(r.outcome, null);
  }
});

test("evaluatePayment: el monto como texto y los centavos se toleran", () => {
  assert.equal(evaluar(pago({ transaction_amount: "45000.00" })).ok, true);
  assert.equal(evaluar(pago({ transaction_amount: "45000.004" })).ok, true);
  assert.equal(evaluar(pago(), "abc").ok, false);
});

test("evaluatePayment: rechazado o pendiente no pagan; reembolso y contracargo son 'refunded'", () => {
  for (const s of ["rejected", "pending", "in_process", "cancelled"]) assert.equal(evaluar(pago({ status: s })).outcome, null, s);
  for (const s of ["refunded", "charged_back"]) assert.equal(evaluar(pago({ status: s })).outcome, "refunded", s);
});

test("holdMsFromEnv: 10 minutos por defecto, configurable y a prueba de valores raros", () => {
  assert.equal(mp.holdMsFromEnv({}), 10 * MIN);
  assert.equal(mp.holdMsFromEnv({ MP_HOLD_MINUTES: "15" }), 15 * MIN);
  assert.equal(mp.holdMsFromEnv({ OTRA: "20" }, "OTRA"), 20 * MIN);
  for (const raro of ["0", "-5", "abc", "", "9999", "NaN"]) assert.equal(mp.holdMsFromEnv({ MP_HOLD_MINUTES: raro }), 10 * MIN, raro);
});

test("isHoldExpired: solo vence una reserva pendiente que pasó la ventana", () => {
  const t0 = Date.parse("2026-11-20T15:00:00.000Z");
  const r = (o = {}) => ({ status: "pending", createdAt: new Date(t0).toISOString(), ...o });
  const holdMs = 10 * MIN;
  assert.equal(mp.isHoldExpired(r(), { now: t0 + 9 * MIN, holdMs }), false);
  assert.equal(mp.isHoldExpired(r(), { now: t0 + 10 * MIN + 1, holdMs }), true);
  assert.equal(mp.isHoldExpired(r({ status: "confirmed" }), { now: t0 + 99 * MIN, holdMs }), false);
  assert.equal(mp.isHoldExpired(r({ status: "cancelled" }), { now: t0 + 99 * MIN, holdMs }), false);
  assert.equal(mp.isHoldExpired(r({ createdAt: "basura" }), { now: t0 + 99 * MIN, holdMs }), false);
  assert.equal(mp.isHoldExpired(null, { holdMs }), false);
});
