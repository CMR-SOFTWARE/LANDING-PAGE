-- Columnas que necesita una tabla de PEDIDOS para cobrar con Mercado Pago.
-- Pegalo en el SQL Editor de Supabase (o adaptalo a tu base). Cambiá "orders" por el nombre de tu tabla.
-- Es seguro correrlo más de una vez (IF NOT EXISTS).

alter table orders add column if not exists mp_preference_id text;     -- id del enlace de pago que creamos
alter table orders add column if not exists mp_payment_id    text;     -- id del pago aprobado (lo trae el aviso)
alter table orders add column if not exists mp_status        text;     -- último estado informado: approved, rejected, refunded...
alter table orders add column if not exists paid_at          timestamptz; -- cuándo se aprobó

-- Un mismo pago de Mercado Pago no puede quedar asociado a dos pedidos.
create unique index if not exists uq_orders_mp_payment
  on orders (mp_payment_id) where mp_payment_id is not null;

-- Tu tabla ya debería tener: id, total (monto en pesos) y status (pending / confirmed / cancelled, o tus equivalentes).
