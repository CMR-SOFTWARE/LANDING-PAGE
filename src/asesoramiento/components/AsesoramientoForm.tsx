import {
  NECESIDAD_OPTIONS,
  PLAZO_OPTIONS,
  PRESUPUESTO_OPTIONS,
  USUARIOS_OPTIONS,
} from "../types";
import { FormField } from "./FormField";
import type { useAsesoramientoForm } from "../hooks/useAsesoramientoForm";

type FormApi = ReturnType<typeof useAsesoramientoForm>;

export function AsesoramientoForm({ form }: { form: FormApi }) {
  const { values, errors, status, globalError, setField, toggleNecesidad, submit } = form;
  const submitting = status === "submitting";

  return (
    <form
      className="asesoramiento-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!submitting) void submit();
      }}
    >
      <div className="form-grid">
        <FormField
          id="fa-nombre"
          full
          label={
            <>
              Nombre y apellido <span className="req">*</span>
            </>
          }
          error={errors.nombre}
        >
          <input
            id="fa-nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            placeholder="Cómo te llamamos"
            value={values.nombre}
            disabled={submitting}
            aria-invalid={Boolean(errors.nombre)}
            aria-describedby={errors.nombre ? "fa-nombre-error" : undefined}
            onChange={(e) => setField("nombre", e.target.value)}
          />
        </FormField>

        <FormField id="fa-empresa" label="Empresa u organización" error={errors.empresa}>
          <input
            id="fa-empresa"
            name="empresa"
            type="text"
            autoComplete="organization"
            placeholder="Nombre comercial o razón social"
            value={values.empresa}
            disabled={submitting}
            onChange={(e) => setField("empresa", e.target.value)}
          />
        </FormField>

        <FormField id="fa-rubro" label="Rubro o actividad" error={errors.rubro}>
          <input
            id="fa-rubro"
            name="rubro"
            type="text"
            placeholder="Ej.: retail, salud, logística…"
            value={values.rubro}
            disabled={submitting}
            onChange={(e) => setField("rubro", e.target.value)}
          />
        </FormField>

        <FormField
          id="fa-email"
          label={
            <>
              Correo electrónico <span className="req">*</span>
            </>
          }
          error={errors.email}
        >
          <input
            id="fa-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@empresa.com"
            value={values.email}
            disabled={submitting}
            aria-invalid={Boolean(errors.email)}
            onChange={(e) => setField("email", e.target.value)}
          />
        </FormField>

        <FormField id="fa-telefono" label="Teléfono o WhatsApp" error={errors.telefono}>
          <input
            id="fa-telefono"
            name="telefono"
            type="tel"
            autoComplete="tel"
            placeholder="Código de área + número"
            value={values.telefono}
            disabled={submitting}
            aria-invalid={Boolean(errors.telefono)}
            onChange={(e) => setField("telefono", e.target.value)}
          />
        </FormField>

        <fieldset className={`form-field form-field--full form-fieldset${errors.necesidades ? " is-invalid" : ""}`}>
          <legend>
            ¿Qué tipo de necesidad tenés? <span className="req">*</span>{" "}
            <span className="legend-hint">(podés marcar varias)</span>
          </legend>
          <div className="form-check-grid">
            {NECESIDAD_OPTIONS.map((option) => (
              <label key={option} className="form-check">
                <input
                  type="checkbox"
                  name="necesidad"
                  value={option}
                  checked={values.necesidades.includes(option)}
                  disabled={submitting}
                  onChange={() => toggleNecesidad(option)}
                />
                {option}
              </label>
            ))}
          </div>
          {errors.necesidades ? (
            <p className="form-field-error" role="alert">
              {errors.necesidades}
            </p>
          ) : null}
        </fieldset>

        <FormField id="fa-hoy" full label="¿Cómo trabajan hoy?" error={errors.como_trabajan}>
          <textarea
            id="fa-hoy"
            name="como_trabajan"
            rows={3}
            placeholder="Ej.: planillas Excel, otro software, papel, varias personas…"
            value={values.como_trabajan}
            disabled={submitting}
            onChange={(e) => setField("como_trabajan", e.target.value)}
          />
        </FormField>

        <FormField
          id="fa-problema"
          full
          label={
            <>
              Principal problema u objetivo <span className="req">*</span>
            </>
          }
          error={errors.problema_principal}
        >
          <textarea
            id="fa-problema"
            name="problema_principal"
            rows={4}
            required
            placeholder="Qué querés resolver o lograr con este proyecto"
            value={values.problema_principal}
            disabled={submitting}
            aria-invalid={Boolean(errors.problema_principal)}
            onChange={(e) => setField("problema_principal", e.target.value)}
          />
        </FormField>

        <FormField id="fa-usuarios" label="¿Cuántas personas lo usarían (aprox.)?" error={errors.usuarios}>
          <select
            id="fa-usuarios"
            name="usuarios"
            value={values.usuarios}
            disabled={submitting}
            onChange={(e) => setField("usuarios", e.target.value)}
          >
            <option value="">Elegí una opción</option>
            {USUARIOS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="fa-plazo" label="Plazo o urgencia" error={errors.plazo}>
          <select
            id="fa-plazo"
            name="plazo"
            value={values.plazo}
            disabled={submitting}
            onChange={(e) => setField("plazo", e.target.value)}
          >
            <option value="">Elegí una opción</option>
            {PLAZO_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="fa-presupuesto" full label="Inversión orientativa (opcional)" error={errors.presupuesto}>
          <select
            id="fa-presupuesto"
            name="presupuesto"
            value={values.presupuesto}
            disabled={submitting}
            onChange={(e) => setField("presupuesto", e.target.value)}
          >
            <option value="">Prefiero charlarlo en la reunión</option>
            {PRESUPUESTO_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="fa-extra"
          full
          label="Algo más que debamos saber antes de la entrevista"
          error={errors.observaciones}
        >
          <textarea
            id="fa-extra"
            name="extra"
            rows={3}
            placeholder="Integraciones, normativas, fechas clave, referencias…"
            value={values.observaciones}
            disabled={submitting}
            onChange={(e) => setField("observaciones", e.target.value)}
          />
        </FormField>
      </div>

      <p className="form-privacy">
        Al enviar, guardamos tu solicitud de forma segura, generamos un comprobante en PDF y te
        enviamos una copia por correo. También podés escribirnos a{" "}
        <strong>cmrsoftware.sn@gmail.com</strong> o por WhatsApp.
      </p>

      {globalError ? (
        <p className="form-error" role="alert">
          {globalError}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Enviando solicitud…
            </>
          ) : (
            "Enviar solicitud"
          )}
        </button>
        <a href="/" className="btn-form-secondary">
          Volver al inicio
        </a>
      </div>
    </form>
  );
}
