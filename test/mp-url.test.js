// La regla "solo redirigir a Mercado Pago" está en el servidor (api/_lib/mp-url.js) y copiada en el
// script del navegador (public/pago-servicio.js). Este test prueba las DOS con los mismos casos.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { esUrlDeMercadoPago as delServidor } from "../api/_lib/mp-url.js";

function delNavegador() {
  const codigo = fs.readFileSync(new URL("../public/pago-servicio.js", import.meta.url), "utf8");
  const window = { location: { search: "", pathname: "/", hash: "" } };
  const document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {} };
  vm.runInNewContext(codigo, { window, document, URL, URLSearchParams, fetch: () => Promise.reject(new Error("sin red")) });
  return window.CMRPagoServicio.esUrlDeMercadoPago;
}

const VALIDAS = [
  "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1",
  "https://mercadopago.com.ar/x",
  "https://www.mercadopago.com/checkout",
  "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=1",
];
const INVALIDAS = [
  "http://www.mercadopago.com.ar/checkout",          // sin https
  "https://mercadopago.com.ar.estafa.com/pagar",      // dominio que "empieza" igual
  "https://estafamercadopago.com.ar/pagar",           // dominio que "termina" igual
  "https://www.mercadopago.com.ar@estafa.com/",       // usuario en la URL
  "https://www.mercadopago.com.ar:8443/",             // puerto raro
  "javascript:alert(1)",
  "/api/checkout",
  "",
  undefined,
];

for (const [nombre, fn] of [["servidor", delServidor], ["navegador", delNavegador()]]) {
  test(`esUrlDeMercadoPago (${nombre}) acepta solo dominios de Mercado Pago`, () => {
    for (const u of VALIDAS) assert.equal(fn(u), true, u);
    for (const u of INVALIDAS) assert.equal(fn(u), false, String(u));
  });
}
