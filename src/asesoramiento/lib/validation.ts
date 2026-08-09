import type { AsesoramientoFormValues, FieldErrors } from "../types";

const MAX = {
  nombre: 120,
  empresa: 160,
  rubro: 120,
  email: 160,
  telefono: 40,
  como_trabajan: 2000,
  problema_principal: 4000,
  observaciones: 2000,
} as const;

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

  // Honeypot anti-bot (campo oculto)
  if (values.website?.trim()) {
    errors.nombre = "No pudimos validar el envío.";
    return errors;
  }

  if (!values.nombre.trim() || values.nombre.trim().length < 2) {
    errors.nombre = "Ingresá tu nombre y apellido.";
  } else if (values.nombre.trim().length > MAX.nombre) {
    errors.nombre = "El nombre es demasiado largo.";
  }

  if (!values.email.trim()) {
    errors.email = "Ingresá tu correo electrónico.";
  } else if (!isValidEmail(values.email)) {
    errors.email = "El correo no tiene un formato válido.";
  } else if (values.email.trim().length > MAX.email) {
    errors.email = "El correo es demasiado largo.";
  }

  if (values.telefono.trim() && !isValidPhone(values.telefono)) {
    errors.telefono = "Ingresá un teléfono válido (mín. 8 dígitos).";
  }

  if (values.necesidades.length < 1) {
    errors.necesidades = "Marcá al menos una opción.";
  }

  if (!values.problema_principal.trim() || values.problema_principal.trim().length < 10) {
    errors.problema_principal = "Contanos el problema u objetivo con un poco más de detalle.";
  } else if (values.problema_principal.trim().length > MAX.problema_principal) {
    errors.problema_principal = "El texto es demasiado largo.";
  }

  if (values.empresa.trim().length > MAX.empresa) errors.empresa = "Texto demasiado largo.";
  if (values.rubro.trim().length > MAX.rubro) errors.rubro = "Texto demasiado largo.";
  if (values.como_trabajan.trim().length > MAX.como_trabajan) {
    errors.como_trabajan = "Texto demasiado largo.";
  }
  if (values.observaciones.trim().length > MAX.observaciones) {
    errors.observaciones = "Texto demasiado largo.";
  }

  if (!values.privacidad) {
    errors.privacidad = "Debés aceptar la Política de Privacidad para continuar.";
  }

  return errors;
}
