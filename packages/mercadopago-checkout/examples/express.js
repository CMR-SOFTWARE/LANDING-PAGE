"use strict";

// EJEMPLO COMPLETO para Express: una tienda mínima que cobra pedidos con Mercado Pago.
// Guarda los pedidos en memoria para que se entienda el flujo sin base de datos.
// En tu app reemplazá el objeto `pedidos` por tu base (Supabase, Postgres, etc.).
//
// Probarlo:
//   MP_ACCESS_TOKEN=APP_USR-... PUBLIC_BASE_URL=https://tu-url-publica node packages/mercadopago-checkout/examples/express.js
//   curl -X POST localhost:3000/pedidos -H "content-type: application/json" -d "{\"total\":1500}"
//   -> devuelve { id, initPoint }: abrí initPoint para pagar.
//
// Para probar el aviso en tu computadora Mercado Pago necesita una URL pública (ngrok o similar) en PUBLIC_BASE_URL.

const express = require("express");
const mp = require("../src");
const { expressWebhook } = require("../adapters/express");

const app = express();
app.use(express.json()); // el adaptador del aviso lo necesita para leer el cuerpo

// ---- 1) Tu "base de datos" -------------------------------------------------------------------
const pedidos = new Map(); // id -> { id, total, status, paymentId, paymentStatus, paidAt }
let proximoId = 1;

// El módulo no conoce tu base: le das estas dos funciones y listo.
//   load(id)        -> { id, amount, status, paymentId } o null si no existe
//   save(id, patch) -> guarda { paymentId, paymentStatus, status?, paidAt? }
// status siempre es "pending" | "confirmed" | "cancelled".
const store = {
  async load(id) {
    const p = pedidos.get(id);
    return p && { id: p.id, amount: p.total, status: p.status, paymentId: p.paymentId };
  },
  async save(id, patch) {
    Object.assign(pedidos.get(id), patch);
  },
};

// ---- 2) El cliente de Mercado Pago -------------------------------------------------------------
const client = mp.createClient({ accessToken: process.env.MP_ACCESS_TOKEN });

// ---- 3) Crear el pedido y devolver el enlace de pago ---------------------------------------------
app.post("/pedidos", async (req, res) => {
  if (!mp.isEnabled()) return res.status(503).json({ error: "Mercado Pago no está configurado." });

  // El MONTO sale de tu servidor, nunca del navegador (acá es un ejemplo: lo toma del cuerpo).
  const total = Number(req.body?.total);
  if (!(total > 0)) return res.status(400).json({ error: "Total inválido." });

  const pedido = { id: proximoId++, total, status: "pending", paymentId: null };
  pedidos.set(pedido.id, pedido);

  const baseUrl = mp.resolveBaseUrl({ fixedUrl: process.env.PUBLIC_BASE_URL, headers: req.headers });
  const volver = (resultado) => mp.withQuery(`${baseUrl}/gracias`, { mp: resultado, pedido: pedido.id });

  const preference = mp.buildPreference({
    reference: mp.buildReference("order", pedido.id), // "order:1": así sabemos qué se pagó cuando llega el aviso
    items: [{ id: pedido.id, title: `Pedido #${pedido.id}`, quantity: 1, unitPrice: total }],
    baseUrl,
    webhookPath: "/mp/webhook",
    backUrls: { success: volver("ok"), failure: volver("error"), pending: volver("pendiente") },
  });

  try {
    const { initPoint } = await client.createPreference(preference, { idempotencyKey: `pedido-${pedido.id}` });
    res.json({ id: pedido.id, initPoint });
  } catch (error) {
    pedido.status = "cancelled"; // sin enlace de pago el pedido no sirve (se cancela, no se borra)
    res.status(502).json({ error: "No pudimos iniciar el pago." });
  }
});

// ---- 4) El aviso de Mercado Pago ---------------------------------------------------------------
// El aviso es solo un "ping": el módulo le pregunta a Mercado Pago el estado real del pago y
// recién ahí confirma, si coinciden la referencia, la moneda y el monto.
app.post("/mp/webhook", expressWebhook({
  isEnabled: mp.isEnabled,
  process: (req, paymentId) => mp.processNotification({
    client,
    paymentId,
    warn: (mensaje) => console.warn("[mp]", mensaje),
    handlers: {
      order: (ctx) => mp.processOrderPayment({ ...ctx, store }), // ctx trae payment, id, reference y warn
    },
  }),
}));

// Página de vuelta (en una app real: tu página de "gracias")
app.get("/gracias", (req, res) => res.send(`Volviste de Mercado Pago (${req.query.mp}). Pedido ${req.query.pedido}.`));

if (require.main === module) {
  app.listen(process.env.PORT || 3000, () => console.log("Ejemplo en http://localhost:" + (process.env.PORT || 3000)));
}

module.exports = { app, pedidos };
