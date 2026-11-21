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

test("QR: solo se arma para links de Mercado Pago y con la librería cargada", () => {
  const cargar = (conLibreria) => {
    const window = { location: { search: "", pathname: "/", hash: "" } };
    const document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {} };
    const ctx = vm.createContext({ window, document, URL, URLSearchParams, fetch: () => Promise.reject(new Error("sin red")) });
    if (conLibreria) {
      // Igual que en el navegador: la librería deja "qrcode" global, que en el navegador es window.qrcode.
      vm.runInContext(fs.readFileSync(new URL("../public/vendor/qrcode-generator-1.4.4.js", import.meta.url), "utf8"), ctx);
      window.qrcode = ctx.qrcode;
    }
    vm.runInContext(fs.readFileSync(new URL("../public/pago-servicio.js", import.meta.url), "utf8"), ctx);
    return window.CMRPagoServicio.matrizQR;
  };
  const matrizQR = cargar(true);
  const link = "https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORDTST01M7ZGF3W7Q8654H603TMFYZHZ";
  const m = matrizQR(link);
  assert.ok(m.length >= 21 && m.every((fila) => fila.length === m.length)); // cuadrado de tamaño válido
  // Los tres cuadrados de las esquinas que tiene todo QR (borde oscuro de 7x7).
  for (const [r0, c0] of [[0, 0], [0, m.length - 7], [m.length - 7, 0]]) {
    for (let i = 0; i < 7; i++) {
      assert.ok(m[r0][c0 + i] && m[r0 + 6][c0 + i] && m[r0 + i][c0] && m[r0 + i][c0 + 6]);
    }
  }
  for (const malo of ["https://estafamercadopago.com.ar/pagar", "javascript:alert(1)", "", undefined]) {
    assert.equal(matrizQR(malo), null, String(malo));
  }
  assert.equal(cargar(false)(link), null); // sin librería: no hay QR y se paga con el link
});

test("transferencia: mensaje de WhatsApp con plan y monto, y datos de la cuenta", () => {
  const codigo = fs.readFileSync(new URL("../public/pago-servicio.js", import.meta.url), "utf8");
  const window = { location: { search: "", pathname: "/", hash: "" } };
  const document = { readyState: "complete", querySelectorAll: () => [], addEventListener() {} };
  vm.runInNewContext(codigo, { window, document, URL, URLSearchParams, fetch: () => Promise.reject(new Error("sin red")) });
  const { linkWhatsAppTransferencia, TRANSFERENCIA } = window.CMRPagoServicio;
  const texto = (link) => new URL(link).searchParams.get("text");

  const link = linkWhatsAppTransferencia("Plan Web", "AR$ 80.000");
  assert.ok(link.startsWith("https://wa.me/5493364578599?text="));
  assert.equal(texto(link), "Hola CMR, transferí AR$ 80.000 por el Plan Web. Les mando el comprobante.");
  // Un precio con formato raro no entra al mensaje.
  assert.equal(texto(linkWhatsAppTransferencia("Plan Web", "gratis <b>")), "Hola CMR, transferí por el Plan Web. Les mando el comprobante.");
  assert.equal(TRANSFERENCIA.alias, "tomi.machu.mp");
  assert.match(TRANSFERENCIA.cvu, /^[0-9]{22}$/); // un CVU tiene 22 dígitos
});

test("index.html: el precio de transferencia es el de la tarjeta del plan y el de Mercado Pago es mayor", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const tarjetas = html.split('<article class="plan-card').slice(1);
  const conBoton = tarjetas.filter((t) => t.includes("js-mp-pagar"));
  assert.equal(conBoton.length, 2);
  const num = (s) => Number(String(s).replace(/[^0-9]/g, ""));
  for (const t of conBoton) {
    const tarjeta = /plan-card__amount">([0-9.]+)</.exec(t)[1];
    const transferencia = /data-precio-transferencia="([^"]+)"/.exec(t)[1];
    const mp = /data-servicio-precio="([^"]+)"/.exec(t)[1];
    assert.equal(transferencia, `AR$ ${tarjeta}`);
    assert.ok(num(mp) > num(transferencia), `${mp} > ${transferencia}`);
    assert.match(t, />Medios de pago<\/button>/);
  }
});
