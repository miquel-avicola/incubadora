-- Migració: RPC per a l'estadística setmanal "Jordi".
-- Aplicada el 2026-06-02 via Supabase MCP (ja activa al projecte).
--
-- Tot s'agrupa per la SETMANA ISO de NAIXEMENT dels pollets. Cada setmana té
-- (com a molt) dos fulls de càrrega: un que neix DILLUNS i un que neix DIJOUS.
-- Per a cada full s'agafa la seva data de naixement (MAX dels resultats_naix) i
-- es classifica al dia que toca (ISODOW 1 = dilluns, 4 = dijous).
--
-- Mètriques per setmana, cadascuna desglossada en dilluns / dijous / total:
--   * ous_nostres  -> ous entrats que NO són maquila  (assignacions.es_maquila = false)
--   * ous_maquila  -> ous entrats de maquila          (assignacions.es_maquila = true)
--   * servits      -> pollets realment servits (expedicions.pollets_servits) de comandes de Pollets
--   * sexats       -> pollets servits d'expedicions amb sexe assignat (expedicions.sexe = M/F)
--
-- Nota: un full només apareix quan ja té naixement registrat; per això una setmana
-- pot mostrar només el dilluns fins que el full de dijous neixi.

CREATE OR REPLACE FUNCTION public.estadistiques_setmanal_jordi()
 RETURNS TABLE(
   setmana text,
   isoyear int,
   isoweek int,
   data_dilluns date,
   data_dijous date,
   ous_nostres_dl bigint, ous_nostres_dj bigint, ous_nostres_set bigint,
   ous_maquila_dl bigint, ous_maquila_dj bigint, ous_maquila_set bigint,
   servits_dl bigint, servits_dj bigint, servits_set bigint,
   sexats_dl bigint, sexats_dj bigint, sexats_set bigint
 )
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH full_naix AS (
    -- Data de naixement per full de càrrega
    SELECT fc.id AS full_id, MAX(rn.naixement) AS data_naix
    FROM fulls_carrega fc
    JOIN assignacions a ON a.full_carrega_id = fc.id
    JOIN transferencies t ON t.assignacio_id = a.id
    JOIN resultats_naix rn ON rn.transferencia_id = t.id
    WHERE rn.naixement IS NOT NULL
    GROUP BY fc.id
  ),
  ous AS (
    -- Ous entrats per full, separats nostres / maquila
    SELECT a.full_carrega_id AS full_id,
           SUM(ce.quantitat_ous) FILTER (WHERE NOT COALESCE(a.es_maquila,false))::bigint AS ous_nostres,
           SUM(ce.quantitat_ous) FILTER (WHERE COALESCE(a.es_maquila,false))::bigint AS ous_maquila
    FROM assignacions a
    JOIN carros_estoc ce ON ce.id = a.carro_id
    GROUP BY a.full_carrega_id
  ),
  servits AS (
    -- Pollets servits (real) i sexats per full
    SELECT c.full_carrega_id AS full_id,
           SUM(COALESCE(e.pollets_servits,0))::bigint AS servits,
           SUM(CASE WHEN e.sexe IS NOT NULL THEN COALESCE(e.pollets_servits,0) ELSE 0 END)::bigint AS sexats
    FROM comandes c
    JOIN expedicions e ON e.comanda_id = c.id
    WHERE c.tipus = 'Pollets'
    GROUP BY c.full_carrega_id
  ),
  per_full AS (
    SELECT fn.full_id,
           fn.data_naix,
           EXTRACT(ISOYEAR FROM fn.data_naix)::int AS isoyear,
           EXTRACT(WEEK    FROM fn.data_naix)::int AS isoweek,
           EXTRACT(ISODOW  FROM fn.data_naix)::int AS dow,
           COALESCE(o.ous_nostres,0) AS ous_nostres,
           COALESCE(o.ous_maquila,0) AS ous_maquila,
           COALESCE(s.servits,0)     AS servits,
           COALESCE(s.sexats,0)      AS sexats
    FROM full_naix fn
    LEFT JOIN ous o     ON o.full_id = fn.full_id
    LEFT JOIN servits s ON s.full_id = fn.full_id
  )
  SELECT
    pf.isoyear || '-W' || to_char(pf.isoweek,'FM00') AS setmana,
    pf.isoyear,
    pf.isoweek,
    MAX(pf.data_naix) FILTER (WHERE pf.dow = 1) AS data_dilluns,
    MAX(pf.data_naix) FILTER (WHERE pf.dow = 4) AS data_dijous,
    COALESCE(SUM(pf.ous_nostres) FILTER (WHERE pf.dow = 1),0)::bigint AS ous_nostres_dl,
    COALESCE(SUM(pf.ous_nostres) FILTER (WHERE pf.dow = 4),0)::bigint AS ous_nostres_dj,
    COALESCE(SUM(pf.ous_nostres),0)::bigint                          AS ous_nostres_set,
    COALESCE(SUM(pf.ous_maquila) FILTER (WHERE pf.dow = 1),0)::bigint AS ous_maquila_dl,
    COALESCE(SUM(pf.ous_maquila) FILTER (WHERE pf.dow = 4),0)::bigint AS ous_maquila_dj,
    COALESCE(SUM(pf.ous_maquila),0)::bigint                          AS ous_maquila_set,
    COALESCE(SUM(pf.servits) FILTER (WHERE pf.dow = 1),0)::bigint     AS servits_dl,
    COALESCE(SUM(pf.servits) FILTER (WHERE pf.dow = 4),0)::bigint     AS servits_dj,
    COALESCE(SUM(pf.servits),0)::bigint                              AS servits_set,
    COALESCE(SUM(pf.sexats) FILTER (WHERE pf.dow = 1),0)::bigint      AS sexats_dl,
    COALESCE(SUM(pf.sexats) FILTER (WHERE pf.dow = 4),0)::bigint      AS sexats_dj,
    COALESCE(SUM(pf.sexats),0)::bigint                               AS sexats_set
  FROM per_full pf
  GROUP BY pf.isoyear, pf.isoweek
  ORDER BY pf.isoyear DESC, pf.isoweek DESC;
$function$;
