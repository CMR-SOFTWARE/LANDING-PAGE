# Flujo de Solicitar asesoramiento (React + Supabase)

Este documento configura el envío real del formulario: guardado en base de datos, PDF y correos automáticos.

## Arquitectura

```
React (asesoramiento.html)
  → POST /functions/v1/submit-asesoramiento  (solo anon key pública)
    → valida
    → inserta en solicitudes_asesoramiento (service role)
    → genera PDF (pdf-lib)
    → email al equipo CMR (Resend + PDF)
    → email de confirmación al cliente (Resend + PDF)
```

**Nunca** se exponen `service_role` ni `RESEND_API_KEY` en el frontend.

## 1. Requisitos

- Node.js 20+ ([nodejs.org](https://nodejs.org))
- Cuenta [Supabase](https://supabase.com)
- Cuenta [Resend](https://resend.com) (envío de emails)
- Dominio verificado en Resend (o usar el remitente de prueba `onboarding@resend.dev` solo en desarrollo)

## 2. Base de datos

1. Creá un proyecto en Supabase.
2. Abrí **SQL Editor** y ejecutá el archivo:

`supabase/migrations/20260723220000_solicitudes_asesoramiento.sql`

Eso crea la tabla `solicitudes_asesoramiento` con UUID, timestamps, estado (`Pendiente` por defecto) e índices.

## 3. Edge Function

Instalá la CLI de Supabase y vinculá el proyecto:

```bash
npm i -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
```

Configurá secrets (reemplazá valores):

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set MAIL_FROM="CMR Software Solutions <hola@tu-dominio.com>"
supabase secrets set MAIL_TEAM=cmrsoftware.sn@gmail.com
supabase secrets set SITE_URL=https://tu-dominio.vercel.app
supabase secrets set LOGO_URL=https://tu-dominio.vercel.app/IMG/logo2.png
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` suelen inyectarse solos en Edge Functions; si faltan, agregalos desde **Project Settings → API**.

Deploy:

```bash
supabase functions deploy submit-asesoramiento --no-verify-jwt
```

## 4. Frontend (.env)

Copiá `.env.example` a `.env`:

```env
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

En Vercel: **Project → Settings → Environment Variables** con las mismas claves `VITE_*`.

## 5. Desarrollo local

```bash
npm install
npm run dev
```

Abrí `http://localhost:5500/asesoramiento.html`.

## 6. Build / deploy

```bash
npm run build
```

Salida en `dist/`. Vercel usa `vercel.json` (framework Vite).

## 7. Qué recibe cada parte

| Paso | Resultado |
|------|-----------|
| DB | Fila con todos los campos + `estado = Pendiente` |
| PDF | Logo, título, n.º solicitud, fecha, datos, pie de contacto |
| Mail equipo | Asunto «Nueva solicitud de asesoramiento» + PDF |
| Mail cliente | Mensaje de agradecimiento + mismo PDF |
| UI | Pantalla de éxito (sin `alert` / sin `mailto`) |

## Troubleshooting

- **Correo no llega:** revisá dominio/remitente en Resend y la carpeta spam.
- **500 en submit:** mirá logs de la función en Supabase → Edge Functions → Logs.
- **CORS:** la función ya responde `OPTIONS` con headers abiertos.
- **Logo ausente en PDF:** verificá `LOGO_URL` (PNG accesible por HTTPS).
