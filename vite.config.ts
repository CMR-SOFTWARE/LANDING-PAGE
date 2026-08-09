import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

/** Mirrors vercel.json rewrites so /servicios, /proyectos, etc. work in `vite dev`. */
function cleanHtmlRoutes(): Plugin {
  const rewrites: Record<string, string> = {
    "/asesoramiento": "/asesoramiento.html",
    "/privacidad": "/privacidad.html",
    "/cookies": "/cookies.html",
    "/terminos": "/terminos.html",
    "/sobre-nosotros": "/sobre-nosotros.html",
    "/contacto": "/contacto.html",
    "/servicios": "/servicios/index.html",
    "/servicios/desarrollo-software": "/servicios/desarrollo-software.html",
    "/servicios/software-a-medida": "/servicios/software-a-medida.html",
    "/servicios/desarrollo-web": "/servicios/desarrollo-web.html",
    "/servicios/automatizacion": "/servicios/automatizacion.html",
    "/proyectos": "/proyectos/index.html",
    "/proyectos/ecommerce-ferreteria": "/proyectos/ecommerce-ferreteria.html",
    "/proyectos/gestion-canchas": "/proyectos/gestion-canchas.html",
    "/proyectos/unidad-sanitaria": "/proyectos/unidad-sanitaria.html",
    "/proyectos/joby": "/proyectos/joby.html",
    "/blog": "/blog/index.html",
    "/blog/software-a-medida-para-pymes": "/blog/software-a-medida-para-pymes.html",
    "/blog/automatizacion-de-procesos-empresariales":
      "/blog/automatizacion-de-procesos-empresariales.html",
    "/blog/desarrollo-web-en-san-nicolas": "/blog/desarrollo-web-en-san-nicolas.html",
  };

  return {
    name: "cmr-clean-html-routes",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const url = req.url.split("?")[0] || "";
        const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        const clean = url.replace(/\/$/, "") || "/";
        const dest = rewrites[clean];
        if (!dest) return next();
        const abs = path.join(root, dest.replace(/^\//, ""));
        if (!fs.existsSync(abs)) return next();
        req.url = dest + qs;
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const url = req.url.split("?")[0] || "";
        const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        const clean = url.replace(/\/$/, "") || "/";
        const dest = rewrites[clean];
        if (!dest) return next();
        req.url = dest + qs;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), cleanHtmlRoutes()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        asesoramiento: fileURLToPath(new URL("./asesoramiento.html", import.meta.url)),
        privacidad: fileURLToPath(new URL("./privacidad.html", import.meta.url)),
        cookies: fileURLToPath(new URL("./cookies.html", import.meta.url)),
        terminos: fileURLToPath(new URL("./terminos.html", import.meta.url)),
        sobreNosotros: fileURLToPath(new URL("./sobre-nosotros.html", import.meta.url)),
        contacto: fileURLToPath(new URL("./contacto.html", import.meta.url)),
        servicios: fileURLToPath(new URL("./servicios/index.html", import.meta.url)),
        serviciosDesarrolloSoftware: fileURLToPath(
          new URL("./servicios/desarrollo-software.html", import.meta.url),
        ),
        serviciosSoftwareAMedida: fileURLToPath(
          new URL("./servicios/software-a-medida.html", import.meta.url),
        ),
        serviciosDesarrolloWeb: fileURLToPath(
          new URL("./servicios/desarrollo-web.html", import.meta.url),
        ),
        serviciosAutomatizacion: fileURLToPath(
          new URL("./servicios/automatizacion.html", import.meta.url),
        ),
        proyectos: fileURLToPath(new URL("./proyectos/index.html", import.meta.url)),
        proyectoEcommerce: fileURLToPath(
          new URL("./proyectos/ecommerce-ferreteria.html", import.meta.url),
        ),
        proyectoCanchas: fileURLToPath(
          new URL("./proyectos/gestion-canchas.html", import.meta.url),
        ),
        proyectoUnidadSanitaria: fileURLToPath(
          new URL("./proyectos/unidad-sanitaria.html", import.meta.url),
        ),
        proyectoJoby: fileURLToPath(new URL("./proyectos/joby.html", import.meta.url)),
        blog: fileURLToPath(new URL("./blog/index.html", import.meta.url)),
        blogSoftwareAMedida: fileURLToPath(
          new URL("./blog/software-a-medida-para-pymes.html", import.meta.url),
        ),
        blogAutomatizacion: fileURLToPath(
          new URL("./blog/automatizacion-de-procesos-empresariales.html", import.meta.url),
        ),
        blogDesarrolloWeb: fileURLToPath(
          new URL("./blog/desarrollo-web-en-san-nicolas.html", import.meta.url),
        ),
      },
    },
  },
  server: {
    port: 5500,
    strictPort: false,
  },
  root,
});
