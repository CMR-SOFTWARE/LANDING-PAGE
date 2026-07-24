// CMR Landing — Edge Function: submit-asesoramiento
// Deploy: supabase functions deploy submit-asesoramiento --no-verify-jwt
// Secrets (Dashboard): RESEND_API_KEY, MAIL_FROM, MAIL_TEAM, SITE_URL, LOGO_URL, SERVICE_ROLE_KEY
// SERVICE_ROLE_KEY = tu sb_secret_... (Settings → API Keys → Secret)
// SUPABASE_URL lo inyecta Supabase automáticamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

function resolveServiceKey(): string {
  const manual =
    Deno.env.get("SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";
  if (manual) return manual;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed).find((v) => typeof v === "string" && v.length > 0);
      if (first) return first;
    } catch (e) {
      console.error("SUPABASE_SECRET_KEYS parse failed", e);
    }
  }
  return "";
}

function resolveAnonKey(req: Request): string {
  const fromHeader = req.headers.get("apikey")?.trim() ?? "";
  if (fromHeader) return fromHeader;

  const manual =
    Deno.env.get("ANON_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    "";
  if (manual) return manual;

  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed).find((v) => typeof v === "string" && v.length > 0);
      if (first) return first;
    } catch (e) {
      console.error("SUPABASE_PUBLISHABLE_KEYS parse failed", e);
    }
  }
  return "";
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  nombre?: string;
  empresa?: string;
  rubro?: string;
  email?: string;
  telefono?: string;
  necesidades?: string[];
  como_trabajan?: string;
  problema_principal?: string;
  usuarios?: string;
  plazo?: string;
  presupuesto?: string;
  observaciones?: string;
  website?: string;
};

