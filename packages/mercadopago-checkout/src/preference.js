"use strict";

// Armado de la "preferencia": lo que se le manda a Mercado Pago para generar el enlace de pago.
// Es una función pura (no hace llamadas de red), así se puede probar y leer fácil.

// Acepta solo http(s) y saca la barra final. Devuelve "" si no es una URL válida.
function normalizeBaseUrl(raw) {
  const s = String(raw || "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+/i.test(s) ? s : "";
}

// Agrega parámetros a una URL: withQuery("https://x.com/cart", { mp: "ok" }) -> "https://x.com/cart?mp=ok"
function withQuery(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, String(v));
  return u.toString();
}

// Fecha ISO 8601 con zona, el formato de la documentación. Por defecto Argentina (UTC-3).
function formatDate(ms, utcOffsetMinutes = -180) {
  const sign = utcOffsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(utcOffsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return new Date(ms + utcOffsetMinutes * 60000).toISOString().replace("Z", `${sign}${hh}:${mm}`);
}

/**
 * @param {object}   o
 * @param {string}   o.reference     referencia externa (ver references.js), ej. "order:77"
 * @param {Array}    o.items         [{ id, title, quantity, unitPrice }] con precios SACADOS DE TU BASE
 * @param {string}   o.baseUrl       URL pública del sitio, ej. "https://www.mitienda.com"
 * @param {string}   o.webhookPath   ruta de TU webhook, ej. "/api/mp/webhook" (se une a baseUrl)
 * @param {object}   o.backUrls      { success, failure, pending }: adónde vuelve la clienta
 * @param {string}  [o.payerEmail]   mail de la clienta (opcional)
 * @param {boolean} [o.instantPaymentsOnly]  true = solo aprobado/rechazado y sin efectivo con cupón
 *                                   (Rapipago/Pago Fácil). Sirve cuando hay que confirmar rápido.
 * @param {number}  [o.expiresInMs]  si se indica, el enlace de pago vence a ese tiempo
 * @param {number}  [o.now]          solo para pruebas
 */
function buildPreference({ reference, items, baseUrl, webhookPath, backUrls, payerEmail, instantPaymentsOnly = false, expiresInMs, now = Date.now() }) {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) throw new TypeError("buildPreference: baseUrl inválida.");
  if (!reference) throw new TypeError("buildPreference: falta reference.");
  if (!Array.isArray(items) || !items.length) throw new TypeError("buildPreference: no hay productos.");
  if (!backUrls?.success || !backUrls?.failure || !backUrls?.pending) {
    throw new TypeError("buildPreference: backUrls necesita success, failure y pending.");
  }

  const preference = {
    items: items.map((it) => {
      const unitPrice = Number(it.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new TypeError(`buildPreference: precio inválido en "${it.title}".`);
      }
      return {
        id: String(it.id),
        title: String(it.title || "Producto").slice(0, 250),
        quantity: Math.max(1, Math.trunc(Number(it.quantity) || 1)),
        unit_price: unitPrice,
        currency_id: "ARS",
      };
    }),
    external_reference: reference,
    back_urls: backUrls,
    notification_url: `${base}${webhookPath.startsWith("/") ? "" : "/"}${webhookPath}`,
  };

  // Con https Mercado Pago puede devolver a la clienta solo apenas se aprueba el pago.
  if (base.startsWith("https://")) preference.auto_return = "approved";

  const mail = String(payerEmail || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) preference.payer = { email: mail };

  if (instantPaymentsOnly) {
    preference.binary_mode = true; // solo aprobado o rechazado, sin pagos "en proceso"
    preference.payment_methods = { excluded_payment_types: [{ id: "ticket" }] }; // sin efectivo con cupón
  }
  if (expiresInMs) {
    preference.expires = true;
    preference.expiration_date_from = formatDate(now);
    preference.expiration_date_to = formatDate(now + expiresInMs);
  }
  return preference;
}

module.exports = { buildPreference, normalizeBaseUrl, withQuery, formatDate };
