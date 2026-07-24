-- Fix constraint de email: en PostgreSQL \s NO es "espacio", rompe emails con letra "s"
-- Ejecutar en SQL Editor → Run

alter table public.solicitudes_asesoramiento
  drop constraint if exists solicitudes_email_formato;

alter table public.solicitudes_asesoramiento
  add constraint solicitudes_email_formato
  check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
