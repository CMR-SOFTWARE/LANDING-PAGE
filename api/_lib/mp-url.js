// ¿Es un enlace de Mercado Pago? Solo https y dominios mercadopago.com / mercadopago.com.ar
// (con subdominios: www., sandbox.). La misma regla está copiada en public/pago-servicio.js
// porque ese archivo es un script común del navegador; test/mp-url.test.js prueba las dos.
export function esUrlDeMercadoPago(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && !u.username && !u.password && !u.port
      && /(^|\.)mercadopago\.com(\.ar)?$/i.test(u.hostname);
  } catch (_) {
    return false;
  }
}
