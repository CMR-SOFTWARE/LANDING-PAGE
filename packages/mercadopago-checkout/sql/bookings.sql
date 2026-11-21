-- Columnas que necesita una tabla de RESERVAS / TURNOS para cobrar una seña con Mercado Pago.
-- Pegalo en el SQL Editor de Supabase (o adaptalo a tu base). Cambiá "bookings" por el nombre de tu tabla.
-- Es seguro correrlo más de una vez (IF NOT EXISTS).

alter table bookings add column if not exists pay_method       text;          -- 'mercadopago' si se paga con Mercado Pago
alter table bookings add column if not exists mp_amount        numeric;       -- seña que se cobra (la fija el servidor, no el navegador)
alter table bookings add column if not exists mp_preference_id text;
alter table bookings add column if not exists mp_payment_id    text;
alter table bookings add column if not exists mp_status        text;
alter table bookings add column if not exists paid_at          timestamptz;

create unique index if not exists uq_bookings_mp_payment
  on bookings (mp_payment_id) where mp_payment_id is not null;

-- Tu tabla ya debería tener: id, status (pending / confirmed / cancelled, o tus equivalentes) y created_at.
--
-- IMPORTANTE: la reserva se guarda como PENDIENTE y ocupa el horario solo durante la retención
-- (por defecto 10 minutos). Pasado ese tiempo sin pago, la app la trata como cancelada SIN borrarla
-- (ver isHoldExpired en el README). Nunca borres reservas por falta de pago.
