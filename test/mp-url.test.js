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

test("WhatsApp: el mensaje dice el plan y el número, y no copia texto de la URL", () => {
  const codigo = fs.readFileSync(new URL("../public/pago-servicio.js", import.meta.url), "utf8");
  // La landing tiene un botón por plan; el nombre se toma de ahí.
  const botones = { "plan-web": "Plan Web", "plan-gestion": "Plan Gestión" };
  const vuelta = (search) => {
    const avisos = [];
    const el = () => ({ append(...h) { this.hijos = [...(this.hijos || []), ...h]; }, setAttribute() {}, addEventListener() {}, remove() {} });
    const window = { location: { search, pathname: "/", hash: "" } };
    const document = {
      readyState: "complete", querySelectorAll: () => [], addEventListener() {}, getElementById: () => null,
      createElement: () => el(),
      querySelector: (sel) => {
        const m = /data-servicio="([^"]*)"/.exec(sel);
        return m && botones[m[1]] ? { getAttribute: () => botones[m[1]] } : null;
      },
      body: { appendChild: (a) => avisos.push(a) },
    };
    vm.runInNewContext(codigo, { window, document, URL, URLSearchParams, history: { replaceState() {} },
      fetch: () => Promise.reject(new Error("sin red")) });
    const wsp = avisos[0]?.hijos?.find((h) => h.href);
    return wsp ? new URL(wsp.href).searchParams.get("text") : null;
  };

  assert.equal(vuelta("?mp=ok&contratacion=5&servicio=plan-web"),
    "Hola CMR, pagué con Mercado Pago el Plan Web (contratación N° 5). Les mando el comprobante.");
  assert.equal(vuelta("?mp=pendiente&contratacion=7&servicio=plan-gestion"),
    "Hola CMR, pagué con Mercado Pago el Plan Gestión (contratación N° 7). Les mando el comprobante.");
  // Plan inventado o número con texto: no entran al mensaje.
  assert.equal(vuelta("?mp=ok&contratacion=5&servicio=mandame-plata"),
    "Hola CMR, pagué con Mercado Pago la contratación N° 5. Les mando el comprobante.");
  assert.equal(vuelta("?mp=ok&contratacion=5%20y%20algo&servicio=plan-web"),
    "Hola CMR, pagué con Mercado Pago el Plan Web (contratación). Les mando el comprobante.");
  assert.equal(vuelta("?mp=error&contratacion=5&servicio=plan-web"), null); // si falló, no hay botón
});
