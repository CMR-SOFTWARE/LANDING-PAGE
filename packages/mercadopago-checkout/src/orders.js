"use strict";

// Checkout Pro con la API de ORDERS de Mercado Pago (la recomendada para integraciones nuevas).
// La API de Preferences (preference.js / client.js) sigue en el módulo para las apps que ya la usan.
//
// Diferencias con Preferences (documentación oficial "Checkout Pro via Orders"):
//   crear:      POST /v1/orders  { type: "online", processing_mode: "manual", ... }  -> checkout_url
//   montos:     TEXTO con dos decimales ("80000.00")
//   consultar:  GET /v1/orders/{id}   (id alfanumérico, ej. "ORD01J49MMW3SSBK5PSV3DFR32959")
//   pagado:     status "processed" + status_detail "accredited"
//   aviso:      llega con el id de la ORDEN; la URL del aviso se configura en el panel de Mercado Pago
//               (Tus integraciones -> la app -> Webhooks), porque la documentación no nombra un campo
//               de la orden para eso.
//
// Lo que NO está verificado con un pago real: el nombre exacto del tema del aviso ("order",
// "orders" u "orders_v2": la documentación usa los dos últimos) y el formato del aviso. Por eso se
// aceptan los tres y se usa solo el id: el estado real SIEMPRE se le pregunta a Mercado Pago.

const { MercadoPagoError } = require("./client");
const { normalizeBaseUrl } = require("./preference");
const { buildReference, parseReference } = require("./references");

const API = "https://api.mercadopago.com";
const ORDER_ID = /^[A-Za-z0-9_-]{1,64}$/;

// La API de Orders RECHAZA ":" en external_reference (visto en la primera prueba real:
// "property_value: Invalid value for property: '$.external_reference' - does not match pattern").
// Hacia Mercado Pago se manda "servicio-12"; al volver se traduce a "servicio:12", el formato que
// usan las reglas del módulo. El tipo no puede tener "-", así que la traducción no es ambigua.
const ORDER_REFERENCE = /^([a-z][a-z0-9_]{0,19})-([0-9]{1,15})$/;

function toOrderReference(reference) {
  const parsed = parseReference(reference);
  if (!parsed) throw new TypeError(`referencia inválida "${reference}" (se espera "tipo:id").`);
  return `${parsed.kind}-${parsed.id}`;
}

function fromOrderReference(externalReference) {
  const m = ORDER_REFERENCE.exec(String(externalReference ?? ""));
  return m ? `${m[1]}:${m[2]}` : String(externalReference ?? "");
}

// 80000 -> "80000.00". Lanza si no es un monto positivo.
function toAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new TypeError(`monto inválido "${value}".`);
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * Arma el cuerpo de POST /v1/orders para Checkout Pro. Función pura (sin red).
 * @param {object} o
 * @param {string} o.reference   referencia "tipo:id" (buildReference), ej. "servicio:12".
 *                               A Mercado Pago viaja como "servicio-12" (ver toOrderReference).
 * @param {Array}  o.items       [{ id, title, quantity, unitPrice }] con precios SACADOS DE TU BASE
 * @param {object} o.backUrls    { success, failure, pending }
 * @param {string} [o.payerEmail]
 * @param {string} [o.expiration] duración ISO 8601 de la orden, ej. "P1D" (opcional)
 */
function buildOrder({ reference, items, backUrls, payerEmail, expiration }) {
  if (!parseReference(reference)) throw new TypeError("buildOrder: reference inválida (se espera \"tipo:id\").");
  if (!Array.isArray(items) || !items.length) throw new TypeError("buildOrder: no hay productos.");
  for (const k of ["success", "failure", "pending"]) {
    if (!normalizeBaseUrl(backUrls?.[k])) throw new TypeError(`buildOrder: backUrls.${k} inválida.`);
  }

  let totalCents = 0;
  const lines = items.map((it) => {
    const quantity = Math.max(1, Math.trunc(Number(it.quantity) || 1));
    let unit;
    try { unit = toAmount(it.unitPrice); } catch (_) { throw new TypeError(`buildOrder: precio inválido en "${it.title}".`); }
    totalCents += Math.round(Number(unit) * 100) * quantity;
    return {
      external_code: String(it.id ?? ""),
      title: String(it.title || "Producto").slice(0, 250),
      quantity,
      unit_price: unit,
    };
  });

  const online = {
    success_url: backUrls.success,
    failure_url: backUrls.failure,
    pending_url: backUrls.pending,
  };
  // Igual que en Preferences: la vuelta automática solo con https.
  if (String(backUrls.success).startsWith("https://")) online.auto_return = "approved";

  const order = {
    type: "online",
    processing_mode: "manual",
    external_reference: toOrderReference(reference),
    total_amount: (totalCents / 100).toFixed(2), // debe ser la suma exacta de los items
    items: lines,
    config: { online },
  };
  const mail = String(payerEmail || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) order.payer = { email: mail };
  if (expiration) order.expiration_time = String(expiration);
  return order;
}

// Resume la respuesta de error de Mercado Pago para el log del servidor:
// { errors: [{ code, message, details: [...] }] } -> "required_properties: falta X (payer.email)".
function describeErrors(data) {
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((e) => [e.code, e.message, Array.isArray(e.details) ? e.details.join(", ") : null]
      .filter(Boolean).join(": ")).join(" | ").slice(0, 500);
  }
  return data?.message || data?.error || null;
}

