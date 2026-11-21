"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mp = require("../src");
const { expressWebhook } = require("../adapters/express");
const { nextWebhook } = require("../adapters/next");

const fakeFetch = (status, data) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => data });

// ---------------------------------------------------------------- cliente
test("createClient: exige el token", () => {
  assert.throws(() => mp.createClient({}), TypeError);
});

test("createClient.createPreference devuelve id e initPoint; falla con error claro si Mercado Pago rechaza", async () => {
  const ok = mp.createClient({ accessToken: "t", fetch: fakeFetch(201, { id: "p1", init_point: "https://www.mercadopago.com.ar/x?pref_id=p1" }) });
  assert.deepEqual(await ok.createPreference({}), { id: "p1", initPoint: "https://www.mercadopago.com.ar/x?pref_id=p1" });

  const malo = mp.createClient({ accessToken: "t", fetch: fakeFetch(400, { message: "invalid_items" }) });
  await assert.rejects(malo.createPreference({}), (e) => e instanceof mp.MercadoPagoError && e.code === "MP_PREFERENCE" && e.status === 400 && e.detail === "invalid_items");
  const sinEnlace = mp.createClient({ accessToken: "t", fetch: fakeFetch(201, { id: "p1" }) });
  await assert.rejects(sinEnlace.createPreference({}), (e) => e.code === "MP_PREFERENCE");
});

test("createClient: el token va en Authorization, nunca en el cuerpo, y la clave de idempotencia se manda", async () => {
  let visto;
  const client = mp.createClient({
    accessToken: "SECRETO",
    fetch: async (url, init) => { visto = { url, init }; return { ok: true, status: 201, json: async () => ({ id: "p", init_point: "https://x" }) }; },
  });
  await client.createPreference({ items: [] }, { idempotencyKey: "pedido-77" });
  assert.equal(visto.url, "https://api.mercadopago.com/checkout/preferences");
  assert.equal(visto.init.headers.Authorization, "Bearer SECRETO");
  assert.equal(visto.init.headers["X-Idempotency-Key"], "pedido-77");
  assert.equal(String(visto.init.body).includes("SECRETO"), false);
});

test("createClient.getPayment: id inválido o 404 dan null; otros errores se lanzan", async () => {
  const c = (status, data) => mp.createClient({ accessToken: "t", fetch: fakeFetch(status, data) });
  assert.equal(await c(200, {}).getPayment("abc"), null);
  assert.equal(await c(200, {}).getPayment("../x"), null);
  assert.equal(await c(404, { message: "not found" }).getPayment("123"), null);
  assert.deepEqual(await c(200, { id: 123, status: "approved" }).getPayment("123"), { id: 123, status: "approved" });
  await assert.rejects(c(500, {}).getPayment("123"), (e) => e.code === "MP_PAYMENT");
});

// ---------------------------------------------------------------- aviso
test("parseNotification lee data.id del query o del cuerpo", () => {
  assert.deepEqual(mp.parseNotification({ query: { "data.id": "123", type: "payment" }, body: {} }), { topic: "payment", paymentId: "123" });
  assert.deepEqual(mp.parseNotification({ query: {}, body: { type: "payment", data: { id: 456 } } }), { topic: "payment", paymentId: "456" });
  assert.deepEqual(mp.parseNotification({ query: { topic: "payment", id: "789" } }), { topic: "payment", paymentId: "789" });
  assert.deepEqual(mp.parseNotification({}), { topic: "", paymentId: "" });
});

test("processNotification: deriva al manejador del tipo y le da la referencia canónica", async () => {
  const visto = [];
  const handlers = {
    order: async (ctx) => { visto.push(["order", ctx.id, ctx.reference]); return { ok: true }; },
    booking: async (ctx) => { visto.push(["booking", ctx.id, ctx.reference]); return { ok: true }; },
  };
  const llamar = (ref, h = handlers) => mp.processNotification({
    client: { getPayment: async () => ({ id: 1, external_reference: ref }) }, paymentId: "1", handlers: h,
  });
  await llamar("order:5");
  await llamar("booking:7");
  assert.deepEqual(visto, [["order", 5, "order:5"], ["booking", 7, "booking:7"]]);
  assert.equal((await llamar("otra-cosa")).ignored, true);
  assert.equal((await llamar("booking:7", { order: handlers.order })).ignored, true);
  assert.equal((await mp.processNotification({ client: { getPayment: async () => null }, paymentId: "1", handlers })).ignored, true);
});

test("processNotification: una referencia con ceros no pasa como la canónica (no coincide con el pago)", async () => {
  let recibido;
  await mp.processNotification({
    client: { getPayment: async () => ({ id: 1, external_reference: "order:007" }) }, paymentId: "1",
    handlers: { order: async (ctx) => { recibido = ctx.reference; } },
  });
  assert.equal(recibido, "order:7"); // distinto de "order:007": evaluatePayment lo rechazará
});

test("createDebouncer: el mismo id repetido en la ventana se descarta", () => {
  const d = mp.createDebouncer({ windowMs: 60000 });
  assert.equal(d.seenRecently("1"), false);
  assert.equal(d.seenRecently("1"), true);
  assert.equal(d.seenRecently("2"), false);
});

