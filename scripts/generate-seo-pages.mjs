/**
 * Genera páginas SEO estáticas (servicios, proyectos, institucional)
 * con el mismo shell visual de content-pages.css.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = "2026-08-09";

const org = {
  name: "CMR Software Solutions",
  url: "https://cmrsoftwaresolutions.com/",
  email: "cmrsoftware.sn@gmail.com",
  phoneDisplay: "+54 9 336 457-8599",
  phoneE164: "+5493364578599",
  wa: "https://wa.me/5493364578599?text=Hola%20CMR%2C%20me%20gustar%C3%ADa%20recibir%20informaci%C3%B3n%20sobre%20sus%20servicios.",
  ig: "https://www.instagram.com/cmrsoftware.sn/",
  locality: "San Nicolás de los Arroyos",
  region: "Buenos Aires",
  country: "Argentina",
  logo: "https://cmrsoftwaresolutions.com/IMG/logo2.png",
  og: "https://cmrsoftwaresolutions.com/IMG/og-cmr-software-solutions.jpg",
};

function shell({ title, description, canonical, ogType = "website", breadcrumb, h1, kicker, lead, bodyHtml, jsonLd, navActive }) {
  const crumbs = breadcrumb
    .map(
      (c, i) =>
        `<li>${i < breadcrumb.length - 1 ? `<a href="${c.href}">${c.name}</a>` : `<span aria-current="page">${c.name}</span>`}</li>`,
    )
    .join("\n          ");

  const nav = (href, label, key) =>
    `<li><a href="${href}"${navActive === key ? ' aria-current="page"' : ""}>${label}</a></li>`;

  return `<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
  <meta name="theme-color" content="#404da0">
  <meta name="author" content="CMR Software Solutions">
  <meta name="geo.region" content="AR-B">
  <meta name="geo.placename" content="San Nicolás de los Arroyos">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="es-AR" href="${canonical}">
  <link rel="alternate" hreflang="es" href="${canonical}">
  <link rel="alternate" hreflang="x-default" href="${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">
  <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">
  <link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48">
  <link rel="icon" href="/IMG/icon-192.png" type="image/png" sizes="192x192">
  <link rel="icon" href="/IMG/icon-512.png" type="image/png" sizes="512x512">
  <link rel="apple-touch-icon" href="/IMG/apple-touch-icon.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="application-name" content="CMR Software Solutions">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XP8CCCV7PN"></script>
  <script src="/ga.js" defer></script>
  <meta property="og:type" content="${ogType}">
  <meta property="og:locale" content="es_AR">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="CMR Software Solutions">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${org.og}">
  <meta property="og:image:secure_url" content="${org.og}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="CMR Software Solutions">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${org.og}">
  <meta name="twitter:image:alt" content="CMR Software Solutions">
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/mobile.css">
  <link rel="stylesheet" href="/polish.css">
  <link rel="stylesheet" href="/content-pages.css">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Orbitron:wght@400;600&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Orbitron:wght@400;600&display=swap" rel="stylesheet"></noscript>
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body class="page-content">
  <a class="skip-link" href="#contenido-principal">Saltar al contenido</a>
  <header>
    <nav class="site-nav" aria-label="Principal">
      <a href="/" class="logo-link" aria-label="CMR Software Solutions — inicio">
        <img src="/IMG/logo2.png" alt="CMR Software Solutions" class="logo" width="200" height="51" decoding="async">
      </a>
      <ul class="nav-primary">
        ${nav("/", "Inicio", "inicio")}
        ${nav("/servicios", "Servicios", "servicios")}
        ${nav("/proyectos", "Proyectos", "proyectos")}
        ${nav("/sobre-nosotros", "Sobre nosotros", "sobre")}
        ${nav("/blog", "Blog", "blog")}
        ${nav("/contacto", "Contacto", "contacto")}
        <li><a href="/asesoramiento" class="btn-nav">Solicitar asesoramiento</a></li>
      </ul>
    </nav>
  </header>

  <main id="contenido-principal" class="content-shell content-shell--wide">
    <nav class="content-breadcrumb" aria-label="Miga de pan">
      <ol>
          ${crumbs}
      </ol>
    </nav>
    <p class="content-kicker">${kicker}</p>
    <h1>${h1}</h1>
    <p class="content-lead">${lead}</p>
    <div class="content-card content-prose">
${bodyHtml}
    </div>
    <div class="content-cta" style="margin-top:2rem">
      <a class="btn-primary" href="/asesoramiento">Solicitar asesoramiento</a>
      <a class="btn-form-secondary" href="${org.wa}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
    </div>
  </main>

  <footer id="footer">
    <div class="footer-bottom">
      <p>© 2026 CMR Software Solutions — San Nicolás de los Arroyos, Buenos Aires, Argentina</p>
      <nav class="footer-legal" aria-label="Legal y sitio">
        <a href="/servicios">Servicios</a>
        <a href="/proyectos">Proyectos</a>
        <a href="/sobre-nosotros">Sobre nosotros</a>
        <a href="/contacto">Contacto</a>
        <a href="/blog">Blog</a>
        <a href="/privacidad">Privacidad</a>
        <a href="/cookies">Cookies</a>
        <a href="/terminos">Términos</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;
}

function breadcrumbLd(items) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${items[items.length - 1].item}#breadcrumb`,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  };
}

function orgRef() {
  return { "@id": "https://cmrsoftwaresolutions.com/#organization" };
}

const pages = [];

function add(fileRel, opts) {
  pages.push({ fileRel, ...opts });
}

add("servicios/index.html", {
  title: "Servicios de desarrollo de software | CMR Software Solutions",
  description:
    "Servicios de CMR Software Solutions en San Nicolás de los Arroyos: software a medida, desarrollo web, automatización e integraciones para empresas en Argentina.",
  canonical: "https://cmrsoftwaresolutions.com/servicios",
  navActive: "servicios",
  kicker: "Servicios",
  h1: "Servicios de desarrollo de software de CMR Software Solutions",
  lead: "Diseñamos y construimos tecnología a medida para comercios, empresas, instituciones, clubes y profesionales en San Nicolás de los Arroyos, Buenos Aires y toda Argentina.",
  breadcrumb: [
    { name: "Inicio", href: "/" },
    { name: "Servicios", href: "/servicios" },
  ],
  bodyHtml: `
      <p><strong>CMR Software Solutions</strong> es una empresa de desarrollo de software con base en ${org.locality}. Acompañamos proyectos desde el relevamiento hasta el lanzamiento y el soporte.</p>
      <h2>Nuestros servicios</h2>
      <ul>
        <li><a href="/servicios/desarrollo-software">Desarrollo de software</a> — sistemas y aplicaciones alineados a tu operación.</li>
        <li><a href="/servicios/software-a-medida">Software a medida</a> — soluciones personalizadas cuando un producto genérico no alcanza.</li>
        <li><a href="/servicios/desarrollo-web">Desarrollo web</a> — sitios, landings y ecommerce con presencia profesional.</li>
        <li><a href="/servicios/automatizacion">Automatización</a> — menos tareas repetitivas y procesos más ordenados.</li>
      </ul>
      <h2>A quién ayudamos</h2>
      <p>Trabajamos con comercios, pymes, instituciones, clubes y profesionales que necesitan digitalizar gestión, ventas, turnos, inventario o atención al cliente. También atendemos proyectos remotos en toda Argentina.</p>
      <h2>Cómo empezamos</h2>
      <p>Podés <a href="/asesoramiento">solicitar asesoramiento</a> o escribirnos por WhatsApp. Coordinamos una reunión sin cargo para entender el problema y proponer el camino técnico más claro.</p>
      <p>Conocé también nuestros <a href="/proyectos">proyectos y casos reales</a>.</p>
    `,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://cmrsoftwaresolutions.com/servicios#webpage",
        url: "https://cmrsoftwaresolutions.com/servicios",
        name: "Servicios de desarrollo de software | CMR Software Solutions",
        description:
          "Servicios de software a medida, desarrollo web y automatización de CMR Software Solutions.",
        isPartOf: { "@id": "https://cmrsoftwaresolutions.com/#website" },
        about: orgRef(),
        breadcrumb: { "@id": "https://cmrsoftwaresolutions.com/servicios#breadcrumb" },
      },
      breadcrumbLd([
        { name: "Inicio", item: "https://cmrsoftwaresolutions.com/" },
        { name: "Servicios", item: "https://cmrsoftwaresolutions.com/servicios" },
      ]),
    ],
  },
});

const servicePages = [
  {
    slug: "desarrollo-software",
    title: "Desarrollo de Software en San Nicolás | CMR Software Solutions",
    description:
      "Desarrollo de software para empresas en San Nicolás de los Arroyos y Argentina. CMR Software Solutions construye sistemas, apps y plataformas a medida.",
    h1: "Desarrollo de software en San Nicolás de los Arroyos",
    lead: "CMR Software Solutions diseña y desarrolla software para digitalizar operaciones reales: gestión, ventas, turnos, paneles e integraciones.",
    serviceName: "Desarrollo de software",
    body: `
      <p>El desarrollo de software en CMR no parte de una plantilla genérica: partimos de cómo trabaja tu equipo hoy y de qué resultados necesitás medir mañana.</p>
      <h2>Qué incluye</h2>
      <ul>
        <li>Relevamiento de procesos y definición de alcance</li>
        <li>Arquitectura, diseño UX/UI y prototipos</li>
        <li>Desarrollo frontend y backend con tecnologías modernas</li>
        <li>Pruebas, puesta en marcha, capacitación y soporte</li>
      </ul>
      <h2>Beneficios</h2>
      <ul>
        <li>Procesos menos manuales y menos errores</li>
        <li>Información centralizada para decidir con datos</li>
        <li>Solución escalable a medida que crece el negocio</li>
      </ul>
      <h2>Proceso</h2>
      <ol>
        <li>Descubrimiento y priorización</li>
        <li>Diseño y arquitectura</li>
        <li>Desarrollo iterativo con entregas visibles</li>
        <li>Lanzamiento, capacitación y acompañamiento</li>
      </ol>
      <h2>Tecnologías</h2>
      <p>Trabajamos principalmente con React, Next.js, Node.js, Supabase y bases SQL, según el alcance del proyecto.</p>
      <p>Si buscás una solución 100% personalizada, también ofrecemos <a href="/servicios/software-a-medida">software a medida</a>. Para presencia online, mirá <a href="/servicios/desarrollo-web">desarrollo web</a>.</p>
    `,
  },
  {
    slug: "software-a-medida",
    title: "Software a Medida en San Nicolás | CMR Software Solutions",
    description:
      "Software a medida para pymes y empresas en San Nicolás de los Arroyos. CMR Software Solutions desarrolla sistemas personalizados cuando lo genérico no alcanza.",
    h1: "Software a medida para empresas",
    lead: "Cuando Excel, planillas o un SaaS genérico ya no alcanzan, construimos un sistema pensado para tu forma de operar.",
    serviceName: "Software a medida",
    body: `
      <p><strong>CMR Software Solutions</strong> desarrolla software a medida para comercios, empresas e instituciones en ${org.locality} y el resto de Argentina.</p>
      <h2>Cuándo conviene</h2>
      <ul>
        <li>Tus procesos son específicos y no encajan en un producto cerrado</li>
        <li>Necesitás integrar varias herramientas en un solo flujo</li>
        <li>Querés control real sobre datos, permisos y reportes</li>
      </ul>
      <h2>Qué resolvemos</h2>
      <ul>
        <li>Sistemas de gestión y paneles administrativos</li>
        <li>Flujos de pedidos, inventario y clientes</li>
        <li>Turnos, reservas y operación de servicios</li>
        <li>Integraciones API entre sistemas existentes</li>
      </ul>
      <h2>Beneficios</h2>
      <p>Una solución a medida reduce retrabajo, ordena la información y acompaña el crecimiento sin forzar tu operación a un molde ajeno.</p>
      <h2>Proceso</h2>
      <p>Empezamos con una reunión de descubrimiento, definimos alcance y prioridades, y construimos por etapas para que veas avances reales desde el principio.</p>
      <p>Mirá ejemplos en <a href="/proyectos">nuestros proyectos</a> o pedí una propuesta desde <a href="/asesoramiento">asesoramiento</a>.</p>
    `,
  },
  {
    slug: "desarrollo-web",
    title: "Desarrollo Web en San Nicolás | CMR Software Solutions",
    description:
      "Desarrollo web profesional en San Nicolás de los Arroyos: sitios, landings y ecommerce. CMR Software Solutions crea presencia digital clara y usable.",
    h1: "Desarrollo web para negocios en San Nicolás",
    lead: "Sitios web, landings y tiendas online pensados para comunicar bien, cargar rápido y convertir consultas en conversaciones.",
    serviceName: "Desarrollo web",
    body: `
      <p>En CMR construimos presencia web con diseño responsive, dominio, hosting, SSL e integración con WhatsApp cuando aporta valor comercial.</p>
      <h2>Qué podemos desarrollar</h2>
      <ul>
        <li>Sitios institucionales y landings de conversión</li>
        <li>Ecommerce con catálogo, carrito y pedidos</li>
        <li>Paneles para administrar contenidos o productos</li>
      </ul>
      <h2>Beneficios</h2>
      <ul>
        <li>Imagen profesional y coherente con tu marca</li>
        <li>Mejor experiencia en celular y escritorio</li>
        <li>Base lista para crecer hacia un sistema más completo</li>
      </ul>
      <h2>Proceso</h2>
      <ol>
        <li>Definición de objetivos y estructura de contenidos</li>
        <li>Diseño y desarrollo</li>
        <li>Publicación, revisión y soporte</li>
      </ol>
      <p>Si además necesitás digitalizar la operación interna, explorá <a href="/servicios/software-a-medida">software a medida</a> o el <a href="/servicios/desarrollo-software">desarrollo de software</a>.</p>
    `,
  },
  {
    slug: "automatizacion",
    title: "Automatización de Procesos | CMR Software Solutions",
    description:
      "Automatización de procesos empresariales con CMR Software Solutions en San Nicolás de los Arroyos: menos tareas repetitivas y más control operativo.",
    h1: "Automatización de procesos empresariales",
    lead: "Identificamos tareas repetitivas y diseñamos flujos que ahorran tiempo, reducen errores y ordenan la información del negocio.",
    serviceName: "Automatización de procesos",
    body: `
      <p>La automatización en CMR no es “tecnología por tecnología”: priorizamos el proceso que más fricción genera y lo convertimos en un flujo claro.</p>
      <h2>Ejemplos de automatización</h2>
      <ul>
        <li>Pedidos y notificaciones por WhatsApp u otros canales</li>
        <li>Carga y sincronización de datos entre sistemas</li>
        <li>Alertas, recordatorios y reportes periódicos</li>
        <li>Integraciones API con herramientas que ya usás</li>
      </ul>
      <h2>Beneficios</h2>
      <ul>
        <li>Menos carga operativa manual</li>
        <li>Menos errores de tipeo o demoras</li>
        <li>Más tiempo para atención, ventas o gestión</li>
      </ul>
      <h2>Cómo trabajamos</h2>
      <p>Mapeamos el proceso actual, detectamos cuellos de botella y proponemos una automatización viable, medible y mantenible. Podés empezar por <a href="/asesoramiento">una reunión de asesoramiento</a>.</p>
    `,
  },
];

for (const s of servicePages) {
  const canonical = `https://cmrsoftwaresolutions.com/servicios/${s.slug}`;
  add(`servicios/${s.slug}.html`, {
    title: s.title,
    description: s.description,
    canonical,
    navActive: "servicios",
    kicker: "Servicio",
    h1: s.h1,
    lead: s.lead,
    breadcrumb: [
      { name: "Inicio", href: "/" },
      { name: "Servicios", href: "/servicios" },
      { name: s.serviceName, href: `/servicios/${s.slug}` },
    ],
    bodyHtml: s.body,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          "@id": `${canonical}#service`,
          name: s.serviceName,
          description: s.description,
          url: canonical,
          provider: orgRef(),
          areaServed: [
            { "@type": "City", name: "San Nicolás de los Arroyos" },
            { "@type": "Country", name: "Argentina" },
          ],
        },
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: s.title,
          description: s.description,
          isPartOf: { "@id": "https://cmrsoftwaresolutions.com/#website" },
          about: { "@id": `${canonical}#service` },
          breadcrumb: { "@id": `${canonical}#breadcrumb` },
        },
        breadcrumbLd([
          { name: "Inicio", item: "https://cmrsoftwaresolutions.com/" },
          { name: "Servicios", item: "https://cmrsoftwaresolutions.com/servicios" },
          { name: s.serviceName, item: canonical },
        ]),
      ],
    },
  });
}

add("proyectos/index.html", {
  title: "Proyectos y casos | CMR Software Solutions",
  description:
    "Casos reales de CMR Software Solutions: ecommerce, gestión de canchas, unidad sanitaria, app Joby y más. Software desarrollado para negocios en Argentina.",
  canonical: "https://cmrsoftwaresolutions.com/proyectos",
  navActive: "proyectos",
  kicker: "Proyectos",
  h1: "Proyectos desarrollados por CMR Software Solutions",
  lead: "Selección de trabajos reales: e-commerce, sistemas de gestión, plataformas de turnos y aplicaciones. Cada caso muestra un problema concreto y la solución construida.",
  breadcrumb: [
    { name: "Inicio", href: "/" },
    { name: "Proyectos", href: "/proyectos" },
  ],
  bodyHtml: `
      <ul>
        <li><a href="/proyectos/ecommerce-ferreteria">E-commerce de ferretería</a> — catálogo, carrito y pedidos por WhatsApp.</li>
        <li><a href="/proyectos/gestion-canchas">Gestión de canchas</a> — reservas y operación para clubs y complejos.</li>
        <li><a href="/proyectos/unidad-sanitaria">Unidad sanitaria</a> — panel de indicadores, patologías y seguimiento.</li>
        <li><a href="/proyectos/joby">Joby</a> — aplicación móvil publicada en Google Play.</li>
      </ul>
      <p>Si tenés un proyecto similar, <a href="/contacto">contactanos</a> o <a href="/asesoramiento">solicitá asesoramiento</a>.</p>
    `,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://cmrsoftwaresolutions.com/proyectos#webpage",
        url: "https://cmrsoftwaresolutions.com/proyectos",
        name: "Proyectos | CMR Software Solutions",
        isPartOf: { "@id": "https://cmrsoftwaresolutions.com/#website" },
        about: orgRef(),
        breadcrumb: { "@id": "https://cmrsoftwaresolutions.com/proyectos#breadcrumb" },
      },
      breadcrumbLd([
        { name: "Inicio", item: "https://cmrsoftwaresolutions.com/" },
        { name: "Proyectos", item: "https://cmrsoftwaresolutions.com/proyectos" },
      ]),
    ],
  },
});

const projects = [
  {
    slug: "ecommerce-ferreteria",
    title: "E-commerce de Ferretería | Caso CMR Software Solutions",
    description:
      "Caso de e-commerce para ferretería desarrollado por CMR Software Solutions: catálogo digital, filtros, carrito y pedidos por WhatsApp.",
    h1: "E-commerce de ferretería",
    lead: "Catálogo online con filtros, carrito y pedidos por WhatsApp para vender sin fricción.",
    img: "/IMG/proyectos/ecommerce-ferreteria/ferre1.png",
    live: "https://ferreteriagonzalezhnos.com/",
    body: `
      <p><img src="/IMG/proyectos/ecommerce-ferreteria/ferre1.png" alt="Catálogo online del e-commerce de ferretería desarrollado por CMR Software Solutions" width="960" height="540" loading="lazy" decoding="async"></p>
      <h2>Problema</h2>
      <p>El comercio necesitaba mostrar productos de forma ordenada y recibir pedidos sin depender solo de consultas manuales dispersas.</p>
      <h2>Solución</h2>
      <p>Desarrollamos un e-commerce con catálogo, filtros, carrito y cierre de pedido orientado a WhatsApp, más panel de administración.</p>
      <h2>Funcionalidades</h2>
      <ul>
        <li>Catálogo con fotos y filtros</li>
        <li>Carrito y armado de pedido</li>
        <li>Canal de pedido por WhatsApp</li>
        <li>Panel para administrar productos</li>
      </ul>
      <h2>Objetivo</h2>
      <p>Facilitar la venta digital y ordenar la experiencia de consulta y pedido para el cliente final.</p>
      <p><a href="${"https://ferreteriagonzalezhnos.com/"}" target="_blank" rel="noopener noreferrer">Ver sitio en vivo</a> · <a href="/proyectos">Volver a proyectos</a> · <a href="/servicios/desarrollo-web">Servicio de desarrollo web</a></p>
    `,
  },
  {
    slug: "gestion-canchas",
    title: "Gestión de Canchas | Caso CMR Software Solutions",
    description:
      "Sistema de gestión y reservas de canchas desarrollado por CMR Software Solutions (CMR Match) para clubs y complejos deportivos.",
    h1: "Sistema de gestión de canchas",
    lead: "Plataforma para reservas y operación de canchas: experiencia clara para jugadores y gestión para el club.",
    img: "/IMG/proyectos/cmr-match/cancha1.png",
    live: "https://cmrcanchas.com/",
    body: `
      <p><img src="/IMG/proyectos/cmr-match/cancha1.png" alt="Sistema de reservas de canchas CMR Match desarrollado por CMR Software Solutions" width="960" height="540" loading="lazy" decoding="async"></p>
      <h2>Problema</h2>
      <p>Reservar y administrar canchas por canales informales genera solapamientos, pérdida de turnos y poco control operativo.</p>
      <h2>Solución</h2>
      <p>Desde <strong>CMR Software Solutions</strong> construimos la plataforma <strong>CMR Match</strong> (CMR Canchas) para publicar disponibilidad, gestionar reservas y ordenar la experiencia del club y del jugador. Es un producto de software nuestro; no es un club deportivo.</p>
      <h2>Funcionalidades</h2>
      <ul>
        <li>Reservas online</li>
        <li>Presentación de deportes y clubs</li>
        <li>Flujos de registro y operación</li>
        <li>Comunicación orientada a conversión y uso real</li>
      </ul>
      <h2>Objetivo</h2>
      <p>Digitalizar la reserva de canchas con una experiencia usable y una base lista para crecer.</p>
      <p><a href="https://cmrcanchas.com/" target="_blank" rel="noopener noreferrer">Ver proyecto</a> · <a href="/servicios/software-a-medida">Software a medida</a></p>
    `,
  },
  {
    slug: "unidad-sanitaria",
    title: "Unidad Sanitaria | Caso CMR Software Solutions",
    description:
      "Sistema para unidad sanitaria desarrollado por CMR Software Solutions: dashboard, reportes, patologías y seguimiento prioritario.",
    h1: "Sistema para unidad sanitaria",
    lead: "Panel de gestión con indicadores, reportes y seguimiento para apoyar la operación institucional.",
    img: "/IMG/proyectos/unidad-sanitaria/sanidad4.png",
    live: "https://unidad-sanitaria-3.vercel.app/",
    body: `
      <p><img src="/IMG/proyectos/unidad-sanitaria/sanidad4.png" alt="Dashboard de unidad sanitaria desarrollado por CMR Software Solutions" width="960" height="540" loading="lazy" decoding="async"></p>
      <h2>Problema</h2>
      <p>Una institución sanitaria necesitaba visualizar indicadores, organizar patologías y dar seguimiento prioritario con mayor claridad.</p>
      <h2>Solución</h2>
      <p>Desarrollamos un sistema con dashboard, reportes trimestrales, módulos de patologías y configuración operativa.</p>
      <h2>Funcionalidades</h2>
      <ul>
        <li>Dashboard con indicadores</li>
        <li>Reportes trimestrales</li>
        <li>Seguimiento de patologías y casos prioritarios</li>
        <li>Configuración del sistema</li>
      </ul>
      <h2>Objetivo</h2>
      <p>Mejorar el control de información y la toma de decisiones del equipo institucional.</p>
      <p><a href="https://unidad-sanitaria-3.vercel.app/" target="_blank" rel="noopener noreferrer">Ver demo</a> · <a href="/servicios/desarrollo-software">Desarrollo de software</a></p>
    `,
  },
  {
    slug: "joby",
    title: "App Joby | Caso CMR Software Solutions",
    description:
      "Joby es una aplicación móvil en la que participó CMR Software Solutions, disponible en Google Play.",
    h1: "Joby — aplicación móvil",
    lead: "Aplicación móvil orientada a experiencia de usuario en dispositivo, con presencia publicada en Google Play.",
    img: "/IMG/proyectos/joby/joby1.png",
    live: "https://play.google.com/store/apps/details?id=com.joby.loby&pcampaignid=web_share",
    body: `
      <p><img src="/IMG/proyectos/joby/joby1.png" alt="Portada de Joby — Conectamos personas" width="480" height="960" loading="lazy" decoding="async"></p>
      <p><img src="/IMG/proyectos/joby/joby9.png" alt="Selección de rol en la app Joby desarrollada con participación de CMR Software Solutions" width="480" height="960" loading="lazy" decoding="async"></p>
      <p><img src="/IMG/proyectos/joby/joby3.png" alt="Inicio de cliente en Joby: búsqueda de servicios" width="480" height="960" loading="lazy" decoding="async"></p>
      <p><img src="/IMG/proyectos/joby/joby4.png" alt="Panel de trabajadores en la app Joby" width="480" height="960" loading="lazy" decoding="async"></p>
      <h2>Problema</h2>
      <p>El producto necesitaba una experiencia móvil clara y publicable en tiendas de aplicaciones.</p>
      <h2>Solución</h2>
      <p>Participamos en el desarrollo de la aplicación Joby, disponible para descarga en Google Play.</p>
      <h2>Funcionalidades</h2>
      <p>La app ofrece una interfaz móvil enfocada en el uso cotidiano del producto (flujos y pantallas orientadas a usuario final).</p>
      <h2>Objetivo</h2>
      <p>Llevar la experiencia a dispositivos móviles con una publicación real en Google Play.</p>
      <p><a href="https://play.google.com/store/apps/details?id=com.joby.loby&pcampaignid=web_share" target="_blank" rel="noopener noreferrer">Ver en Google Play</a> · <a href="/proyectos">Más proyectos</a></p>
    `,
  },
];

for (const p of projects) {
  const canonical = `https://cmrsoftwaresolutions.com/proyectos/${p.slug}`;
  add(`proyectos/${p.slug}.html`, {
    title: p.title,
    description: p.description,
    canonical,
    navActive: "proyectos",
    kicker: "Caso",
    h1: p.h1,
    lead: p.lead,
    breadcrumb: [
      { name: "Inicio", href: "/" },
      { name: "Proyectos", href: "/proyectos" },
      { name: p.h1, href: `/proyectos/${p.slug}` },
    ],
    bodyHtml: p.body,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CreativeWork",
          "@id": `${canonical}#work`,
          name: p.h1,
          description: p.description,
          url: canonical,
          image: `https://cmrsoftwaresolutions.com${p.img}`,
          creator: orgRef(),
          provider: orgRef(),
        },
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: p.title,
          isPartOf: { "@id": "https://cmrsoftwaresolutions.com/#website" },
          about: { "@id": `${canonical}#work` },
          breadcrumb: { "@id": `${canonical}#breadcrumb` },
        },
        breadcrumbLd([
          { name: "Inicio", item: "https://cmrsoftwaresolutions.com/" },
          { name: "Proyectos", item: "https://cmrsoftwaresolutions.com/proyectos" },
          { name: p.h1, item: canonical },
        ]),
      ],
    },
  });
}

add("sobre-nosotros.html", {
  title: "Sobre nosotros | CMR Software Solutions — San Nicolás de los Arroyos",
  description:
    "Quiénes somos: CMR Software Solutions, empresa de desarrollo de software en San Nicolás de los Arroyos, Buenos Aires, Argentina. Qué hacemos y cómo trabajamos.",
  canonical: "https://cmrsoftwaresolutions.com/sobre-nosotros",
  navActive: "sobre",
  kicker: "Institucional",
  h1: "Sobre CMR Software Solutions",
  lead: "Somos una empresa de desarrollo de software en San Nicolás de los Arroyos. Construimos sistemas, aplicaciones y sitios web modernos para negocios reales.",
  breadcrumb: [
    { name: "Inicio", href: "/" },
    { name: "Sobre nosotros", href: "/sobre-nosotros" },
  ],
  bodyHtml: `
      <h2>Quiénes somos</h2>
      <p><strong>CMR Software Solutions</strong> (también referida como CMR Software) nació del trabajo en equipo entre compañeros de facultad que decidieron convertir una idea en un proyecto con propósito. Hoy desarrollamos tecnología confiable para empresas y emprendimientos.</p>
      <h2>Qué hacemos</h2>
      <p>Desarrollamos software a medida, sitios web, aplicaciones, ecommerce, sistemas de gestión, automatización e integraciones. Nuestro foco es generar resultados concretos: menos fricción operativa y mejor presencia digital.</p>
      <h2>Productos propios</h2>
      <p>Además de proyectos a medida, creamos productos digitales como <a href="https://cmrcanchas.com/" target="_blank" rel="noopener noreferrer">CMR Match</a> (también conocido como CMR Canchas) y <a href="https://cmrnexo.com/" target="_blank" rel="noopener noreferrer">CMR Nexo</a>. Esos sitios son productos; <a href="https://cmrsoftwaresolutions.com/">cmrsoftwaresolutions.com</a> es el sitio oficial de la empresa.</p>
      <h2>Dónde estamos</h2>
      <p>Estamos basados en <strong>San Nicolás de los Arroyos</strong>, provincia de Buenos Aires, Argentina. Atendemos la región y proyectos en toda Argentina de forma remota.</p>
      <h2>Cómo trabajamos</h2>
      <ol>
        <li>Descubrimiento del problema y objetivos</li>
        <li>Diseño y arquitectura</li>
        <li>Desarrollo con entregas visibles y QA</li>
        <li>Lanzamiento, capacitación y soporte</li>
      </ol>
      <p>Conocé nuestros <a href="/servicios">servicios</a>, <a href="/proyectos">proyectos</a> o escribinos desde <a href="/contacto">contacto</a>.</p>
    `,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": "https://cmrsoftwaresolutions.com/sobre-nosotros#webpage",
        url: "https://cmrsoftwaresolutions.com/sobre-nosotros",
        name: "Sobre CMR Software Solutions",
        isPartOf: { "@id": "https://cmrsoftwaresolutions.com/#website" },
        about: orgRef(),
        mainEntity: orgRef(),
        breadcrumb: { "@id": "https://cmrsoftwaresolutions.com/sobre-nosotros#breadcrumb" },
      },
      breadcrumbLd([
        { name: "Inicio", item: "https://cmrsoftwaresolutions.com/" },
        { name: "Sobre nosotros", item: "https://cmrsoftwaresolutions.com/sobre-nosotros" },
      ]),
    ],
  },
});

add("contacto.html", {
  title: "Contacto | CMR Software Solutions — San Nicolás de los Arroyos",
  description:
    "Contactá a CMR Software Solutions en San Nicolás de los Arroyos: email, WhatsApp y formulario de asesoramiento. Buenos Aires, Argentina.",
  canonical: "https://cmrsoftwaresolutions.com/contacto",
  navActive: "contacto",
  kicker: "Contacto",
  h1: "Contacto oficial — CMR Software Solutions",
  lead: "Esta es la vía oficial de contacto de CMR Software Solutions, empresa de desarrollo de software en San Nicolás de los Arroyos. Respondemos por email, WhatsApp o formulario de asesoramiento.",
  breadcrumb: [
    { name: "Inicio", href: "/" },
    { name: "Contacto", href: "/contacto" },
  ],
  bodyHtml: `
      <h2>Datos de contacto oficiales</h2>
      <ul>
        <li><strong>Empresa:</strong> CMR Software Solutions</li>
        <li><strong>Sitio oficial:</strong> <a href="https://cmrsoftwaresolutions.com/">https://cmrsoftwaresolutions.com/</a></li>
        <li><strong>Ubicación:</strong> San Nicolás de los Arroyos, Buenos Aires, Argentina</li>
        <li><strong>Email:</strong> <a href="mailto:cmrsoftware.sn@gmail.com">cmrsoftware.sn@gmail.com</a></li>
        <li><strong>WhatsApp:</strong> <a href="${org.wa}" target="_blank" rel="noopener noreferrer">${org.phoneDisplay}</a></li>
        <li><strong>Instagram:</strong> <a href="${org.ig}" target="_blank" rel="noopener noreferrer">@cmrsoftware.sn</a></li>
      </ul>
      <h2>Solicitar asesoramiento</h2>
      <p>Para una reunión sin cargo, completá el <a href="/asesoramiento">formulario de asesoramiento</a>. Contanos qué necesitás y te proponemos el siguiente paso.</p>
      <h2>Cobertura</h2>
      <p>Atendemos proyectos en San Nicolás de los Arroyos y la región, y también de forma remota en toda Argentina.</p>
      <h2>Productos desarrollados por CMR</h2>
      <p>Si llegaste desde <a href="https://cmrcanchas.com/" target="_blank" rel="noopener noreferrer">CMR Match / CMR Canchas</a> o <a href="https://cmrnexo.com/" target="_blank" rel="noopener noreferrer">CMR Nexo</a>, estás viendo productos de software creados por nuestra empresa. Para proyectos a medida o consultas institucionales, usá este contacto oficial.</p>
    `,
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        "@id": "https://cmrsoftwaresolutions.com/contacto#webpage",
        url: "https://cmrsoftwaresolutions.com/contacto",
        name: "Contacto | CMR Software Solutions",
        isPartOf: { "@id": "https://cmrsoftwaresolutions.com/#website" },
        about: orgRef(),
        breadcrumb: { "@id": "https://cmrsoftwaresolutions.com/contacto#breadcrumb" },
      },
      {
        "@type": "Organization",
        "@id": "https://cmrsoftwaresolutions.com/#organization",
        name: "CMR Software Solutions",
        url: "https://cmrsoftwaresolutions.com/",
        email: org.email,
        telephone: org.phoneE164,
        address: {
          "@type": "PostalAddress",
          addressLocality: "San Nicolás de los Arroyos",
          addressRegion: "Buenos Aires",
          addressCountry: "AR",
        },
        contactPoint: {
          "@type": "ContactPoint",
          telephone: org.phoneE164,
          email: org.email,
          contactType: "sales",
          areaServed: "AR",
          availableLanguage: ["Spanish", "es"],
        },
      },
      breadcrumbLd([
        { name: "Inicio", item: "https://cmrsoftwaresolutions.com/" },
        { name: "Contacto", item: "https://cmrsoftwaresolutions.com/contacto" },
      ]),
    ],
  },
});

for (const page of pages) {
  const out = path.join(root, page.fileRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const html = shell({
    title: page.title,
    description: page.description,
    canonical: page.canonical,
    breadcrumb: page.breadcrumb,
    h1: page.h1,
    kicker: page.kicker,
    lead: page.lead,
    bodyHtml: page.bodyHtml,
    jsonLd: page.jsonLd,
    navActive: page.navActive,
  });
  fs.writeFileSync(out, html, "utf8");
  console.log("wrote", page.fileRel);
}

const sitemapUrls = [
  ["https://cmrsoftwaresolutions.com/", "1.0", "weekly"],
  ["https://cmrsoftwaresolutions.com/servicios", "0.9", "monthly"],
  ["https://cmrsoftwaresolutions.com/servicios/desarrollo-software", "0.8", "monthly"],
  ["https://cmrsoftwaresolutions.com/servicios/software-a-medida", "0.8", "monthly"],
  ["https://cmrsoftwaresolutions.com/servicios/desarrollo-web", "0.8", "monthly"],
  ["https://cmrsoftwaresolutions.com/servicios/automatizacion", "0.8", "monthly"],
  ["https://cmrsoftwaresolutions.com/proyectos", "0.9", "monthly"],
  ["https://cmrsoftwaresolutions.com/proyectos/ecommerce-ferreteria", "0.7", "monthly"],
  ["https://cmrsoftwaresolutions.com/proyectos/gestion-canchas", "0.7", "monthly"],
  ["https://cmrsoftwaresolutions.com/proyectos/unidad-sanitaria", "0.7", "monthly"],
  ["https://cmrsoftwaresolutions.com/proyectos/joby", "0.7", "monthly"],
  ["https://cmrsoftwaresolutions.com/sobre-nosotros", "0.8", "monthly"],
  ["https://cmrsoftwaresolutions.com/contacto", "0.8", "monthly"],
  ["https://cmrsoftwaresolutions.com/asesoramiento", "0.9", "monthly"],
  ["https://cmrsoftwaresolutions.com/blog", "0.8", "weekly"],
  ["https://cmrsoftwaresolutions.com/blog/software-a-medida-para-pymes", "0.7", "monthly"],
  ["https://cmrsoftwaresolutions.com/blog/automatizacion-de-procesos-empresariales", "0.7", "monthly"],
  ["https://cmrsoftwaresolutions.com/blog/desarrollo-web-en-san-nicolas", "0.7", "monthly"],
  ["https://cmrsoftwaresolutions.com/privacidad", "0.3", "yearly"],
  ["https://cmrsoftwaresolutions.com/cookies", "0.3", "yearly"],
  ["https://cmrsoftwaresolutions.com/terminos", "0.3", "yearly"],
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    ([loc, priority, changefreq]) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(root, "public/sitemap.xml"), sitemap, "utf8");
console.log("wrote public/sitemap.xml");
