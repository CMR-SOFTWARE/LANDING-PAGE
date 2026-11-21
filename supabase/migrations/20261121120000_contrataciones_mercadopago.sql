-- Contratación de servicios con Mercado Pago (pago único de UN mes del plan).
-- Adaptado de packages/mercadopago-checkout/sql/orders.sql.
-- Proyecto: CMR Landing Page + CMR Nexo (schema public; NO toca cmr_nexo).
-- Pegalo en Supabase -> SQL Editor -> Run. Es seguro correrlo más de una vez.

-- 1) Catálogo: el precio que se cobra SIEMPRE sale de acá, nunca del navegador.
create table if not exists public.servicios (
  id         bigint generated always as identity primary key,
  slug       text not null unique,                 -- lo que manda el botón: "plan-web", "plan-gestion"
  nombre     text not null,
  precio     numeric(12,2) not null check (precio > 0), -- AR$ por un mes
  activo     boolean not null default true,         -- false = no se puede contratar (no se borra)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.servicios (slug, nombre, precio) values
  ('plan-web',     'Plan Web',      80000),
  ('plan-gestion', 'Plan Gestión', 140000)
on conflict (slug) do nothing;  -- no pisa precios que ya hayas cambiado

-- 2) Cada intento de contratación. Nace "pendiente"; solo el webhook la pasa a "confirmada".
create table if not exists public.contrataciones (
  id               bigint generated always as identity primary key, -- la referencia es "servicio:<id>"
  servicio_id      bigint not null references public.servicios (id),
  servicio_nombre  text not null,             -- copia al momento de contratar
  monto            numeric(12,2) not null check (monto > 0), -- copia del precio al momento de contratar
  nombre           text not null,
  email            text not null,
  telefono         text,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente', 'confirmada', 'cancelada')),
  mp_preference_id text,         -- id del enlace de pago que creamos
  mp_payment_id    text,         -- id del pago (lo trae el aviso)
  mp_status        text,         -- último estado informado: approved, rejected, refunded...
  paid_at          timestamptz,  -- cuándo se aprobó
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Un mismo pago de Mercado Pago no puede quedar asociado a dos contrataciones.
create unique index if not exists uq_contrataciones_mp_payment
  on public.contrataciones (mp_payment_id) where mp_payment_id is not null;
create index if not exists idx_contrataciones_estado  on public.contrataciones (estado);
create index if not exists idx_contrataciones_created on public.contrataciones (created_at desc);

-- updated_at automático (la función ya existe por la migración de asesoramiento; se recrea igual).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_servicios_updated_at on public.servicios;
create trigger trg_servicios_updated_at before update on public.servicios
  for each row execute function public.set_updated_at();

drop trigger if exists trg_contrataciones_updated_at on public.contrataciones;
create trigger trg_contrataciones_updated_at before update on public.contrataciones
  for each row execute function public.set_updated_at();

-- 3) Seguridad: solo el servidor (service_role, desde /api en Vercel) lee y escribe.
--    Nadie puede BORRAR: cancelar es cambiar el estado.
alter table public.servicios      enable row level security;
alter table public.contrataciones enable row level security;

revoke all on table public.servicios      from anon, authenticated;
revoke all on table public.contrataciones from anon, authenticated;

grant select, insert, update on table public.servicios      to service_role;
grant select, insert, update on table public.contrataciones to service_role;
revoke delete, truncate on table public.servicios      from service_role;
revoke delete, truncate on table public.contrataciones from service_role;

notify pgrst, 'reload schema';
