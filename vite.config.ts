import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
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