// ---------------------------------------------------------------- webhook y adaptadores
const habilitado = () => true;

test("handleWebhook: 503 si está apagado; ignora lo que no es un pago; procesa un pago", async () => {
  const procesados = [];
  const process = async (id) => { procesados.push(id); };
  assert.equal((await mp.handleWebhook({ isEnabled: () => false, query: {}, body: {}, process })).status, 503);
  for (const query of [{}, { type: "merchant_order", "data.id": "1" }, { type: "payment", "data.id": "abc" }, { type: "payment" }]) {
    const r = await mp.handleWebhook({ isEnabled: habilitado, query, body: {}, process });
    assert.deepEqual([r.status, r.body.ignored], [200, true], JSON.stringify(query));
  }
  assert.deepEqual(procesados, []);
  const ok = await mp.handleWebhook({ isEnabled: habilitado, query: { type: "payment", "data.id": "555" }, body: {}, process });
  assert.deepEqual([ok.status, ok.body.ok, procesados], [200, true, ["555"]]);
});

test("handleWebhook: el mismo aviso repetido no se procesa dos veces", async () => {
  let n = 0;
  const debouncer = mp.createDebouncer({ windowMs: 60000 });
  const args = { isEnabled: habilitado, query: { type: "payment", "data.id": "9" }, body: {}, process: async () => { n++; }, debouncer };
  await mp.handleWebhook(args);
  const segundo = await mp.handleWebhook(args);
  assert.equal(n, 1);
  assert.equal(segundo.body.repeated, true);
});

test("adaptador Express: traduce pedido y respuesta, y manda los errores a next() (Mercado Pago reintenta)", async () => {
  const vistos = [];
  const handler = expressWebhook({ isEnabled: habilitado, process: async (req, id) => { vistos.push([req.marca, id]); } });
  const res = () => { const r = { status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };

  const r1 = res();
  await handler({ marca: "A", query: { type: "payment", "data.id": "77" }, body: {} }, r1, assert.fail);
  assert.deepEqual([r1.code, r1.body, vistos], [200, { ok: true }, [["A", "77"]]]);

  let error;
  const falla = expressWebhook({ isEnabled: habilitado, process: async () => { throw new Error("base caída"); }, debouncer: { seenRecently: () => false } });
  await falla({ query: { type: "payment", "data.id": "78" }, body: {} }, res(), (e) => { error = e; });
  assert.match(error.message, /base caída/);
});

test("adaptador Next.js: usa Request/Response reales, lee la URL y el cuerpo, y responde 500 si falla", async () => {
  const vistos = [];
  const POST = nextWebhook({ isEnabled: habilitado, process: async (request, id) => { vistos.push([new URL(request.url).pathname, id]); } });

  const porUrl = await POST(new Request("https://x.com/api/mp/webhook?data.id=77&type=payment", { method: "POST" }));
  assert.deepEqual([porUrl.status, await porUrl.json()], [200, { ok: true }]);
  const porCuerpo = await POST(new Request("https://x.com/api/mp/webhook", { method: "POST", body: JSON.stringify({ type: "payment", data: { id: 88 } }) }));
  assert.equal(porCuerpo.status, 200);
  assert.deepEqual(vistos, [["/api/mp/webhook", "77"], ["/api/mp/webhook", "88"]]);

  const ignorado = await POST(new Request("https://x.com/api/mp/webhook?type=merchant_order", { method: "POST" }));
  assert.equal((await ignorado.json()).ignored, true);

  const falla = nextWebhook({ isEnabled: habilitado, process: async () => { throw new Error("base caída"); }, debouncer: { seenRecently: () => false } });
  const original = console.error; console.error = () => {};
  try { assert.equal((await falla(new Request("https://x.com/w?type=payment&data.id=9", { method: "POST" }))).status, 500); }
  finally { console.error = original; }
});

// ---------------------------------------------------------------- configuración
test("isEnabled: depende de MP_ACCESS_TOKEN", () => {
  assert.equal(mp.isEnabled({}), false);
  assert.equal(mp.isEnabled({ MP_ACCESS_TOKEN: "  " }), false);
  assert.equal(mp.isEnabled({ MP_ACCESS_TOKEN: "APP_USR-x" }), true);
});

test("resolveBaseUrl: usa la URL fija; si no, la arma con los encabezados (objeto de Express o Headers de Next)", () => {
  assert.equal(mp.resolveBaseUrl({ fixedUrl: "https://www.mitienda.com/", headers: {} }), "https://www.mitienda.com");
  assert.equal(mp.resolveBaseUrl({ headers: { host: "tienda.com" } }), "https://tienda.com");
  assert.equal(mp.resolveBaseUrl({ headers: { "x-forwarded-host": "real.com, otro.com", "x-forwarded-proto": "https", host: "interno" } }), "https://real.com");
  assert.equal(mp.resolveBaseUrl({ headers: { host: "localhost:3000" } }), "http://localhost:3000");
  assert.equal(mp.resolveBaseUrl({ headers: new Headers({ host: "next.com" }) }), "https://next.com");
  assert.equal(mp.resolveBaseUrl({ fixedUrl: "javascript:x", headers: {} }), "");
});
