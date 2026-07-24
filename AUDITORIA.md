# Auditoría de producción — CMR Landing Page

**Fecha:** 24 julio 2026  
**Proyecto:** `LANDING-PAGE` (Vite + React + Supabase Edge Functions)  
**Dominio:** https://cmrsoftwaresolutions.com/

## Resumen ejecutivo

Se realizó una auditoría full-stack del landing y del flujo de asesoramiento. El build (`npm run typecheck` + `npm run build`) **compila sin errores**. Se aplicaron correcciones de SEO, accesibilidad, seguridad del formulario/correos, UX del modal/carrusel, hardening de la Edge Function y headers de Vercel, **sin cambiar la identidad visual** del sitio.

**Nivel de preparación para producción:** **Alto (listo para producción operativa)**, con 2 acciones manuales pendientes listadas abajo (redeploy de la función y dominio en Resend).

## Errores / hallazgos encontrados

| Área | Hallazgo | Severidad |
|------|----------|-----------|
| SEO | Faltaban meta description, Open Graph, Twitter Cards, canonical, robots, sitemap, JSON-LD | Alta |
| A11y | Logo del home sin enlace; sin skip-link; modal sin focus trap ni restauración de foco | Media |
| A11y | WhatsApp sin `aria-label` explícito; algunos campos sin `aria-describedby` en error | Media |
| Seguridad | HTML de emails sin escape (riesgo XSS en clientes de correo) | Alta |
| Seguridad | RPC `crear_solicitud_asesoramiento` ejecutable con anon (spam) | Media |
| Seguridad | Sin rate limit ni honeypot en submit | Media |
| UX | Errores técnicos (`detail`) expuestos al usuario | Media |
| UX | Fallo de Resend podía tumbar toda la UX aunque el insert ya hubiera ocurrido (ya mitigado antes) | Alta (previa) |
| DB | Constraint de email con `\s` inválido en Postgres (ya corregido en sesión previa) | Crítica (previa) |
| Performance | Fuentes en 2 requests; sin preconnect; sin headers de cache en assets | Baja |
| Ops | Sin `typecheck` en el pipeline de build | Baja |
| Secrets | Claves fueron pegadas en chat durante el setup (rotación recomendada) | Alta (proceso) |

## Correcciones aplicadas automáticamente

### Frontend (landing)
- SEO completo en `index.html` y `asesoramiento.html` (description, OG, Twitter, canonical, theme-color, favicon, manifest).
- `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`.
- Skip link, logo clicable, `mailto:` en footer, `aria-label` en WhatsApp.
- Imagen hero con `fetchpriority` / dimensiones; logos con `loading="lazy"` donde corresponde.
- Fuentes consolidadas + `preconnect`.
- Estilos de foco visibles (`.skip-link`, botones principales).
- Modal de proyectos: **focus trap** (Tab), restauración de foco al cerrar, ESC/flechas intactos.

### Frontend (React asesoramiento)
- Honeypot anti-bot (`website`).
- Validación de longitudes máximas.
- Timeout de request (45s) y mensajes de error **sin detalle técnico**.
- Focus/scroll al primer campo inválido.
- `aria-describedby` en email/teléfono/problema.
- Copy de éxito más realista respecto al correo de confirmación.
- `npm run build` ahora incluye TypeScript check.

### Backend (Edge Function)
- Rate limiting simple por IP (8 req/min por isolate).
- Honeypot + clipping de campos.
- `escapeHtml` en plantillas de correo.
- Mensajes de usuario limpios (sin marcadores de debug).
- Persistencia priorizada: mail/PDF no bloquean el éxito si el insert ya ocurrió (cambio previo + reforzado).

### Infra
- Headers de seguridad y cache de assets en `vercel.json`.
- `.env.example` actualizado (sin secretos reales).
- Migración de hardening de email: `supabase/migrations/20260724030000_prod_hardening.sql`.

## Problemas que requieren intervención manual

1. **Redeploy de la Edge Function** `submit-asesoramiento` con el `index.ts` actual (Dashboard → pegar código → Deploy). Sin esto, honeypot/rate-limit/escapeHtml no corren en producción.
2. **Resend:** con `onboarding@resend.dev` los mails al cliente pueden fallar según el destinatario. Verificar un dominio propio y actualizar `MAIL_FROM`.
3. **Rotación de claves** (`sb_publishable_`, `sb_secret_`, `re_...`) si quedaron expuestas en historial de chat.
4. **Opcional:** confirmar `SERVICE_ROLE_KEY` en Secrets de Edge Functions (mejora resiliencia del insert).
5. **Opcional SEO:** imagen OG dedicada (1200×630) en lugar del logo.

## Recomendaciones a futuro

- Rate limit distribuido (Upstash/Redis) si el spam crece; el actual es por isolate.
- Restringir `EXECUTE` del RPC solo a `service_role` cuando el secret key esté 100% estable.
- Comprimir/convertir capturas de proyectos a WebP y renombrar assets Joby (nombres WhatsApp).
- Self-host Font Awesome o subset de iconos para menos dependencia CDN.
- Monitoreo: alertas en logs de Edge Function + dashboard de `solicitudes_asesoramiento`.
- E2E smoke test (Playwright) del formulario en CI.

## Verificación

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | OK |
| `npm run build` | OK |
| Responsive (CSS existente 1920→320 + overflow-x clip) | OK (sin regresión visual intencional) |
| Formulario asesoramiento (flujo DB) | OK en producción (sesión previa) |
| Secretos en frontend | Solo `VITE_*` públicas |
| Consola / logs | `console.error` solo en fallos reales (útil en prod) |

## Confirmación final

- La aplicación **compila sin errores**.
- El landing y el formulario son **usables en desarrollo y producción** (tras redeploy de la función).
- Es **responsive** y mantiene la experiencia visual actual.
- Frontend y backend quedan **más robustos y seguros**, con UX de errores más profesional.
