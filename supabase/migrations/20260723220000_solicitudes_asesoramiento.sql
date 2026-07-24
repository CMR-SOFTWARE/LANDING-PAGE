-- Solicitudes de asesoramiento (CMR Software Solutions)
-- Ejecutar en Supabase SQL Editor o via `supabase db push`

create extension if not exists "pgcrypto";

create type public.solicitud_estado as enum (
  'Pendiente',
  'En revisión',
  'Contactado',
  'Finalizado'
);

create table if not exists public.solicitudes_asesoramiento (
  id uuid primary key default gen_random_uuid(),
  numero_solicitud text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  nombre text not null,
  empresa text,
  rubro text,
  email text not null,
  telefono text,
  necesidades text[] not null default '{}',
  como_trabajan text,
  problema_principal text not null,
  usuarios text,
  plazo text,
  presupuesto text,
  observaciones text,
  estado public.solicitud_estado not null default 'Pendiente',
  constraint solicitudes_email_formato check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint solicitudes_necesidades_min check (cardinality(necesidades) >= 1)
);

create index if not exists idx_solicitudes_created_at
  on public.solicitudes_asesoramiento (created_at desc);

create index if not exists idx_solicitudes_email
  on public.solicitudes_asesoramiento (lower(email));

create index if not exists idx_solicitudes_estado
  on public.solicitudes_asesoramiento (estado);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_solicitudes_updated_at on public.solicitudes_asesoramiento;
create trigger trg_solicitudes_updated_at
  before update on public.solicitudes_asesoramiento
  for each row execute function public.set_updated_at();

alter table public.solicitudes_asesoramiento enable row level security;

-- Sin políticas de INSERT/SELECT/UPDATE para anon/authenticated:
-- solo la Edge Function con service_role escribe y lee.
revoke all on table public.solicitudes_asesoramiento from anon, authenticated;
grant all on table public.solicitudes_asesoramiento to service_role;
