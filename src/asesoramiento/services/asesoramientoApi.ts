import type { AsesoramientoFormValues, SubmitFailure, SubmitSuccess } from "../types";

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

  // Si pegaron .../rest/v1/, nos quedamos con el origen del proyecto
  const base = `${parsed.protocol}//${parsed.host}`;

  // Headers de fetch solo aceptan caracteres Latin-1
  for (const [label, value] of [
    ["VITE_SUPABASE_URL", base],
    ["VITE_SUPABASE_ANON_KEY", anon],
  ] as const) {
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) > 255) {
        throw new Error(`${label} tiene caracteres inválidos. Volvé a pegarla en Vercel sin comillas ni espacios.`);
      }
    }
  }

  return { url: base, anon };
}

export async function submitAsesoramiento(
  values: AsesoramientoFormValues,
  signal?: AbortSignal,
): Promise<SubmitSuccess> {
  const { url, anon } = getConfig();
  const endpoint = `${url}/functions/v1/submit-asesoramiento`;

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
      }),
      signal,
    });
  } catch (err) {
    console.error("[asesoramiento] fetch failed", { endpoint, err });
    throw new Error(
      "No pudimos conectar con el servidor. Revisá VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en Vercel (sin comillas ni saltos de línea) y volvé a intentar.",
    );
  }

  let body: SubmitSuccess | SubmitFailure;
  try {
    body = (await res.json()) as SubmitSuccess | SubmitFailure;
  } catch {
    throw new Error("Respuesta inválida del servidor. Intentá de nuevo.");
  }

  if (!res.ok || !body.ok) {
    const fail = body as SubmitFailure;
    const err = new Error(fail.message || "No pudimos enviar la solicitud.") as Error & {
      fieldErrors?: SubmitFailure["errors"];
    };
    err.fieldErrors = fail.errors;
    throw err;
  }

  return body;
}
