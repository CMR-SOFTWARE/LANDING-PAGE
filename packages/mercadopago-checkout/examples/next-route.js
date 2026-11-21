// EJEMPLO para Next.js 14 (App Router). Son DOS archivos de tu proyecto; acá están juntos para leerlos de corrido.
// Ajustá la ruta del import ("@/lib/mercadopago-checkout" o donde copies el módulo) y tu acceso a la base.
//
// El módulo es CommonJS sin dependencias: Next lo importa sin configurar nada.

// ============================================================================================
// ARCHIVO 1: lib/mp.js  (lo compartís entre las dos rutas)
// ============================================================================================
import * as mp from "@/lib/mercadopago-checkout";

export { mp };
export const client = mp.createClient({ accessToken: process.env.MP_ACCESS_TOKEN });

// Dónde se leen y guardan tus pedidos. Reemplazá `db` por Supabase / Prisma / lo que uses.
//   load(id)        -> { id, amount, status, paymentId } o null
//   save(id, patch) -> guarda { paymentId, paymentStatus, status?, paidAt? }
export const orderStore = {
  async load(id) {
    const row = await db.orders.findById(id);
    return row && { id: row.id, amount: row.total, status: row.status, paymentId: row.mp_payment_id };
  },
  async save(id, patch) {
    await db.orders.update(id, {
      mp_payment_id: patch.paymentId,
      mp_status: patch.paymentStatus,
      ...(patch.status && { status: patch.status }),
      ...(patch.paidAt && { paid_at: patch.paidAt }),
    });
  },
};

// ============================================================================================
// ARCHIVO 2: app/api/checkout/route.js  -> crea el pedido y devuelve el enlace de pago
// ============================================================================================
import { NextResponse } from "next/server";
import { mp, client } from "@/lib/mp";

export async function POST(request) {
  if (!mp.isEnabled()) return NextResponse.json({ error: "Mercado Pago no está configurado." }, { status: 503 });

  // Tu lógica: validar el carrito y calcular el total EN EL SERVIDOR con los precios de tu base.
  const order = await db.orders.create({ /* ... */ status: "pending" });
  const baseUrl = mp.resolveBaseUrl({ fixedUrl: process.env.PUBLIC_BASE_URL, headers: request.headers });

  const preference = mp.buildPreference({
    reference: mp.buildReference("order", order.id),
    items: order.items.map((it) => ({ id: it.productId, title: it.name, quantity: it.qty, unitPrice: it.price })),
    baseUrl,
    webhookPath: "/api/mp/webhook",
    backUrls: {
      success: mp.withQuery(`${baseUrl}/gracias`, { mp: "ok", pedido: order.id }),
      failure: mp.withQuery(`${baseUrl}/gracias`, { mp: "error", pedido: order.id }),
      pending: mp.withQuery(`${baseUrl}/gracias`, { mp: "pendiente", pedido: order.id }),
    },
  });

  try {
    const { initPoint } = await client.createPreference(preference, { idempotencyKey: `order-${order.id}` });
    return NextResponse.json({ initPoint }); // el navegador redirige a initPoint
  } catch {
    await db.orders.update(order.id, { status: "cancelled" }); // no se borra
    return NextResponse.json({ error: "No pudimos iniciar el pago." }, { status: 502 });
  }
}

// ============================================================================================
// ARCHIVO 3: app/api/mp/webhook/route.js  -> el aviso de Mercado Pago
// ============================================================================================
import { nextWebhook } from "@/lib/mercadopago-checkout/adapters/next";
import { mp, client, orderStore } from "@/lib/mp";

export const POST = nextWebhook({
  isEnabled: mp.isEnabled,
  process: (request, paymentId) => mp.processNotification({
    client,
    paymentId,
    warn: (mensaje) => console.warn("[mp]", mensaje),
    handlers: {
      order: (ctx) => mp.processOrderPayment({ ...ctx, store: orderStore }),
    },
  }),
});
