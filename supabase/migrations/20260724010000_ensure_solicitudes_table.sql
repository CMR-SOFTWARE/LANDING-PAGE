-- Asegurar tabla + grants (correr en SQL Editor si el insert sigue fallando)

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'solicitud_estado'
  ) then
    create type public.solicitud_estado as enum (
      'Pendiente',
      'En revisión',
      'Contactado',
      'Finalizado'
    );
  end if;
end $$;

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

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on table public.solicitudes_asesoramiento to postgres, service_role;

alter table public.solicitudes_asesoramiento enable row level security;

notify pgrst, 'reload schema';
