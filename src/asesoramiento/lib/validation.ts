import type { AsesoramientoFormValues, FieldErrors } from "./types";

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export function validateAsesoramientoForm(values: AsesoramientoFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.nombre.trim() || values.nombre.trim().length < 2) {
    errors.nombre = "Ingresá tu nombre y apellido.";
  }

  if (!values.email.trim()) {
    errors.email = "Ingresá tu correo electrónico.";
  } else if (!isValidEmail(values.email)) {
    errors.email = "El correo no tiene un formato válido.";
  }

  if (values.telefono.trim() && !isValidPhone(values.telefono)) {
    errors.telefono = "Ingresá un teléfono válido (mín. 8 dígitos).";
  }

  if (values.necesidades.length < 1) {
    errors.necesidades = "Marcá al menos una opción.";
  }

  if (!values.problema_principal.trim() || values.problema_principal.trim().length < 10) {
    errors.problema_principal = "Contanos el problema u objetivo con un poco más de detalle.";
  }

  return errors;
}
