-- Migració: persistir la distribució de carros/caixes per viatge a la base de dades.
-- Aplicada el 2026-06-02 via Supabase MCP (ja activa al projecte).
--
-- Fins ara la distribució triada a la pàgina d'expedicions es guardava només al
-- localStorage del navegador (clau mav_dist_<id>). Ara es desa a fulls_carrega
-- perquè sigui compartida entre dispositius i usuaris.
--
-- El contingut és l'objecte DistribucioSaved: clau = "<transportista_id>_<num_viatge>".

ALTER TABLE public.fulls_carrega
  ADD COLUMN IF NOT EXISTS distribucio_carros jsonb;

COMMENT ON COLUMN public.fulls_carrega.distribucio_carros IS
  'Distribució de carros/caixes per viatge triada a la pàgina d''expedicions. Objecte DistribucioSaved: clau = "<transportista_id>_<num_viatge>".';
