# Auditoría de producción — CMR Landing Page

**Fecha (pase 1):** 24 julio 2026  
**Fecha (pase 2 / refactor producción):** 28 julio 2026  
**Proyecto:** `LANDING-PAGE` (Vite multi-page + React island + Supabase)  
**Dominio:** https://cmrsoftwaresolutions.com/

## Arquitectura (decisión consciente)

**No se convirtió a SPA React.** El modelo correcto para este producto es:

| Capa | Tecnología |
|------|------------|
| Home | `index.html` + `public/main.js` + CSS |
| Formulario | `asesoramiento.html` + React 19 (`src/asesoramiento`) |
| Backend | Supabase Edge Function + Postgres |
| Host | Vercel |

Inventar carpetas tipo `hooks/providers/api` en la landing estática sería deuda innecesaria (viola KISS). El formulario React ya está separado en components / hooks / services / types.

## Resumen ejecutivo — pase 2

Se auditó el repo completo y se aplicaron correcciones de **fiabilidad, a11y, SEO, performance y limpieza**, sin cambiar la identidad visual ni agregar features de negocio.

`npm run build` (typecheck + Vite) **OK**.

## Correcciones aplicadas (pase 2)

### Fiabilidad / Motion
- Reveal gated con `html.js`: sin JavaScript el contenido **sigue visible** (antes `[data-reveal]` quedaba en `opacity: 0`).
- MutationObserver del formulario React ya no se salta si no hay nodes iniciales o con `prefers-reduced-motion`.
- Canvas del hero: **pausa** cuando está fuera de viewport o la pestaña está oculta.

### Accesibilidad
- `aria-labelledby` en `#problema` y `#servicios`.
- `<h1>` real en la página de asesoramiento (eyebrow deja de ser heading).
- Menú móvil: **focus trap** + `inert` / `aria-hidden` en el contenido principal.

### SEO / URLs
- Canonical y sitemap usan `/asesoramiento` (rewrite Vercel).
- Links internos y CTAs apuntan a `/asesoramiento`.

### Performance / infra
- Cache-Control en CSS/JS, `/IMG/*` y sitemap/robots/manifest (`vercel.json`).
- CSS muerto removido: módulos hero, status chips, bloque comentado `#hero::after`, listener `.js-scroll-form`.

### Consistencia
- Contraste del footer bottom ligeramente mejorado.
- Estilos de heading del formulario soportan `h1`.

## Hallazgos pendientes (manual / siguiente sprint)

| Prioridad | Ítem |
|-----------|------|
| Alta | Redeploy Edge Function `submit-asesoramiento` (si no se hizo tras el pase 1) |
| Alta | Dominio verificado en Resend + `MAIL_FROM` |
| Alta | Rotar claves si se pegaron en chat |
| Media | Convertir/comprimir imágenes a WebP + `srcset` (hero + proyectos); renombrar assets Joby |
| Media | Imagen OG 1200×630 dedicada |
| Media | Self-host / subset Font Awesome |
| Media | Restringir `EXECUTE` del RPC a `service_role` cuando el secret esté estable |
| Baja | Purgar IMG huérfanas (`hero.png`, carpetas TURNOS/FERRETERÍA viejas, etc.) |
| Baja | CSS split más fino para `asesoramiento` (no cargar toda la atmósfera de la landing) |
| Baja | CSP / HSTS en Vercel |

## Qué NO se hizo (a propósito)

- No se reescribió la landing como app React con hooks/memo/Suspense: **no aporta** al stack actual y aumentaría complejidad.
- No se borraron automáticamente todas las imágenes huérfanas (riesgo de borrar assets aún usados offline).
- No se regeneraron capturas WebP en esta pasada (requiere pipeline de assets y QA visual).

## Verificación

```bash
npm run build
```

Revisar en local: http://127.0.0.1:5500/ (hard refresh).

Checklist QA rápido:
- [ ] Secciones visibles con JS desactivado (DevTools → Settings → Disable JavaScript)
- [ ] Menú móvil: Tab cicla dentro del drawer; ESC cierra
- [ ] Canvas hero no consume CPU al scrollear lejos del hero
- [ ] `/asesoramiento` carga el formulario; heading es H1
- [ ] Planes / Proyectos / Footer sin overflow horizontal en 375px