const rateBucket = new Map<string, { count: number; reset: number }>();

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function allowRequest(ip: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const row = rateBucket.get(ip);
  if (!row || now > row.reset) {
    rateBucket.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  row.count += 1;
  return row.count <= limit;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trim(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function clip(v: string, max: number) {
  return v.length > max ? v.slice(0, max) : v;
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isPhone(v: string) {
  if (!v) return true;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function validate(p: Payload) {
  const errors: Record<string, string> = {};

  // Honeypot
  if (trim(p.website)) {
    return {
      errors: { nombre: "No pudimos validar el envío." },
      data: null as null,
    };
  }

  const nombre = clip(trim(p.nombre), 120);
  const email = clip(trim(p.email).toLowerCase(), 160);
  const telefono = clip(trim(p.telefono), 40);
  const problema = clip(trim(p.problema_principal), 4000);
  const necesidades = Array.isArray(p.necesidades)
    ? p.necesidades.map((n) => clip(trim(n), 120)).filter(Boolean).slice(0, 12)
    : [];

  if (!nombre || nombre.length < 2) errors.nombre = "Ingresá tu nombre y apellido.";
  if (!email) errors.email = "Ingresá tu correo electrónico.";
  else if (!isEmail(email)) errors.email = "El correo no tiene un formato válido.";
  if (telefono && !isPhone(telefono)) errors.telefono = "Ingresá un teléfono válido (mín. 8 dígitos).";
  if (!problema || problema.length < 10) {
    errors.problema_principal = "Contanos el problema u objetivo con un poco más de detalle.";
  }
  if (necesidades.length < 1) {
    errors.necesidades = "Marcá al menos una necesidad.";
  }

  return {
    errors,
    data: {
      nombre,
      empresa: clip(trim(p.empresa), 160) || null,
      rubro: clip(trim(p.rubro), 120) || null,
      email,
      telefono: telefono || null,
      necesidades,
      como_trabajan: clip(trim(p.como_trabajan), 2000) || null,
      problema_principal: problema,
      usuarios: clip(trim(p.usuarios), 80) || null,
      plazo: clip(trim(p.plazo), 80) || null,
      presupuesto: clip(trim(p.presupuesto), 120) || null,
      observaciones: clip(trim(p.observaciones), 2000) || null,
    },
  };
}

function buildNumero() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const rand = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `SA-${y}${m}${day}-${rand}`;
}

function dash(v: string | null | undefined) {
  return v && v.trim() ? v : "-";
}

/** Helvetica (WinAnsi) no soporta todos los unicode; sanitizamos para el PDF. */
function pdfSafe(text: string) {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x00-\xFF]/g, "?");
}

async function buildPdf(opts: {
  numero: string;
  createdAt: string;
  data: NonNullable<ReturnType<typeof validate>["data"]>;
  logoBytes: Uint8Array | null;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const ink = rgb(0.04, 0.06, 0.22);
  const muted = rgb(0.35, 0.4, 0.5);
  const accent = rgb(0.16, 0.31, 0.75);

  if (opts.logoBytes) {
    try {
      const logo = await doc.embedPng(opts.logoBytes);
      const logoW = 120;
      const logoH = (logo.height / logo.width) * logoW;
      page.drawImage(logo, {
        x: margin,
        y: y - logoH,
        width: logoW,
        height: logoH,
      });
      y -= logoH + 18;
    } catch {
      // logo opcional
    }
  }

  page.drawText("CMR Software Solutions", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: accent,
  });
  y -= 22;

  page.drawText("Solicitud de Asesoramiento", {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: ink,
  });
  y -= 18;

  page.drawText(`N.º ${opts.numero}`, {
    x: margin,
    y,
    size: 11,
    font,
    color: muted,
  });
  y -= 14;
  page.drawText(`Fecha: ${opts.createdAt}`, {
    x: margin,
    y,
    size: 11,
    font,
    color: muted,
  });
  y -= 20;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.82, 0.86, 0.92),
  });
  y -= 24;

  const rows: Array<[string, string]> = [
    ["Nombre", opts.data.nombre],
    ["Empresa", dash(opts.data.empresa)],
    ["Rubro", dash(opts.data.rubro)],
    ["Email", opts.data.email],
    ["Telefono", dash(opts.data.telefono)],
    ["Necesidades", opts.data.necesidades.join(" / ")],
    ["Como trabajan hoy", dash(opts.data.como_trabajan)],
    ["Problema / objetivo", opts.data.problema_principal],
    ["Usuarios", dash(opts.data.usuarios)],
    ["Plazo", dash(opts.data.plazo)],
    ["Presupuesto", dash(opts.data.presupuesto)],
    ["Observaciones", dash(opts.data.observaciones)],
    ["Estado", "Pendiente"],
  ];

  const maxWidth = width - margin * 2 - 130;

  function wrap(text: string, size: number) {
    const safe = pdfSafe(text);
    const words = safe.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : ["-"];
  }

  for (const [label, value] of rows) {
    if (y < 90) break;
    page.drawText(pdfSafe(label), {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: accent,
    });
    y -= 13;
    const lines = wrap(value, 10);
    for (const ln of lines) {
      if (y < 72) break;
      page.drawText(pdfSafe(ln), {
        x: margin,
        y,
        size: 10,
        font,
        color: ink,
      });
      y -= 13;
    }
    y -= 8;
  }

  page.drawLine({
    start: { x: margin, y: 56 },
    end: { x: width - margin, y: 56 },
    thickness: 1,
    color: rgb(0.82, 0.86, 0.92),
  });
  page.drawText("cmrsoftware.sn@gmail.com  ·  +54 9 336 457-8599  ·  CMR Software Solutions", {
    x: margin,
    y: 38,
    size: 8,
    font,
    color: muted,
  });

  return await doc.save();
}

