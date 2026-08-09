export const NECESIDAD_OPTIONS = [
  "Sistema o desarrollo a medida",
  "Automatizar procesos o tareas repetitivas",
  "Integrar herramientas o sistemas existentes",
  "Mejorar o reemplazar un sistema actual",
  "Todavía no lo tengo claro / quiero orientación",
] as const;

export const USUARIOS_OPTIONS = [
  "1 persona",
  "2 a 5",
  "6 a 20",
  "Más de 20",
  "Aún no lo sé",
] as const;

export const PLAZO_OPTIONS = [
  "Lo antes posible",
  "En 1 a 3 meses",
  "En 3 a 6 meses",
  "Sin fecha fija / explorando",
] as const;

export const PRESUPUESTO_OPTIONS = [
  "Menor escala / proyecto acotado",
  "Escala media",
  "Proyecto amplio o varias etapas",
  "No aplica / solo consulta",
] as const;

export type AsesoramientoFormValues = {
  nombre: string;
  empresa: string;
  rubro: string;
  email: string;
  telefono: string;
  necesidades: string[];
  como_trabajan: string;
  problema_principal: string;
  usuarios: string;
  plazo: string;
  presupuesto: string;
  observaciones: string;
  /** Consentimiento de privacidad requerido */
  privacidad: boolean;
  /** Honeypot anti-bot — debe quedar vacío */
  website: string;
};

export type FieldErrors = Partial<Record<keyof AsesoramientoFormValues, string>>;

export type SubmitSuccess = {
  ok: true;
  id: string;
  numero_solicitud: string;
  message: string;
};

export type SubmitFailure = {
  ok: false;
  message: string;
  errors?: FieldErrors;
  detail?: string;
  code?: string | null;
};

export const emptyFormValues = (): AsesoramientoFormValues => ({
  nombre: "",
  empresa: "",
  rubro: "",
  email: "",
  telefono: "",
  necesidades: [],
  como_trabajan: "",
  problema_principal: "",
  usuarios: "",
  plazo: "",
  presupuesto: "",
  observaciones: "",
  privacidad: false,
  website: "",
});
