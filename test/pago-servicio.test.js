// Pago de servicios con Mercado Pago (API de Orders), de punta a punta, con Mercado Pago y Supabase
// SIMULADOS. Llama a los mismos handlers que publica Vercel (api/checkout.js y api/mp/webhook.js).
// Modelo: packages/mercadopago-checkout/test/example-express.test.js
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import * as checkout from "../api/checkout.js";
import * as webhook from "../api/mp/webhook.js";
import { procesarAviso } from "../api/_lib/contrataciones.js";
import { dependencias } from "../api/_lib/runtime.js";

const SUPABASE = "https://simulado.supabase.co";
const ENV = {
  MP_ACCESS_TOKEN: "APP_USR-test",
  PUBLIC_BASE_URL: "https://cmrsoftwaresolutions.com",
  SUPABASE_URL: SUPABASE,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-simulada",
};

// ---------- Base simulada (imita PostgREST) ----------
let servicios, contrataciones, proximoId, parches;
// ---------- Mercado Pago simulado (API de Orders) ----------
let ordenes, ordenesCreadas, idempotencias, mpFalla, mpCheckoutUrl, mpCuotasVendedor;
let ordenesTotales = 0; // no se reinicia entre tests

beforeEach(() => {
  Object.assign(process.env, ENV);
  servicios = [
    { id: 1, slug: "plan-web", nombre: "Plan Web", precio: 80000, activo: true },
    { id: 2, slug: "plan-gestion", nombre: "Plan Gestión", precio: 140000, activo: true },
    { id: 3, slug: "plan-viejo", nombre: "Plan Viejo", precio: 50000, activo: false },
  ];
  contrataciones = new Map();
  proximoId = 100;
  parches = [];
  ordenes = new Map();
  ordenesCreadas = [];
  idempotencias = [];
  mpFalla = false;
  mpCuotasVendedor = false;
  mpCheckoutUrl = "https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=";
});

const respuesta = (status, data) => ({ ok: status < 300, status, json: async () => data });

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const method = init.method || "GET";
  const body = init.body ? JSON.parse(init.body) : undefined;

  if (u.origin === "https://api.mercadopago.com") {
    assert.equal(init.headers.Authorization, "Bearer APP_USR-test"); // el token solo va en el encabezado
    if (u.pathname === "/v1/orders" && method === "POST") {
      if (mpFalla) return respuesta(500, { message: "internal_error" });
      idempotencias.push(init.headers["X-Idempotency-Key"]);
      // Id único en TODO el archivo: si se repitiera entre tests, el freno de avisos repetidos
      // (3 s) se saltearía el aviso y un test podría pasar sin probar nada.
      const id = `ORDTST${String(++ordenesTotales).padStart(4, "0")}`;
      const orden = {
        id, status: "created", status_detail: "created", currency: "ARS",
        total_paid_amount: "0.00", ...body,
      };
      ordenesCreadas.push(body);
      ordenes.set(id, orden);
      const config = mpCuotasVendedor
        ? { ...orden.config, payment_method: { ...orden.config?.payment_method, installments_cost: "seller" } }
        : orden.config;
      return respuesta(201, { ...orden, config, checkout_url: mpCheckoutUrl + id });
    }
    const id = u.pathname.replace("/v1/orders/", "");
    return ordenes.has(id) ? respuesta(200, ordenes.get(id)) : respuesta(404, { message: "order_not_found" });
  }

  if (u.origin === SUPABASE) {
    assert.equal(init.headers.apikey, "service-role-simulada");
    const tabla = u.pathname.replace("/rest/v1/", "");
    const eq = (campo) => (u.searchParams.get(campo) || "").replace(/^eq\./, "");
    if (tabla === "servicios" && method === "GET") {
      return respuesta(200, servicios.filter((s) => s.slug === eq("slug")));
    }
    if (tabla === "contrataciones") {
      if (method === "POST") {
        const row = { id: proximoId++, mp_order_id: null, paid_at: null, ...body };
        contrataciones.set(row.id, row);
        return respuesta(201, [row]);
      }
      const row = contrataciones.get(Number(eq("id")));
      if (method === "GET") return respuesta(200, row ? [row] : []);
      if (method === "PATCH") {
        if (row) { Object.assign(row, body); parches.push({ id: row.id, ...body }); }
        return respuesta(200, row ? [row] : []);
      }
      if (method === "DELETE") throw new Error("NUNCA se borra una contratación");
    }
  }
  throw new Error(`fetch no simulado: ${method} ${u}`);
};

