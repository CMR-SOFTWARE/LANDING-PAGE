"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mp = require("../src");

test("referencias: se arman y se leen con tipo e id", () => {
  assert.equal(mp.buildReference("order", 77), "order:77");
  assert.deepEqual(mp.parseReference("order:77"), { kind: "order", id: 77 });
  assert.deepEqual(mp.parseReference("turno:5"), { kind: "turno", id: 5 });
});

test("referencias: lo que no tiene el formato se ignora (null) y no se pueden armar inválidas", () => {
  for (const mala of ["77", "turno:", "turno:abc", "Order:1", "otro tipo:1", "turno:1;drop", "", null, undefined, "order:-3", "order:1234567890123456"]) {
    assert.equal(mp.parseReference(mala), null, String(mala));
  }
  assert.throws(() => mp.buildReference("Order", 1));
  assert.throws(() => mp.buildReference("order", "abc"));
  assert.throws(() => mp.buildReference("", 1));
});

test("normalizeBaseUrl: solo http(s) y sin barra final", () => {
  assert.equal(mp.normalizeBaseUrl("https://www.mitienda.com/"), "https://www.mitienda.com");
  assert.equal(mp.normalizeBaseUrl("  http://localhost:3000  "), "http://localhost:3000");
  for (const mala of ["javascript:alert(1)", "ftp://x.com", "", null, "www.sin-protocolo.com"]) assert.equal(mp.normalizeBaseUrl(mala), "", String(mala));
});

test("withQuery agrega parámetros y los escapa", () => {
  assert.equal(mp.withQuery("https://x.com/cart", { mp: "ok", pedido: 7 }), "https://x.com/cart?mp=ok&pedido=7");
  assert.equal(mp.withQuery("https://x.com/?a=1", { t: "a b" }), "https://x.com/?a=1&t=a+b");
});

test("formatDate: ISO con zona, Argentina por defecto", () => {
  const t0 = Date.parse("2026-11-20T15:00:00.000Z");
  assert.equal(mp.formatDate(t0), "2026-11-20T12:00:00.000-03:00");
  assert.equal(mp.formatDate(t0, 0), "2026-11-20T15:00:00.000+00:00");
  assert.equal(mp.formatDate(t0, 330), "2026-11-20T20:30:00.000+05:30");
});

const base = {
  reference: "order:77",
  items: [{ id: 5, title: "Crema", quantity: 2, unitPrice: 15000 }, { id: 9, title: "Sérum", quantity: 1, unitPrice: 15000 }],
  baseUrl: "https://www.mitienda.com/",
  webhookPath: "/api/mp/webhook",
  backUrls: { success: "https://www.mitienda.com/ok", failure: "https://www.mitienda.com/error", pending: "https://www.mitienda.com/pendiente" },
};

test("buildPreference: items con precio de la base, referencia, retorno y webhook", () => {
  const p = mp.buildPreference({ ...base, payerEmail: "ana@mail.com" });
  assert.equal(p.external_reference, "order:77");
  assert.deepEqual(p.items[0], { id: "5", title: "Crema", quantity: 2, unit_price: 15000, currency_id: "ARS" });
  assert.equal(p.items.reduce((a, it) => a + it.quantity * it.unit_price, 0), 45000);
  assert.equal(p.notification_url, "https://www.mitienda.com/api/mp/webhook");
  assert.deepEqual(p.back_urls, base.backUrls);
  assert.equal(p.auto_return, "approved");
  assert.deepEqual(p.payer, { email: "ana@mail.com" });
  assert.equal(p.binary_mode, undefined);
  assert.equal(p.expires, undefined);
});

test("buildPreference: sin https no hay auto_return; el mail inválido se descarta; el path sin barra se corrige", () => {
  const p = mp.buildPreference({ ...base, baseUrl: "http://localhost:3000", payerEmail: "no-es-mail", webhookPath: "api/mp/webhook" });
  assert.equal(p.auto_return, undefined);
  assert.equal(p.payer, undefined);
  assert.equal(p.notification_url, "http://localhost:3000/api/mp/webhook");
});

test("buildPreference: pagos instantáneos (sin efectivo con cupón, sin 'en proceso') y vencimiento", () => {
  const now = Date.parse("2026-11-20T15:00:00.000Z");
  const p = mp.buildPreference({ ...base, instantPaymentsOnly: true, expiresInMs: 10 * 60 * 1000, now });
  assert.equal(p.binary_mode, true);
  assert.deepEqual(p.payment_methods, { excluded_payment_types: [{ id: "ticket" }] });
  assert.equal(p.expires, true);
  assert.equal(p.expiration_date_from, "2026-11-20T12:00:00.000-03:00");
  assert.equal(p.expiration_date_to, "2026-11-20T12:10:00.000-03:00");
});

test("buildPreference: rechaza datos inválidos en vez de mandarlos a Mercado Pago", () => {
  for (const mala of [{ baseUrl: "ftp://x" }, { items: [] }, { items: null }, { reference: "" }, { backUrls: { success: "x" } }]) {
    assert.throws(() => mp.buildPreference({ ...base, ...mala }), TypeError, JSON.stringify(mala));
  }
  for (const unitPrice of [0, -1, NaN, "abc", null]) {
    assert.throws(() => mp.buildPreference({ ...base, items: [{ id: 1, title: "X", quantity: 1, unitPrice }] }), TypeError, String(unitPrice));
  }
});
