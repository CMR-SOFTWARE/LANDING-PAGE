"use strict";
// Corre el ejemplo de Express (examples/express.js) de punta a punta con un Mercado Pago simulado:
// si el README promete que funciona, este test lo comprueba.
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.MP_ACCESS_TOKEN = "APP_USR-test";
process.env.PUBLIC_BASE_URL = "https://www.mitienda.com";

// Mercado Pago simulado (el cliente usa fetch global de forma diferida).
const realFetch = globalThis.fetch;
const pagos = new Map();
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("https://api.mercadopago.com")) return realFetch(url, init); // el test habla con el servidor local
  const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
  if (u.endsWith("/checkout/preferences")) return json(201, { id: "pref-1", init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1" });
  const id = u.split("/").pop();
  return pagos.has(id) ? json(200, pagos.get(id)) : json(404, { message: "not found" });
};

const { app, pedidos } = require("../examples/express");

async function conServidor(fn) {
  const server = app.listen(0);
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const post = (base, ruta, cuerpo) => realFetch(base + ruta, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo),
});

test("ejemplo Express: crea el pedido, devuelve el enlace y el aviso aprobado lo confirma una sola vez", async () => {
  await conServidor(async (base) => {
    const r = await post(base, "/pedidos", { total: 1500 });
    assert.equal(r.status, 200);
    const { id, initPoint } = await r.json();
    assert.match(initPoint, /^https:\/\/www\.mercadopago\.com\.ar\//);
    assert.equal(pedidos.get(id).status, "pending");

    // Un pago por menos plata NO confirma.
    pagos.set("111", { id: 111, status: "approved", external_reference: `order:${id}`, currency_id: "ARS", transaction_amount: 1 });
    await post(base, "/mp/webhook?type=payment&data.id=111", {});
    assert.equal(pedidos.get(id).status, "pending");

    // El pago correcto sí.
    pagos.set("112", { id: 112, status: "approved", external_reference: `order:${id}`, currency_id: "ARS", transaction_amount: 1500 });
    const aviso = await post(base, "/mp/webhook?type=payment&data.id=112", {});
    assert.equal(aviso.status, 200);
    assert.deepEqual([pedidos.get(id).status, pedidos.get(id).paymentId], ["confirmed", "112"]);
  });
});

test("ejemplo Express: valida el total y responde 502 (pedido cancelado) si Mercado Pago falla", async () => {
  await conServidor(async (base) => {
    assert.equal((await post(base, "/pedidos", { total: -5 })).status, 400);

    const anterior = globalThis.fetch;
    globalThis.fetch = async (url, init) => String(url).includes("mercadopago")
      ? { ok: false, status: 400, json: async () => ({ message: "invalid_items" }) }
      : realFetch(url, init);
    try {
      const r = await post(base, "/pedidos", { total: 100 });
      assert.equal(r.status, 502);
      const ultimo = [...pedidos.values()].at(-1);
      assert.equal(ultimo.status, "cancelled");
    } finally { globalThis.fetch = anterior; }
  });
});
