"use strict";
// API de Orders: armado de la orden, cliente, traducción a "pago", reglas y aviso.
const test = require("node:test");
const assert = require("node:assert/strict");
const mp = require("../src");
const { nextOrdersWebhook } = require("../adapters/next-orders");

const BACK = {
  success: "https://tienda.com/?mp=ok",
  failure: "https://tienda.com/?mp=error",
  pending: "https://tienda.com/?mp=pendiente",
};

test("toAmount: texto con dos decimales y rechaza montos inválidos", () => {
  assert.equal(mp.toAmount(80000), "80000.00");
  assert.equal(mp.toAmount("1500.5"), "1500.50");
  assert.equal(mp.toAmount(0.105), "0.11");
  for (const v of [0, -1, "abc", NaN, null]) assert.throws(() => mp.toAmount(v));
});

test("buildOrder: arma la orden de Checkout Pro según la documentación", () => {
  const o = mp.buildOrder({
    reference: "servicio:12",
    items: [{ id: 1, title: "Plan Web - 1 mes", quantity: 1, unitPrice: 80000 }, { id: 2, title: "Extra", quantity: 3, unitPrice: 10.1 }],
    backUrls: BACK,
    payerEmail: "ana@example.com",
  });
  assert.equal(o.type, "online");
  assert.equal(o.processing_mode, "manual");
  assert.equal(o.external_reference, "servicio:12");
  assert.equal(o.total_amount, "80030.30"); // suma exacta de los items
  assert.deepEqual(o.items[0], { external_code: "1", title: "Plan Web - 1 mes", quantity: 1, unit_price: "80000.00" });
  assert.deepEqual(o.config.online, {
    success_url: BACK.success, failure_url: BACK.failure, pending_url: BACK.pending, auto_return: "approved",
  });
  assert.deepEqual(o.payer, { email: "ana@example.com" });
  assert.equal(o.expiration_time, undefined);
});

test("buildOrder: sin https no pide vuelta automática; valida todo", () => {
  const local = { success: "http://localhost/?ok", failure: "http://localhost/?e", pending: "http://localhost/?p" };
  const o = mp.buildOrder({ reference: "x:1", items: [{ title: "A", unitPrice: 1 }], backUrls: local, payerEmail: "no-mail" });
  assert.equal(o.config.online.auto_return, undefined);
  assert.equal(o.payer, undefined);
  assert.throws(() => mp.buildOrder({ reference: "", items: [{ unitPrice: 1 }], backUrls: BACK }));
  assert.throws(() => mp.buildOrder({ reference: "x:1", items: [], backUrls: BACK }));
  assert.throws(() => mp.buildOrder({ reference: "x:1", items: [{ unitPrice: 0 }], backUrls: BACK }));
  assert.throws(() => mp.buildOrder({ reference: "x:1", items: [{ unitPrice: 1 }], backUrls: { success: "x" } }));
});

function fakeFetch(handler) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const [status, data] = handler(url, init);
    return { ok: status < 300, status, json: async () => data };
  };
  return { fetch, calls };
}

test("createOrdersClient: crea la orden con idempotencia y el token solo en el encabezado", async () => {
  const { fetch, calls } = fakeFetch(() => [201, { id: "ORD01ABC", status: "created", checkout_url: "https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD01ABC" }]);
  const c = mp.createOrdersClient({ accessToken: "APP_USR-x", fetch });
  const r = await c.createOrder({ a: 1 }, { idempotencyKey: "servicio-1" });
  assert.deepEqual(r, { id: "ORD01ABC", checkoutUrl: "https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD01ABC", status: "created" });
  assert.equal(calls[0].url, "https://api.mercadopago.com/v1/orders");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer APP_USR-x");
  assert.equal(calls[0].init.headers["X-Idempotency-Key"], "servicio-1");
  assert.ok(!calls[0].url.includes("APP_USR") && !calls[0].init.body.includes("APP_USR"));

  await assert.rejects(c.createOrder({}, {}), TypeError); // idempotencia obligatoria
  await assert.rejects(c.createOrder({}, { idempotencyKey: "x".repeat(129) }), TypeError);
});

test("createOrdersClient: errores de Mercado Pago y consulta de órdenes", async () => {
  const { fetch } = fakeFetch((url) => {
    if (url.endsWith("/v1/orders")) return [400, { errors: [{ code: "order_items_total_amount_mismatch" }] }];
    if (url.endsWith("/ORD404")) return [404, {}];
    if (url.endsWith("/ORDINVENTADO")) return [400, { errors: [{ code: "invalid_path_param" }] }];
    if (url.endsWith("/ORD500")) return [500, {}];
    return [200, { id: "ORD1" }];
  });
  const c = mp.createOrdersClient({ accessToken: "t", fetch });
  await assert.rejects(c.createOrder({}, { idempotencyKey: "k" }), (e) => e.code === "MP_ORDER" && e.status === 400 && e.detail === "order_items_total_amount_mismatch");
  assert.deepEqual(await c.getOrder("ORD1"), { id: "ORD1" });
  assert.equal(await c.getOrder("ORD404"), null);
  assert.equal(await c.getOrder("ORDINVENTADO"), null); // 400 invalid_path_param: no se reintenta
  assert.equal(await c.getOrder("../payments/1"), null); // id con formato raro: ni se consulta
  await assert.rejects(c.getOrder("ORD500"), (e) => e.code === "MP_ORDER");
  assert.throws(() => mp.createOrdersClient({}), TypeError);
});

