// /api/mp/webhook -> aviso de Mercado Pago (API de Orders). Es solo un "ping" con el id de la orden:
// el módulo consulta la orden a Mercado Pago con nuestro token y recién ahí confirma.
// Si algo falla responde 5xx y Mercado Pago reintenta solo.
//
// IMPORTANTE: esta URL se configura en el panel de Mercado Pago (Tus integraciones -> la app ->
// Webhooks -> Configurar notificaciones, evento de Órdenes). La orden no la lleva.

import adapter from "../../packages/mercadopago-checkout/adapters/next-orders.js";
import { cobroHabilitado, procesarAviso } from "../_lib/contrataciones.js";
import { dependencias } from "../_lib/runtime.js";

export const POST = adapter.nextOrdersWebhook({
  isEnabled: () => cobroHabilitado(process.env),
  process: (_request, orderId) => {
    const { client, db } = dependencias();
    return procesarAviso({ client, db, orderId });
  },
});
