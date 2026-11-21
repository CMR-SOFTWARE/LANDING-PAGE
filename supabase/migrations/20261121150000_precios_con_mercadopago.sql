-- Precio pagando con Mercado Pago: incluye el costo del cobro.
-- Tasa de Checkout "en el momento": 6,60% + IVA = 7,99%. Para recibir 80.000 / 140.000 hay que cobrar
-- 86.943 / 152.151; se redondea hacia arriba para cubrir la retención de Ingresos Brutos.
-- Se aplica JUSTO cuando se mergea el PR que cambia el botón (index.html), así nunca se cobra
-- distinto de lo que se muestra. Solo cambia precios: no borra nada.

update public.servicios set precio = 88000  where slug = 'plan-web';
update public.servicios set precio = 154000 where slug = 'plan-gestion';
