// Arma las dependencias reales a partir de las variables de entorno de Vercel.
// Variables (solo en Vercel, nunca en el código):
//   MP_ACCESS_TOKEN            sin esta, el cobro queda apagado
//   PUBLIC_BASE_URL            ej. https://cmrsoftwaresolutions.com
//   SUPABASE_URL               https://wnzugiqyezrkywwfrbdw.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  clave secreta (service_role / sb_secret_...)

import mp from "../../packages/mercadopago-checkout/src/index.js";
import { createSupabaseRest } from "./supabase-rest.js";
import { cobroHabilitado } from "./contrataciones.js";

export function dependencias(env = process.env) {
  if (!cobroHabilitado(env)) return null;
  return {
    env,
    client: mp.createOrdersClient({ accessToken: env.MP_ACCESS_TOKEN }), // API de Orders
    db: createSupabaseRest({ url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY }),
  };
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
