-- Fix: insertar solicitudes sin depender de SERVICE_ROLE_KEY
-- Ejecutar TODO este archivo en Supabase → SQL Editor → Run

grant usage on schema public to anon, authenticated, service_role;

create or replace function public.crear_solicitud_asesoramiento(
  p_numero_solicitud text,
  p_nombre text,
  p_empresa text,
  p_rubro text,
  p_email text,
  p_telefono text,
  p_necesidades text[],
  p_como_trabajan text,
  p_problema_principal text,
  p_usuarios text,
  p_plazo text,
  p_presupuesto text,
  p_observaciones text
)
returns table (id uuid, numero_solicitud text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_nombre is null or length(trim(p_nombre)) < 2 then
    raise exception 'nombre inválido';
  end if;
  if p_email is null or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'email inválido';
  end if;
  if p_problema_principal is null or length(trim(p_problema_principal)) < 10 then
    raise exception 'problema_principal inválido';
  end if;
  if p_necesidades is null or cardinality(p_necesidades) < 1 then
    raise exception 'necesidades inválidas';
  end if;

  return query
  insert into public.solicitudes_asesoramiento (
    numero_solicitud,
    nombre,
    empresa,
    rubro,
    email,
    telefono,
    necesidades,
    como_trabajan,
    problema_principal,
    usuarios,
    plazo,
    presupuesto,
    observaciones,
    estado
  ) values (
    p_numero_solicitud,
    trim(p_nombre),
    nullif(trim(coalesce(p_empresa, '')), ''),
    nullif(trim(coalesce(p_rubro, '')), ''),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_telefono, '')), ''),
    p_necesidades,
    nullif(trim(coalesce(p_como_trabajan, '')), ''),
    trim(p_problema_principal),
    nullif(trim(coalesce(p_usuarios, '')), ''),
    nullif(trim(coalesce(p_plazo, '')), ''),
    nullif(trim(coalesce(p_presupuesto, '')), ''),
    nullif(trim(coalesce(p_observaciones, '')), ''),
    'Pendiente'::public.solicitud_estado
  )
  returning
    solicitudes_asesoramiento.id,
    solicitudes_asesoramiento.numero_solicitud,
    solicitudes_asesoramiento.created_at;
end;
$$;

revoke all on function public.crear_solicitud_asesoramiento(
  text, text, text, text, text, text, text[], text, text, text, text, text, text
) from public;

grant execute on function public.crear_solicitud_asesoramiento(
  text, text, text, text, text, text, text[], text, text, text, text, text, text
) to anon, authenticated, service_role;

grant all on table public.solicitudes_asesoramiento to service_role;

notify pgrst, 'reload schema';
