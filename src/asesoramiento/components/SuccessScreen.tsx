type Props = {
  numeroSolicitud: string | null;
  onReset: () => void;
};

export function SuccessScreen({ numeroSolicitud, onReset }: Props) {
  return (
    <div className="asesoramiento-success" role="status" aria-live="polite">
      <div className="asesoramiento-success-card">
        <div className="asesoramiento-success-icon" aria-hidden="true">
          <i className="fa-solid fa-circle-check" />
        </div>
        <h3>¡Solicitud enviada con éxito!</h3>
        {numeroSolicitud ? (
          <p className="asesoramiento-success-numero">N.º {numeroSolicitud}</p>
        ) : null}
        <p>
          Recibimos correctamente tu solicitud de asesoramiento.
          <br />
          En los próximos días uno de nuestros especialistas se pondrá en contacto con vos.
          <br />
          También enviamos una copia de la solicitud al correo electrónico que nos proporcionaste.
        </p>
        <div className="asesoramiento-success-actions">
          <a href="/" className="btn-primary">
            Volver al inicio
          </a>
          <button type="button" className="btn-form-secondary" onClick={onReset}>
            Enviar otra solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
