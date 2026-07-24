-- Hardening producción (opcional pero recomendado)
-- Ejecutar en SQL Editor si aún no corriste los fixes previos.

alter table public.solicitudes_asesoramiento
  drop constraint if exists solicitudes_email_formato;

alter table public.solicitudes_asesoramiento
  add constraint solicitudes_email_formato
  check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- Índice por email (ya puede existir)
create index if not exists idx_solicitudes_email
  on public.solicitudes_asesoramiento (lower(email));

notify pgrst, 'reload schema';
