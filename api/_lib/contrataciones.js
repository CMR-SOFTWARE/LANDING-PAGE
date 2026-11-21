// Contratación de un servicio (un mes de un plan) pagada completa con Mercado Pago (API de Orders).
//
// Flujo:
//   1. POST /api/checkout -> crea la contratación PENDIENTE con el precio de la BASE y crea la ORDEN
//      en Mercado Pago (referencia "servicio:<id>").
//   2. El navegador va a Mercado Pago (checkoutUrl) y paga.
//   3. Mercado Pago avisa a /api/mp/webhook con el id de la orden -> se consulta la orden y, si
//      coinciden referencia, moneda y monto y está acreditada, la contratación pasa a CONFIRMADA.
//      El navegador nunca confirma nada.
//
// Toda la lógica de pagos es del módulo @cmr/mercadopago-checkout. Acá solo va lo propio de la
// landing: validar el pedido, la base (store) y las respuestas HTTP.
// Las dependencias (db, client, env) se inyectan para poder probarlo sin red.

import mp from "../../packages/mercadopago-checkout/src/index.js";
import { esUrlDeMercadoPago } from "./mp-url.js";

export const REFERENCIA = "servicio"; // buildReference("servicio", id) -> "servicio:12"

// Vocabulario del módulo <-> columnas de la base (en español).
const A_BASE = { pending: "pendiente", confirmed: "confirmada", cancelled: "cancelada" };
const DESDE_BASE = { pendiente: "pending", confirmada: "confirmed", cancelada: "cancelled" };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9-]{1,40}$/;

const texto = (v, max) => String(v ?? "").trim().slice(0, max);

// El store que pide processOrderPayment: traduce entre el módulo y nuestra tabla.
// Con la API de Orders, el "paymentId" del módulo es el id de la ORDEN (columna mp_order_id).
export function contratacionStore(db) {
  return {
    async load(id) {
      const row = await db.getContratacion(id);
      return row && {
        id: Number(row.id),
        amount: Number(row.monto),
        status: DESDE_BASE[row.estado],
        paymentId: row.mp_order_id,
      };
    },
    async save(id, patch) {
      await db.updateContratacion(id, {
        mp_order_id: patch.paymentId,
        mp_status: patch.paymentStatus,
        ...(patch.status && { estado: A_BASE[patch.status] }),
        ...(patch.paidAt && { paid_at: patch.paidAt }),
      });
    },
  };
}

// ¿Está todo configurado para cobrar? Sin MP_ACCESS_TOKEN queda apagado.
export function cobroHabilitado(env) {
  return mp.isEnabled(env) && Boolean(String(env.SUPABASE_URL || "").trim())
    && Boolean(String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

export function validarPedido(body) {
  const b = body && typeof body === "object" ? body : {};
  const servicio = texto(b.servicio, 40).toLowerCase();
  const nombre = texto(b.nombre, 120);
  const email = texto(b.email, 160).toLowerCase();
  const telefono = texto(b.telefono, 40);
  if (!SLUG.test(servicio)) return { error: "Servicio inválido." };
  if (nombre.length < 2) return { error: "Ingresá tu nombre." };
  if (!EMAIL.test(email)) return { error: "Ingresá un email válido." };
  return { datos: { servicio, nombre, email, telefono: telefono || null } };
}

/**
 * Crea la contratación y la orden de pago. Devuelve { id, checkoutUrl }.
 * @returns {Promise<{status:number, body:object}>}
 */
export async function crearContratacion({ body, headers, db, client, env, log = console }) {
  if (!cobroHabilitado(env)) return { status: 503, body: { error: "El pago online no está disponible." } };

  const { datos, error } = validarPedido(body);
  if (error) return { status: 400, body: { error } };

  const servicio = await db.getServicioPorSlug(datos.servicio);
  if (!servicio || !servicio.activo) return { status: 404, body: { error: "Ese servicio no está disponible." } };

  // EL MONTO SALE DE LA BASE. Cualquier precio que mande el navegador se ignora.
  const monto = Number(servicio.precio);
  if (!(monto > 0)) return { status: 409, body: { error: "Ese servicio no tiene precio cargado." } };

  const contratacion = await db.insertContratacion({
    servicio_id: servicio.id,
    servicio_nombre: servicio.nombre,
    monto,
    nombre: datos.nombre,
    email: datos.email,
    telefono: datos.telefono,
    estado: "pendiente",
  });
  const id = Number(contratacion.id);

  const baseUrl = mp.resolveBaseUrl({ fixedUrl: env.PUBLIC_BASE_URL, headers });
  const volver = (resultado) => mp.withQuery(`${baseUrl}/#planes`, { mp: resultado, contratacion: id });

  let orden;
  try {
    const order = mp.buildOrder({
      reference: mp.buildReference(REFERENCIA, id),
      items: [{ id: servicio.id, title: `${servicio.nombre} - 1 mes`, quantity: 1, unitPrice: monto }],
      backUrls: { success: volver("ok"), failure: volver("error"), pending: volver("pendiente") },
      payerEmail: datos.email,
    });
    orden = await client.createOrder(order, { idempotencyKey: `servicio-${id}` });
    if (!esUrlDeMercadoPago(orden.checkoutUrl)) throw new Error(`checkoutUrl fuera de Mercado Pago: ${orden.checkoutUrl}`);
  } catch (e) {
    // status y detail son el código HTTP y el código de error de Mercado Pago (sin datos sensibles).
    log.error?.(`[mp] contratación ${id}: no se pudo crear la orden de pago:`, e.message,
      JSON.stringify({ status: e.status ?? null, detail: e.detail ?? null }));
    // Sin orden la contratación no sirve: se CANCELA (cambio de estado), nunca se borra.
    await db.updateContratacion(id, { estado: "cancelada", mp_status: "order_error" });
    return { status: 502, body: { error: "No pudimos iniciar el pago. Probá de nuevo en unos minutos." } };
  }

  try {
    await db.updateContratacion(id, { mp_order_id: orden.id, mp_status: orden.status || "created" });
  } catch (e) {
    // No es grave: el aviso encuentra la contratación por la referencia y guarda el id de la orden.
    log.warn?.(`[mp] contratación ${id}: no se guardó mp_order_id:`, e.message);
  }
  return { status: 200, body: { id, checkoutUrl: orden.checkoutUrl } };
}

// Lo que hace el webhook con cada id de orden.
export function procesarAviso({ client, db, orderId, warn = (m) => console.warn("[mp]", m) }) {
  const store = contratacionStore(db);
  return mp.processOrderNotification({
    client,
    orderId,
    warn,
    handlers: {
      [REFERENCIA]: (ctx) => mp.processOrderPayment({ ...ctx, store }),
    },
  });
}
