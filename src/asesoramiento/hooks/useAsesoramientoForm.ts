import { useCallback, useState } from "react";
import { emptyFormValues, type AsesoramientoFormValues, type FieldErrors } from "../types";
import { validateAsesoramientoForm } from "../lib/validation";
import { submitAsesoramiento } from "../services/asesoramientoApi";

export type FormStatus = "idle" | "submitting" | "success" | "error";

export function useAsesoramientoForm() {
  const [values, setValues] = useState<AsesoramientoFormValues>(emptyFormValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<FormStatus>("idle");
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [numeroSolicitud, setNumeroSolicitud] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof AsesoramientoFormValues>(key: K, value: AsesoramientoFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const toggleNecesidad = useCallback((option: string) => {
    setValues((prev) => {
      const has = prev.necesidades.includes(option);
      return {
        ...prev,
        necesidades: has
          ? prev.necesidades.filter((n) => n !== option)
          : [...prev.necesidades, option],
      };
    });
    setErrors((prev) => {
      if (!prev.necesidades) return prev;
      const next = { ...prev };
      delete next.necesidades;
      return next;
    });
  }, []);

  const resetForm = useCallback(() => {
    setValues(emptyFormValues());
    setErrors({});
    setStatus("idle");
    setGlobalError(null);
    setNumeroSolicitud(null);
  }, []);

  const submit = useCallback(async () => {
    setGlobalError(null);
    const nextErrors = validateAsesoramientoForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      const firstKey = Object.keys(nextErrors)[0];
      const el = document.getElementById(
        firstKey === "necesidades"
          ? "fa-necesidades"
          : firstKey === "problema_principal"
            ? "fa-problema"
            : firstKey === "como_trabajan"
              ? "fa-hoy"
              : firstKey === "observaciones"
                ? "fa-extra"
                : firstKey === "privacidad"
                  ? "fa-privacidad"
                  : `fa-${firstKey}`,
      );
      el?.focus?.();
      el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }

    setStatus("submitting");
    try {
      const result = await submitAsesoramiento(values);
      setNumeroSolicitud(result.numero_solicitud);
      setStatus("success");
    } catch (err) {
      console.error("[asesoramiento] submit failed", err);
      const fieldErrors =
        err && typeof err === "object" && "fieldErrors" in err
          ? (err as { fieldErrors?: FieldErrors }).fieldErrors
          : undefined;
      if (fieldErrors) setErrors(fieldErrors);
      setGlobalError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al enviar. Intentá de nuevo.",
      );
      setStatus("error");
    }
  }, [values]);

  return {
    values,
    errors,
    status,
    globalError,
    numeroSolicitud,
    setField,
    toggleNecesidad,
    submit,
    resetForm,
  };
}
