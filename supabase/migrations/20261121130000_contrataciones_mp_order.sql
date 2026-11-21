-- Contrataciones: pasar de la API de Preferences a la API de Orders de Mercado Pago.
-- Solo AGREGA una columna y un índice. No borra ni modifica datos. Se puede correr más de una vez.
--
-- mp_order_id      id de la orden de Mercado Pago (ej. "ORD01J49MMW3SSBK5PSV3DFR32959"). Es lo que
--                  confirma el aviso y lo que se busca en el panel de Mercado Pago.
-- mp_status        ahora guarda "approved", "refunded" o "<status>/<status_detail>" de la orden.
-- mp_preference_id / mp_payment_id quedan sin uso (no se borran).

alter table public.contrataciones add column if not exists mp_order_id text;

-- Una misma orden de Mercado Pago no puede quedar asociada a dos contrataciones.
create unique index if not exists uq_contrataciones_mp_order
  on public.contrataciones (mp_order_id) where mp_order_id is not null;

notify pgrst, 'reload schema';
