import { AsesoramientoForm } from "./components/AsesoramientoForm";
import { SuccessScreen } from "./components/SuccessScreen";
import { useAsesoramientoForm } from "./hooks/useAsesoramientoForm";

export function App() {
  const form = useAsesoramientoForm();

  return (
    <section id="asesoramiento" className="asesoramiento asesoramiento--page" aria-labelledby="asesoramiento-heading">
      <div className="asesoramiento-envoltura">
        {form.status === "success" ? (
          <SuccessScreen numeroSolicitud={form.numeroSolicitud} onReset={form.resetForm} />
        ) : (
          <>
            <header className="asesoramiento-head">
              <p className="tag-asesoramiento">Antes de la reunión</p>
              <h1 id="asesoramiento-heading">Solicitá asesoramiento</h1>
              <p className="asesoramiento-lead">
                Completá lo que puedas: nos ayuda a entender tu contexto y llegar a la entrevista con
                ideas y preguntas más concretas. No hace falta que seas técnico.
              </p>
            </header>
            <AsesoramientoForm form={form} />
          </>
        )}
      </div>
    </section>
  );
}
