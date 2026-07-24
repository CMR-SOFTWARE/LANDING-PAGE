import type { AsesoramientoFormValues, SubmitFailure, SubmitSuccess } from "../types";

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Configurá el archivo .env (ver .env.example).",
    );
  }
  return { url: url.replace(/\/$/, ""), anon };
}

export async function submitAsesoramiento(
  values: AsesoramientoFormValues,
  signal?: AbortSignal,
): Promise<SubmitSuccess> {
  const { url, anon } = getConfig();

  const res = await fetch(`${url}/functions/v1/submit-asesoramiento`, {
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
