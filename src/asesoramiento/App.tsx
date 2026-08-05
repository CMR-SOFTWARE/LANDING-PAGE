import { useEffect } from "react";
import { AsesoramientoForm } from "./components/AsesoramientoForm";
import { SuccessScreen } from "./components/SuccessScreen";
import { useAsesoramientoForm } from "./hooks/useAsesoramientoForm";

export function App() {
  const form = useAsesoramientoForm();

  useEffect(() => {
    const head = document.querySelector<HTMLElement>("[data-asesoramiento-static-head]");
    if (!head) return;
    if (form.status === "success") {
      head.setAttribute("hidden", "");
    } else {
      head.removeAttribute("hidden");
    }
  }, [form.status]);

  if (form.status === "success") {
    return <SuccessScreen numeroSolicitud={form.numeroSolicitud} onReset={form.resetForm} />;
  }

  return <AsesoramientoForm form={form} />;
}
