-- Columna para marcar cuándo se avisó al equipo de una contratación confirmada.
-- YA APLICADA en el proyecto wnzugiqyezrkywwfrbdw (2026-11-21). Hoy NINGÚN código la usa:
-- el aviso por mail con Resend se descartó; el aviso se va a hacer conectando la landing al
-- sistema de gestión de CMR. Queda acá para que el repo refleje la base real.
-- Solo agrega una columna: no cambia ni borra datos.

alter table public.contrataciones
  add column if not exists aviso_mail_at timestamptz;

comment on column public.contrataciones.aviso_mail_at is
  'Cuándo se avisó al equipo por esta contratación confirmada (null = todavía no). Sin uso por ahora.';
