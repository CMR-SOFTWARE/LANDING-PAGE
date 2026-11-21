"use strict";

// Cliente mínimo de la API de Mercado Pago: solo las dos llamadas que usa Checkout Pro.
//
//   const client = createClient({ accessToken: process.env.MP_ACCESS_TOKEN });
//   const { id, initPoint } = await client.createPreference(preference);
//   const payment = await client.getPayment("123456");   // null si no existe
//
// El Access Token es secreto: vive SOLO en el servidor.

const API = "https://api.mercadopago.com";

class MercadoPagoError extends Error {
  constructor(message, { code, status, detail } = {}) {
    super(message);
    this.name = "MercadoPagoError";
    this.code = code; // "MP_PREFERENCE" | "MP_PAYMENT"
    this.status = status; // código HTTP de Mercado Pago
    this.detail = detail; // mensaje de Mercado Pago (para el log del servidor, no para la clienta)
  }
}

function createClient({ accessToken, fetch: fetchImpl, timeoutMs = 15000 } = {}) {
  if (!accessToken) throw new TypeError("createClient: falta accessToken.");
  // fetch se resuelve al llamar (no al crear) para poder reemplazarlo en pruebas.
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
    try { data = await res.json(); } catch (_) { /* respuesta sin cuerpo JSON */ }
    return { ok: res.ok, status: res.status, data };
  }

  return {
    // Crea la preferencia y devuelve el enlace de pago al que hay que mandar a la clienta.
    // idempotencyKey evita crear dos preferencias si la llamada se repite.
    async createPreference(preference, { idempotencyKey } = {}) {
      const r = await call("/checkout/preferences", { method: "POST", body: preference, idempotencyKey });
      if (!r.ok || !r.data?.init_point) {
        throw new MercadoPagoError(`Mercado Pago rechazó la preferencia (HTTP ${r.status}).`, {
          code: "MP_PREFERENCE", status: r.status, detail: r.data?.message || r.data?.error || null,
        });
      }
      return { id: r.data.id, initPoint: r.data.init_point };
    },

    // Devuelve el pago, o null si no existe (404: típico de las notificaciones de prueba con ids
    // inventados). Cualquier otro error se lanza, para que el webhook responda 5xx y MP reintente.
    async getPayment(paymentId) {
      if (!/^[0-9]{1,20}$/.test(String(paymentId))) return null;
      const r = await call(`/v1/payments/${paymentId}`);
      if (r.status === 404) return null;
      if (!r.ok || !r.data) {
        throw new MercadoPagoError(`No se pudo consultar el pago (HTTP ${r.status}).`, { code: "MP_PAYMENT", status: r.status });
      }
      return r.data;
    },
  };
}

module.exports = { createClient, MercadoPagoError };
