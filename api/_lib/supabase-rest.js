// Acceso mínimo a Supabase por su API REST (PostgREST), sin dependencias.
// Usa la service_role key: SOLO en el servidor (funciones de Vercel), nunca en el navegador.
//
// Las carpetas que empiezan con "_" dentro de /api no se publican como endpoints en Vercel.

export class SupabaseError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message);
    this.name = "SupabaseError";
    this.status = status;
    this.detail = detail;
  }
}

export function createSupabaseRest({ url, key, fetch: fetchImpl, timeoutMs = 10000 }) {
  if (!url || !key) throw new TypeError("createSupabaseRest: faltan url o key.");
  const base = `${String(url).replace(/\/+$/, "")}/rest/v1`;
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));

  async function call(method, path, body) {
    const res = await doFetch(`${base}/${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* sin cuerpo */ }
    if (!res.ok) {
      throw new SupabaseError(`Supabase respondió HTTP ${res.status} en ${method} ${path.split("?")[0]}.`, {
        status: res.status, detail: data?.message || null,
      });
    }
    return Array.isArray(data) ? data : [];
  }

  const id = (v) => encodeURIComponent(String(v));

  return {
    async getServicioPorSlug(slug) {
      const rows = await call("GET", `servicios?select=id,slug,nombre,precio,activo&slug=eq.${id(slug)}&limit=1`);
      return rows[0] || null;
    },
    async insertContratacion(row) {
      const rows = await call("POST", "contrataciones", row);
      if (!rows[0]) throw new SupabaseError("Supabase no devolvió la contratación creada.");
      return rows[0];
    },
    async getContratacion(contratacionId) {
      const rows = await call("GET", `contrataciones?select=id,monto,estado,mp_order_id&id=eq.${id(contratacionId)}&limit=1`);
      return rows[0] || null;
    },
    async updateContratacion(contratacionId, patch) {
      await call("PATCH", `contrataciones?id=eq.${id(contratacionId)}`, patch);
    },
  };
}
