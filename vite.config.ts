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