async function sendMail(opts: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  pdfBase64?: string;
  filename?: string;
}) {
  const body: Record<string, unknown> = {
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };
  if (opts.pdfBase64 && opts.filename) {
    body.attachments = [{ filename: opts.filename, content: opts.pdfBase64 }];
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, message: "Método no permitido." });
  }

  try {
    const ip = clientIp(req);
    if (!allowRequest(ip)) {
      return json(429, {
        ok: false,
        message: "Demasiados envíos desde esta red. Esperá un minuto e intentá de nuevo.",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = resolveServiceKey();
    const anonKey = resolveAnonKey(req);
    const dbKey = serviceKey || anonKey;
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const mailFrom = Deno.env.get("MAIL_FROM") ?? "CMR Software Solutions <onboarding@resend.dev>";
    const mailTeam = Deno.env.get("MAIL_TEAM") ?? "cmrsoftware.sn@gmail.com";
    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    const logoUrl = Deno.env.get("LOGO_URL") ?? (siteUrl ? `${siteUrl.replace(/\/$/, "")}/IMG/logo2.png` : "");

    if (!supabaseUrl || !dbKey) {
      console.error("Missing Supabase env", {
        hasUrl: Boolean(supabaseUrl),
        hasServiceKey: Boolean(serviceKey),
        hasAnonKey: Boolean(anonKey),
      });
      return json(500, {
        ok: false,
        message: "Configuración del servidor incompleta (Supabase).",
      });
    }
    if (!resendKey) {
      console.error("Missing RESEND_API_KEY");
      return json(500, { ok: false, message: "Servicio de correo no configurado." });
    }

    let payload: Payload;
    try {
      payload = await req.json();
    } catch {
      return json(400, { ok: false, message: "JSON inválido." });
    }

    const { errors, data } = validate(payload);
    if (!data || Object.keys(errors).length) {
      return json(400, { ok: false, message: "Revisá los campos marcados.", errors });
    }

    const numero = buildNumero();
    const rpcArgs = {
      p_numero_solicitud: numero,
      p_nombre: data.nombre,
      p_empresa: data.empresa,
      p_rubro: data.rubro,
      p_email: data.email,
      p_telefono: data.telefono,
      p_necesidades: data.necesidades,
      p_como_trabajan: data.como_trabajan,
      p_problema_principal: data.problema_principal,
      p_usuarios: data.usuarios,
      p_plazo: data.plazo,
      p_presupuesto: data.presupuesto,
      p_observaciones: data.observaciones,
    };

    let row: { id: string; numero_solicitud: string; created_at: string } | null = null;
    const insertErrors: string[] = [];

    // 1) RPC security definer (funciona con anon key; no depende de service role)
    try {
      const supabase = createClient(supabaseUrl, dbKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: inserted, error: rpcError } = await supabase
        .rpc("crear_solicitud_asesoramiento", rpcArgs)
        .maybeSingle();
      if (!rpcError && inserted) {
        row = inserted as { id: string; numero_solicitud: string; created_at: string };
      } else {
        insertErrors.push(`rpc: ${rpcError?.message ?? "sin fila"} (${rpcError?.code ?? "?"})`);
      }
    } catch (e) {
      insertErrors.push(`rpc-ex: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2) Fallback: insert directo solo si hay service key
    if (!row && serviceKey) {
      const record = {
        numero_solicitud: numero,
        nombre: data.nombre,
        empresa: data.empresa,
        rubro: data.rubro,
        email: data.email,
        telefono: data.telefono,
        necesidades: data.necesidades,
        como_trabajan: data.como_trabajan,
        problema_principal: data.problema_principal,
        usuarios: data.usuarios,
        plazo: data.plazo,
        presupuesto: data.presupuesto,
        observaciones: data.observaciones,
        estado: "Pendiente",
      };
      try {
        const rest = await fetch(
          `${supabaseUrl}/rest/v1/solicitudes_asesoramiento?select=id,numero_solicitud,created_at`,
          {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(record),
          },
        );
        const text = await rest.text();
        if (rest.ok) {
          const rows = JSON.parse(text) as Array<{
            id: string;
            numero_solicitud: string;
            created_at: string;
          }>;
          if (rows?.[0]) row = rows[0];
          else insertErrors.push("rest: ok sin filas");
        } else {
          insertErrors.push(`rest: ${rest.status} ${text.slice(0, 400)}`);
        }
      } catch (e) {
        insertErrors.push(`rest-ex: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!row) {
      console.error("DB insert failed", insertErrors);
      return json(500, {
        ok: false,
        message: "No pudimos guardar la solicitud. Intentá de nuevo.",
        detail: insertErrors.join(" | "),
      });
    }

    let logoBytes: Uint8Array | null = null;
    if (logoUrl) {
      try {
        const logoRes = await fetch(logoUrl);
        if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
      } catch (e) {
        console.warn("Logo fetch failed", e);
      }
    }

    const createdAt = new Date(row.created_at).toLocaleString("es-AR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "America/Argentina/Buenos_Aires",
    });

    let pdfBase64 = "";
    const filename = `solicitud-${row.numero_solicitud}.pdf`;
    try {
      const pdfBytes = await buildPdf({
        numero: row.numero_solicitud,
        createdAt,
        data,
        logoBytes,
      });
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < pdfBytes.length; i += chunk) {
        binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk));
      }
      pdfBase64 = btoa(binary);
    } catch (e) {
      console.error("PDF build failed", e);
    }

    const safe = {
      nombre: escapeHtml(data.nombre),
      empresa: escapeHtml(dash(data.empresa)),
      email: escapeHtml(data.email),
      telefono: escapeHtml(dash(data.telefono)),
      necesidades: escapeHtml(data.necesidades.join(", ")),
      problema: escapeHtml(data.problema_principal),
      numero: escapeHtml(row.numero_solicitud),
    };

    const teamHtml = `
      <p>Se recibió una nueva solicitud desde la landing.</p>
      <p><strong>N.º:</strong> ${safe.numero}<br/>
      <strong>Nombre:</strong> ${safe.nombre}<br/>
      <strong>Empresa:</strong> ${safe.empresa}<br/>
      <strong>Email:</strong> ${safe.email}<br/>
      <strong>Teléfono:</strong> ${safe.telefono}<br/>
      <strong>Necesidades:</strong> ${safe.necesidades}<br/>
      <strong>Problema:</strong> ${safe.problema}</p>
      <p>${pdfBase64 ? "Adjuntamos el PDF completo de la solicitud." : "No se pudo generar el PDF; los datos están en la base."}</p>
    `;

    const clientHtml = `
      <p>Hola, <strong>${safe.nombre}</strong>.</p>
      <p>¡Muchas gracias por comunicarte con <strong>CMR Software Solutions</strong>!</p>
      <p>Recibimos correctamente tu solicitud de asesoramiento (<strong>${safe.numero}</strong>).</p>
      <p>Nuestro equipo revisará la información enviada y nos pondremos en contacto con vos a la brevedad para coordinar la reunión y comenzar a analizar tu proyecto.</p>
      <p>${pdfBase64 ? "Adjuntamos una copia de la solicitud que completaste para que puedas conservar un registro de la información enviada." : ""}</p>
      <p>Agradecemos la confianza depositada en nosotros.</p>
      <p>Saludos,<br/><strong>CMR Software Solutions</strong></p>
    `;

    const mailWarnings: string[] = [];

    try {
      await sendMail({
        apiKey: resendKey,
        from: mailFrom,
        to: [mailTeam],
        subject: "Nueva solicitud de asesoramiento",
        html: teamHtml,
        text: `Nueva solicitud ${row.numero_solicitud} de ${data.nombre} (${data.email}).`,
        pdfBase64: pdfBase64 || undefined,
        filename,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Team mail failed", msg);
      mailWarnings.push(`equipo: ${msg}`);
    }

    try {
      await sendMail({
        apiKey: resendKey,
        from: mailFrom,
        to: [data.email],
        subject: "Recibimos tu solicitud de asesoramiento - CMR Software Solutions",
        html: clientHtml,
        text: `Hola ${data.nombre}, recibimos tu solicitud ${row.numero_solicitud}. CMR Software Solutions.`,
        pdfBase64: pdfBase64 || undefined,
        filename,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Client mail failed", msg);
      mailWarnings.push(`cliente: ${msg}`);
    }

    return json(200, {
      ok: true,
      id: row.id,
      numero_solicitud: row.numero_solicitud,
      message: mailWarnings.length
        ? "Solicitud guardada. Revisá el correo del equipo (algunos envíos pueden fallar con el remitente de prueba de Resend)."
        : "Solicitud enviada con éxito.",
      mail_warnings: mailWarnings.length ? mailWarnings : undefined,
    });
  } catch (err) {
    console.error("submit-asesoramiento failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return json(500, {
      ok: false,
      message: "Ocurrió un error al procesar tu solicitud. Podés intentar de nuevo en unos minutos.",
      detail,
    });
  }
});
