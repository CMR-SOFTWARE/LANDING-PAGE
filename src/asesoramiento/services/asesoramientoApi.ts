import type { AsesoramientoFormValues, SubmitFailure, SubmitSuccess } from "../types";

const REQUEST_TIMEOUT_MS = 45_000;

function cleanEnv(value: string | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/[\r\n\t]/g, "");
}

function getConfig() {
  const url = cleanEnv(import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const anon = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

  if (!url || !anon) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en Vercel. Agregá las variables y hacé Redeploy.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("VITE_SUPABASE_URL no es una URL válida.");
  }

  const base = `${parsed.protocol}//${parsed.host}`;

  for (const [label, value] of [
    ["VITE_SUPABASE_URL", base],
    ["VITE_SUPABASE_ANON_KEY", anon],
  ] as const) {
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) > 255) {
        throw new Error(
          `${label} tiene caracteres inválidos. Volvé a pegarla en Vercel sin comillas ni espacios.`,
        );
      }
    }
  }

  return { url: base, anon };
}

function publicMessage(message: string | undefined): string {
  const base = (message || "No pudimos enviar la solicitud.").replace(/\s*\[v\d+\]\s*/gi, " ").trim();
  // No exponer detalles técnicos (SQL/API) al usuario final
  return base.replace(/\s*\([^)]{12,}\)\s*$/, "").trim() || "No pudimos enviar la solicitud.";
}

export async function submitAsesoramiento(
  values: AsesoramientoFormValues,
  signal?: AbortSignal,
): Promise<SubmitSuccess> {
  const { url, anon } = getConfig();
  const endpoint = `${url}/functions/v1/submit-asesoramiento`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({
        nombre: values.nombre.trim(),
        empresa: values.empresa.trim(),
        rubro: values.rubro.trim(),
        email: values.email.trim(),
        telefono: values.telefono.trim(),
        necesidades: values.necesidades,
        como_trabajan: values.como_trabajan.trim(),
        problema_principal: values.problema_principal.trim(),
        usuarios: values.usuarios,
        plazo: values.plazo,
        presupuesto: values.presupuesto,
        observaciones: values.observaciones.trim(),
        website: values.website,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("[asesoramiento] fetch failed", { endpoint, err });
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Intentá de nuevo en unos minutos.");
    }
    throw new Error(
      "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
    );
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  let body: SubmitSuccess | SubmitFailure;
  try {
    body = (await res.json()) as SubmitSuccess | SubmitFailure;
  } catch {
    throw new Error("Respuesta inválida del servidor. Intentá de nuevo.");
  }

  if (!res.ok || !body.ok) {
    const fail = body as SubmitFailure;
    console.error("[asesoramiento] submit rejected", {
      status: res.status,
      message: fail.message,
      detail: fail.detail,
      code: fail.code,
      errors: fail.errors,
    });
    const err = new Error(publicMessage(fail.message)) as Error & {
      fieldErrors?: SubmitFailure["errors"];
    };
    err.fieldErrors = fail.errors;
    throw err;
  }

  return body;
}
