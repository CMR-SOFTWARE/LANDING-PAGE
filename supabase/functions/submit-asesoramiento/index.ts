-- CMR Landing — Edge Function: submit-asesoramiento
-- Deploy: supabase functions deploy submit-asesoramiento --no-verify-jwt
-- Secrets (Dashboard o CLI):
--   SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, MAIL_FROM, MAIL_TEAM, SITE_URL, LOGO_URL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

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
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trim(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
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
  const nombre = trim(p.nombre);
  const email = trim(p.email).toLowerCase();
  const telefono = trim(p.telefono);
  const problema = trim(p.problema_principal);
  const necesidades = Array.isArray(p.necesidades)
    ? p.necesidades.map((n) => trim(n)).filter(Boolean)
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
      empresa: trim(p.empresa) || null,
      rubro: trim(p.rubro) || null,
      email,
      telefono: telefono || null,
      necesidades,
      como_trabajan: trim(p.como_trabajan) || null,
      problema_principal: problema,
      usuarios: trim(p.usuarios) || null,
      plazo: trim(p.plazo) || null,
      presupuesto: trim(p.presupuesto) || null,
      observaciones: trim(p.observaciones) || null,
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
  return v && v.trim() ? v : "—";
}

async function buildPdf(opts: {
  numero: string;
  createdAt: string;
  data: ReturnType<typeof validate>["data"];
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
    ["Teléfono", dash(opts.data.telefono)],
    ["Necesidades", opts.data.necesidades.join(" · ")],
    ["Cómo trabajan hoy", dash(opts.data.como_trabajan)],
    ["Problema / objetivo", opts.data.problema_principal],
    ["Usuarios", dash(opts.data.usuarios)],
    ["Plazo", dash(opts.data.plazo)],
    ["Presupuesto", dash(opts.data.presupuesto)],
    ["Observaciones", dash(opts.data.observaciones)],
    ["Estado", "Pendiente"],
  ];

  const maxWidth = width - margin * 2 - 130;

  function wrap(text: string, size: number) {
    const words = text.split(/\s+/);
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
    return lines.length ? lines : ["—"];
  }

  for (const [label, value] of rows) {
    if (y < 90) break;
    page.drawText(label, {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: accent,
    });
    y -= 13;
    const lines = wrap(value, 10);
    for (const ln of lines) {
      if (y < 80) break;
      page.drawText(ln, {
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
  pdfBase64: string;
  filename: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: [{ filename: opts.filename, content: opts.pdfBase64 }],
    }),
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const mailFrom = Deno.env.get("MAIL_FROM") ?? "CMR Software Solutions <onboarding@resend.dev>";
    const mailTeam = Deno.env.get("MAIL_TEAM") ?? "cmrsoftware.sn@gmail.com";
    const siteUrl = Deno.env.get("SITE_URL") ?? "";
    const logoUrl = Deno.env.get("LOGO_URL") ?? (siteUrl ? `${siteUrl.replace(/\/$/, "")}/IMG/logo2.png` : "");

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase env");
      return json(500, { ok: false, message: "Configuración del servidor incompleta." });
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
    if (Object.keys(errors).length) {
      return json(400, { ok: false, message: "Revisá los campos marcados.", errors });
    }

    const numero = buildNumero();
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: row, error: dbError } = await supabase
      .from("solicitudes_asesoramiento")
      .insert({
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
      })
      .select("id, numero_solicitud, created_at")
      .single();

    if (dbError || !row) {
      console.error("DB insert error", dbError);
      return json(500, { ok: false, message: "No pudimos guardar la solicitud. Intentá de nuevo." });
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

    const pdfBytes = await buildPdf({
      numero: row.numero_solicitud,
      createdAt,
      data,
      logoBytes,
    });

    const filename = `solicitud-${row.numero_solicitud}.pdf`;

    const teamHtml = `
      <p>Se recibió una nueva solicitud desde la landing.</p>
      <p><strong>N.º:</strong> ${row.numero_solicitud}<br/>
      <strong>Nombre:</strong> ${data.nombre}<br/>
      <strong>Empresa:</strong> ${dash(data.empresa)}<br/>
      <strong>Email:</strong> ${data.email}<br/>
      <strong>Teléfono:</strong> ${dash(data.telefono)}<br/>
      <strong>Necesidades:</strong> ${data.necesidades.join(", ")}<br/>
      <strong>Problema:</strong> ${data.problema_principal}</p>
      <p>Adjuntamos el PDF completo de la solicitud.</p>
    `;

    const clientHtml = `
      <p>Hola, <strong>${data.nombre}</strong>.</p>
      <p>¡Muchas gracias por comunicarte con <strong>CMR Software Solutions</strong>!</p>
      <p>Recibimos correctamente tu solicitud de asesoramiento (<strong>${row.numero_solicitud}</strong>).</p>
      <p>Nuestro equipo revisará la información enviada y nos pondremos en contacto con vos a la brevedad para coordinar la reunión y comenzar a analizar tu proyecto.</p>
      <p>Adjuntamos una copia de la solicitud que completaste para que puedas conservar un registro de la información enviada.</p>
      <p>Agradecemos la confianza depositada en nosotros.</p>
      <p>Saludos,<br/><strong>CMR Software Solutions</strong></p>
    `;

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += chunk) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk));
    }
    const pdfBase64 = btoa(binary);

    await sendMail({
      apiKey: resendKey,
      from: mailFrom,
      to: [mailTeam],
      subject: "Nueva solicitud de asesoramiento",
      html: teamHtml,
      text: `Nueva solicitud ${row.numero_solicitud} de ${data.nombre} (${data.email}).`,
      pdfBase64,
      filename,
    });

    await sendMail({
      apiKey: resendKey,
      from: mailFrom,
      to: [data.email],
      subject: "Recibimos tu solicitud de asesoramiento — CMR Software Solutions",
      html: clientHtml,
      text: `Hola ${data.nombre}, recibimos tu solicitud ${row.numero_solicitud}. CMR Software Solutions.`,
      pdfBase64,
      filename,
    });

    return json(200, {
      ok: true,
      id: row.id,
      numero_solicitud: row.numero_solicitud,
      message: "Solicitud enviada con éxito.",
    });
  } catch (err) {
    console.error("submit-asesoramiento failed", err);
    return json(500, {
      ok: false,
      message: "Ocurrió un error al procesar tu solicitud. Podés intentar de nuevo en unos minutos.",
    });
  }
});
