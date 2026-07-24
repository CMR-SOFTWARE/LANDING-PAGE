-- Reparar acceso API a solicitudes_asesoramiento (correr en SQL Editor)

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on table public.solicitudes_asesoramiento to postgres, service_role;
grant select, insert on table public.solicitudes_asesoramiento to service_role;

-- Recargar caché de la API
notify pgrst, 'reload schema';
