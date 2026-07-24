import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/asesoramiento-extras.css";

const rootEl = document.getElementById("asesoramiento-root");
if (!rootEl) {
  throw new Error("No se encontró #asesoramiento-root");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
