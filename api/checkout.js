// /api/checkout
//   GET  -> { enabled }  (el botón solo se muestra si el cobro está configurado)
//   POST -> { servicio: "plan-web", nombre, email, telefono? } -> { id, checkoutUrl }
//           crea la contratación PENDIENTE y la orden de Mercado Pago, y devuelve su enlace de pago.

import { crearContratacion } from "./_lib/contrataciones.js";
import { dependencias, json } from "./_lib/runtime.js";

export function GET() {
  return json({ enabled: Boolean(dependencias()) });
}

export async function POST(request) {
  const deps = dependencias();
  if (!deps) return json({ error: "El pago online no está disponible." }, 503);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Pedido inválido." }, 400);
  }

  try {
    const r = await crearContratacion({ body, headers: request.headers, ...deps });
    return json(r.body, r.status);
  } catch (e) {
    console.error("[checkout]", e); // p. ej. Supabase caído antes de crear la contratación
    return json({ error: "Error interno." }, 500);
  }
}