const orden = (extra) => ({
  id: "ORD1", external_reference: "servicio:7", currency: "ARS", total_amount: "80000.00",
  total_paid_amount: "80000.00", status: "processed", status_detail: "accredited", ...extra,
});

test("orderAsPayment: solo processed + accredited + pagado completo cuenta como aprobado", () => {
  assert.deepEqual(mp.orderAsPayment(orden()), {
    id: "ORD1", status: "approved", external_reference: "servicio:7", currency_id: "ARS", transaction_amount: 80000,
  });
  assert.equal(mp.orderAsPayment(orden({ total_paid_amount: "1.00" })).status, "processed/accredited");
  assert.equal(mp.orderAsPayment(orden({ status: "created", status_detail: "created", total_paid_amount: "0.00" })).status, "created/created");
  assert.equal(mp.orderAsPayment(orden({ status: "processing", status_detail: "in_process" })).status, "processing/in_process");
  assert.equal(mp.orderAsPayment(orden({ status: "failed", status_detail: "rejected_by_issuer" })).status, "failed/rejected_by_issuer");
  assert.equal(mp.orderAsPayment(orden({ status: "refunded", status_detail: "refunded" })).status, "refunded");
  assert.equal(mp.orderAsPayment(orden({ status: "processed", status_detail: "charged_back" })).status, "refunded");
  assert.equal(mp.orderAsPayment(orden({ status: "processed", status_detail: "partially_refunded" })).status, "processed/partially_refunded");
});

function memoriaStore(inicial) {
  const filas = new Map([[inicial.id, { ...inicial }]]);
  return {
    filas,
    load: async (id) => filas.get(id) || null,
    save: async (id, patch) => Object.assign(filas.get(id), patch),
  };
}

test("processOrderNotification: confirma con processOrderPayment y respeta monto y referencia", async () => {
  const ordenes = new Map();
  const client = { getOrder: async (id) => ordenes.get(id) || null };
  const store = memoriaStore({ id: 7, amount: 80000, status: "pending", paymentId: null });
  const handlers = { servicio: (ctx) => mp.processOrderPayment({ ...ctx, store }) };

  ordenes.set("ORD-MENOS", orden({ id: "ORD-MENOS", total_amount: "100.00", total_paid_amount: "100.00" }));
  assert.equal((await mp.processOrderNotification({ client, orderId: "ORD-MENOS", handlers })).reason, "monto distinto");
  ordenes.set("ORD-OTRA", orden({ id: "ORD-OTRA", external_reference: "order:7" }));
  assert.equal((await mp.processOrderNotification({ client, orderId: "ORD-OTRA", handlers })).reason, "tipo sin manejador");
  assert.equal((await mp.processOrderNotification({ client, orderId: "NO-EXISTE", handlers })).reason, "orden inexistente");
  assert.equal(store.filas.get(7).status, "pending");

  ordenes.set("ORD-OK", orden({ id: "ORD-OK" }));
  const r = await mp.processOrderNotification({ client, orderId: "ORD-OK", handlers });
  assert.equal(r.patch.status, "confirmed");
  assert.equal(store.filas.get(7).paymentId, "ORD-OK");
});

test("aviso de órdenes: acepta order/orders/orders_v2, ignora lo demás, frena repetidos", async () => {
  const procesadas = [];
  const POST = nextOrdersWebhook({ isEnabled: () => true, process: async (_req, id) => { procesadas.push(id); } });
  const req = (qs, body = {}) => new Request(`https://x.com/api/mp/webhook${qs}`, { method: "POST", body: JSON.stringify(body) });

  assert.equal((await POST(req("?type=order&data.id=ORD01A"))).status, 200);
  assert.equal((await POST(req("", { type: "orders_v2", action: "order.processed", data: { id: "ORD01B" } }))).status, 200);
  assert.equal((await POST(req("?topic=orders&id=ORD01C"))).status, 200);
  await POST(req("?type=order&data.id=ORD01A")); // repetido en segundos: no se vuelve a consultar
  await POST(req("?type=payment&data.id=123"));   // aviso de pago (Preferences): se ignora
  await POST(req("?type=order&data.id=../../x")); // id inválido
  assert.deepEqual(procesadas, ["ORD01A", "ORD01B", "ORD01C"]);

  const apagado = nextOrdersWebhook({ isEnabled: () => false, process: async () => {} });
  assert.equal((await apagado(req("?type=order&data.id=ORD9"))).status, 503);
  const roto = nextOrdersWebhook({ isEnabled: () => true, process: async () => { throw new Error("base caída"); } });
  assert.equal((await roto(req("?type=order&data.id=ORD10"))).status, 500); // Mercado Pago reintenta
});