// Cliente de la API de Orders. El token va SOLO en el encabezado Authorization.
function createOrdersClient({ accessToken, fetch: fetchImpl, timeoutMs = 15000 } = {}) {
  if (!accessToken) throw new TypeError("createOrdersClient: falta accessToken.");
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  async function call(path, { method = "GET", body, idempotencyKey } = {}) {
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;
    const res = await doFetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* sin cuerpo JSON */ }
    return { ok: res.ok, status: res.status, data };
  }

  return {
    // Crea la orden. idempotencyKey es OBLIGATORIA en esta API (1 a 128 caracteres).
    async createOrder(order, { idempotencyKey } = {}) {
      const key = String(idempotencyKey || "");
      if (!key || key.length > 128) throw new TypeError("createOrder: idempotencyKey obligatoria (1 a 128 caracteres).");
      const r = await call("/v1/orders", { method: "POST", body: order, idempotencyKey: key });
      if (!r.ok || !r.data?.id || !r.data?.checkout_url) {
        throw new MercadoPagoError(`Mercado Pago rechazó la orden (HTTP ${r.status}).`, {
          code: "MP_ORDER", status: r.status, detail: describeErrors(r.data),
        });
      }
      return { id: String(r.data.id), checkoutUrl: r.data.checkout_url, status: r.data.status };
    },

    // Devuelve la orden, o null si no existe (404) o el id no es válido (400 invalid_path_param,
    // visto en el preview con un id inventado). Reintentar esos casos no sirve de nada.
    // Cualquier otro error se lanza: el aviso responde 5xx y Mercado Pago reintenta.
    async getOrder(orderId) {
      if (!ORDER_ID.test(String(orderId))) return null;
      const r = await call(`/v1/orders/${encodeURIComponent(orderId)}`);
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok || !r.data) {
        throw new MercadoPagoError(`No se pudo consultar la orden (HTTP ${r.status}).`, { code: "MP_ORDER", status: r.status });
      }
      return r.data;
    },
  };
}

const REFUNDED = new Set(["refunded", "charged_back"]);

/**
 * Traduce una orden al formato de "pago" que entienden las reglas del módulo (evaluatePayment,
 * processOrderPayment, processHeldBookingPayment), así se reusan sin cambios todas sus protecciones:
 * referencia, moneda y monto; avisos repetidos; intentos viejos; reembolsos; cancelados.
 *
 *   pagada        status "processed" + detail "accredited" + total pagado >= total  -> "approved"
 *   reembolsada   status "refunded" o detail "refunded"/"charged_back"              -> "refunded"
 *   otra cosa     "<status>/<status_detail>" (no confirma ni cancela nada)
 */
function orderAsPayment(order) {
  const status = String(order?.status || "");
  const detail = String(order?.status_detail || "");
  const total = Number(order?.total_amount);
  const paid = Number(order?.total_paid_amount);

  let mapped = detail ? `${status}/${detail}` : status;
  if (status === "processed" && detail === "accredited" && Number.isFinite(paid) && paid + 0.01 >= total) {
    mapped = "approved";
  } else if (status === "refunded" || REFUNDED.has(detail)) {
    mapped = "refunded";
  }
  return {
    id: String(order?.id ?? ""),
    status: mapped,
    external_reference: fromOrderReference(order?.external_reference), // "servicio-7" -> "servicio:7"
    currency_id: order?.currency,
    transaction_amount: total, // lo que se le cobró a la orden; se compara con el monto de TU base
  };
}

/**
 * Consulta la orden y se la pasa al manejador según el tipo de la referencia. Mismo contrato que
 * processNotification (Preferences): handlers = { servicio: (ctx) => processOrderPayment({...ctx, store}) }.
 * ctx.payment es la orden traducida (orderAsPayment) y ctx.order la orden original.
 */
async function processOrderNotification({ client, orderId, handlers, warn = () => {} }) {
  const order = await client.getOrder(orderId);
  if (!order) return { ignored: true, reason: "orden inexistente" };

  const parsed = parseReference(fromOrderReference(order.external_reference));
  if (!parsed) return { ignored: true, reason: "sin referencia" };
  const handler = handlers?.[parsed.kind];
  if (!handler) return { ignored: true, reason: "tipo sin manejador" };

  return handler({
    payment: orderAsPayment(order),
    order,
    id: parsed.id,
    reference: buildReference(parsed.kind, parsed.id),
    warn,
  });
}

// El aviso: el id viene en la URL (?data.id=ORD...&type=order) o en el cuerpo ({ type, data: { id } }).
const ORDER_TOPICS = new Set(["order", "orders", "orders_v2"]);

function parseOrderNotification({ query, body } = {}) {
  const q = query || {};
  const b = body && typeof body === "object" ? body : {};
  const topic = String(q.type || q.topic || b.type || b.topic || "");
  const rawId = q["data.id"] ?? b?.data?.id ?? (ORDER_TOPICS.has(topic) ? q.id : undefined);
  return { topic, orderId: rawId == null ? "" : String(rawId) };
}

// Lógica del aviso, independiente del framework (igual que handleWebhook, pero para órdenes).
// Responde 200 a todo lo que no es una orden (así Mercado Pago no reintenta avisos ajenos).
async function handleOrderWebhook({ isEnabled, query, body, process, debouncer }) {
  if (!isEnabled()) return { status: 503, body: { error: "No disponible." } };

  const { topic, orderId } = parseOrderNotification({ query, body });
  if (!ORDER_TOPICS.has(topic) || !ORDER_ID.test(orderId)) return { status: 200, body: { ok: true, ignored: true } };
  if (debouncer?.seenRecently(orderId)) return { status: 200, body: { ok: true, repeated: true } };

  await process(orderId); // la app consulta la orden y actualiza su base
  return { status: 200, body: { ok: true } };
}

module.exports = {
  toAmount,
  toOrderReference,
  fromOrderReference,
  buildOrder,
  createOrdersClient,
  orderAsPayment,
  processOrderNotification,
  parseOrderNotification,
  handleOrderWebhook,
};