// ---------- Ayudas ----------
const pedir = (cuerpo) => checkout.POST(new Request("https://cmrsoftwaresolutions.com/api/checkout", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo),
}));
const avisar = (orderId) => webhook.POST(new Request(
  `https://cmrsoftwaresolutions.com/api/mp/webhook?type=order&data.id=${orderId}`,
  { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
));
async function contratar(servicio = "plan-web", extra = {}) {
  const r = await pedir({ servicio, nombre: "Ana Pérez", email: "ana@example.com", ...extra });
  assert.equal(r.status, 200);
  return r.json();
}
const ordenDe = (contratacionId) => contrataciones.get(contratacionId).mp_order_id;
// Mercado Pago cambia el estado de la orden (lo que pasaría al pagar, reembolsar, etc.).
function mpActualiza(orderId, cambios) {
  Object.assign(ordenes.get(orderId), cambios);
}
const ACREDITADA = (monto) => ({ status: "processed", status_detail: "accredited", total_paid_amount: monto });
let siguienteOrdenAjena = 1;
function ordenAjena({ ref, monto, ...resto }) {
  const id = `ORDAJENA${siguienteOrdenAjena++}`; // ids distintos: el freno de avisos repetidos no interfiere
  ordenes.set(id, { id, external_reference: ref, currency: "ARS", total_amount: monto, ...ACREDITADA(monto), ...resto });
  return id;
}

// ---------- Tests ----------
test("crea la contratación PENDIENTE y la ORDEN con el precio de la BASE, no el del navegador", async () => {
  const { id, checkoutUrl } = await contratar("plan-web", { precio: 1, monto: 1, total: 1 });
  assert.match(checkoutUrl, /^https:\/\/www\.mercadopago\.com\.ar\//);

  const c = contrataciones.get(id);
  assert.equal(c.estado, "pendiente");
  assert.equal(c.monto, 80000);
  assert.match(c.mp_order_id, /^ORDTST\d{4}$/);
  assert.equal(c.mp_status, "created");

  const orden = ordenesCreadas[0];
  assert.equal(orden.type, "online");
  assert.equal(orden.processing_mode, "manual");
  assert.equal(orden.external_reference, `servicio-${id}`); // Orders no acepta ":"
  assert.equal(orden.total_amount, "80000.00");
  assert.equal(orden.items[0].unit_price, "80000.00");
  assert.equal(orden.config.online.success_url, `https://cmrsoftwaresolutions.com/?mp=ok&contratacion=${id}&servicio=plan-web`);
  assert.equal(orden.config.online.pending_url, `https://cmrsoftwaresolutions.com/?mp=pendiente&contratacion=${id}&servicio=plan-web`);
  assert.deepEqual(orden.payer, { email: "ana@example.com" });
  assert.deepEqual(orden.config.payment_method, { max_installments: 1 }); // un mes se paga en una cuota
  assert.ok(!JSON.stringify(orden).includes("interest_free"));            // nunca cuotas sin interés
  assert.deepEqual(idempotencias, [`servicio-${id}`]);
});

test("orden acreditada confirma UNA sola vez y el aviso repetido no duplica nada", async () => {
  const { id } = await contratar();
  const oid = ordenDe(id);

  // Aviso apenas creada (todavía sin pagar): no confirma.
  await avisar(oid);
  assert.equal(contrataciones.get(id).estado, "pendiente");

  mpActualiza(oid, ACREDITADA("80000.00"));
  const { client, db } = dependencias();
  await procesarAviso({ client, db, orderId: oid, warn: () => {} });
  const c = contrataciones.get(id);
  assert.deepEqual([c.estado, c.mp_order_id, c.mp_status], ["confirmada", oid, "approved"]);
  const pagadoEn = c.paid_at;
  assert.ok(pagadoEn);

  // Mercado Pago repite el aviso: por la ruta y directo a la lógica (sin el freno de repetidos).
  assert.equal((await avisar(oid)).status, 200);
  await procesarAviso({ client, db, orderId: oid, warn: () => {} });
  await procesarAviso({ client, db, orderId: oid, warn: () => {} });

  assert.equal(contrataciones.get(id).estado, "confirmada");
  assert.equal(contrataciones.get(id).paid_at, pagadoEn); // la fecha de pago no se pisa
  assert.equal(parches.filter((p) => p.id === id && p.estado === "confirmada").length, 1);
});

test("un pago por MENOS plata no confirma", async () => {
  const { id } = await contratar();
  // La orden de esta contratación figura acreditada pero con menos plata pagada.
  mpActualiza(ordenDe(id), ACREDITADA("79999.00"));
  await avisar(ordenDe(id));
  // Una orden ajena con la referencia correcta pero total menor.
  await avisar(ordenAjena({ ref: `servicio-${id}`, monto: "1.00" }));
  assert.equal(contrataciones.get(id).estado, "pendiente");
});

test("una orden con la referencia de OTRO registro no confirma este", async () => {
  const web = await contratar("plan-web");
  const gestion = await contratar("plan-gestion");

  // Paga lo del Plan Web pero la referencia apunta a la contratación del Plan Gestión.
  await avisar(ordenAjena({ ref: `servicio-${gestion.id}`, monto: "80000.00" }));
  // Referencia de otro tipo (otra app) con el id y el monto correctos.
  await avisar(ordenAjena({ ref: `order-${web.id}`, monto: "80000.00" }));
  // Referencia a una contratación que no existe.
  await avisar(ordenAjena({ ref: "servicio-999999", monto: "80000.00" }));
  // Moneda distinta.
  await avisar(ordenAjena({ ref: `servicio-${web.id}`, monto: "80000.00", currency: "USD" }));

  assert.equal(contrataciones.get(web.id).estado, "pendiente");
  assert.equal(contrataciones.get(gestion.id).estado, "pendiente");
});

test("orden rechazada o en proceso no confirma; un reembolso posterior cancela (sin borrar)", async () => {
  const { id } = await contratar();
  const oid = ordenDe(id);
  const { client, db } = dependencias();
  const aviso = () => procesarAviso({ client, db, orderId: oid, warn: () => {} });

  mpActualiza(oid, { status: "processing", status_detail: "in_process" });
  await aviso();
  mpActualiza(oid, { status: "failed", status_detail: "rejected_by_issuer" });
  await aviso();
  assert.equal(contrataciones.get(id).estado, "pendiente");

  mpActualiza(oid, ACREDITADA("80000.00"));
  await aviso();
  assert.equal(contrataciones.get(id).estado, "confirmada");

  mpActualiza(oid, { status: "refunded", status_detail: "refunded" });
  await aviso();
  assert.equal(contrataciones.get(id).estado, "cancelada");
  assert.ok(contrataciones.has(id));
});

test("si Mercado Pago está caído: 502 y la contratación queda CANCELADA, no borrada", async () => {
  mpFalla = true;
  const r = await pedir({ servicio: "plan-gestion", nombre: "Ana Pérez", email: "ana@example.com" });
  assert.equal(r.status, 502);
  const [c] = [...contrataciones.values()];
  assert.ok(c, "la contratación sigue existiendo");
  assert.deepEqual([c.estado, c.monto, c.mp_status], ["cancelada", 140000, "order_error: 500 internal_error"]);
});

test("si Mercado Pago devuelve un enlace fuera de su dominio: 502 y cancelada", async () => {
  mpCheckoutUrl = "https://mercadopago.com.ar.estafa.com/pagar?id=";
  const r = await pedir({ servicio: "plan-web", nombre: "Ana Pérez", email: "ana@example.com" });
  assert.equal(r.status, 502);
  assert.equal([...contrataciones.values()][0].estado, "cancelada");
});

test("valida el pedido: servicio inexistente o inactivo, datos faltantes, cuerpo roto", async () => {
  assert.equal((await pedir({ servicio: "plan-inventado", nombre: "Ana", email: "ana@example.com" })).status, 404);
  assert.equal((await pedir({ servicio: "plan-viejo", nombre: "Ana", email: "ana@example.com" })).status, 404);
  assert.equal((await pedir({ servicio: "plan-web", nombre: "", email: "ana@example.com" })).status, 400);
  assert.equal((await pedir({ servicio: "plan-web", nombre: "Ana", email: "no-es-mail" })).status, 400);
  assert.equal((await pedir({ servicio: "../servicios", nombre: "Ana", email: "ana@example.com" })).status, 400);
  const roto = await checkout.POST(new Request("https://x.com/api/checkout", { method: "POST", body: "{no json" }));
  assert.equal(roto.status, 400);
  assert.equal(contrataciones.size, 0);
  assert.equal(ordenesCreadas.length, 0);
});

test("el aviso ignora pagos de la API vieja y ids inválidos", async () => {
  const { id } = await contratar();
  mpActualiza(ordenDe(id), ACREDITADA("80000.00"));
  const ruta = (qs) => webhook.POST(new Request(`https://x.com/api/mp/webhook${qs}`, { method: "POST", body: "{}" }));
  assert.equal((await ruta(`?type=payment&data.id=123`)).status, 200);
  assert.equal((await ruta(`?type=order&data.id=../../x`)).status, 200);
  assert.equal(contrataciones.get(id).estado, "pendiente");
});

test("sin MP_ACCESS_TOKEN todo queda apagado", async () => {
  delete process.env.MP_ACCESS_TOKEN;
  assert.deepEqual(await checkout.GET().json(), { enabled: false });
  assert.equal((await pedir({ servicio: "plan-web", nombre: "Ana", email: "ana@example.com" })).status, 503);
  assert.equal((await avisar("ORD123")).status, 503);
  assert.equal(contrataciones.size, 0);

  process.env.MP_ACCESS_TOKEN = "APP_USR-test";
  assert.deepEqual(await checkout.GET().json(), { enabled: true });
});

test("si Mercado Pago indica cuotas a cargo del vendedor: se vende igual pero queda marcado", async () => {
  mpCuotasVendedor = true;
  const { id, checkoutUrl } = await contratar();
  assert.ok(checkoutUrl);
  const c = contrataciones.get(id);
  assert.equal(c.estado, "pendiente");
  assert.equal(c.mp_status, "created | cuotas a cargo del vendedor");
});
