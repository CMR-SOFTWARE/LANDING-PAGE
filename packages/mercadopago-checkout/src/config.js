"use strict";

// Configuración por variables de entorno. Nada de esto se manda nunca al navegador.
//
//   MP_ACCESS_TOKEN    obligatoria para activar el cobro (empieza con APP_USR). Primero la de PRUEBA.
//   PUBLIC_BASE_URL    recomendada: URL pública del sitio, ej. https://www.mitienda.com
//   MP_HOLD_MINUTES    opcional: minutos que se retiene una reserva mientras se paga (por defecto 10)

const { normalizeBaseUrl } = require("./preference");

// Sin token el cobro con Mercado Pago queda apagado (la opción no se muestra y el servidor la rechaza).
function isEnabled(env = process.env) {
  return Boolean(String(env.MP_ACCESS_TOKEN || "").trim());
}

function getHeader(headers, name) {
  const value = typeof headers?.get === "function" ? headers.get(name) : headers?.[name];
  return String(value || "").split(",")[0].trim();
}

// URL pública del sitio para armar el retorno y el webhook. Si PUBLIC_BASE_URL está definida se usa
// esa (lo más seguro); si no, se arma con los encabezados del pedido (Express: req.headers,
// Next.js: request.headers).
function resolveBaseUrl({ fixedUrl, headers } = {}) {
  const fixed = normalizeBaseUrl(fixedUrl);
  if (fixed) return fixed;
  const host = getHeader(headers, "x-forwarded-host") || getHeader(headers, "host");
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = getHeader(headers, "x-forwarded-proto") || (local ? "http" : "https");
  return normalizeBaseUrl(`${proto}://${host}`);
}

module.exports = { isEnabled, resolveBaseUrl };
