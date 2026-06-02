-- Migració: detall de l'estadística setmanal "Jordi".
-- Aplicada el 2026-06-02 via Supabase MCP (ja activa al projecte).
--
-- Dues funcions de detall, amb la mateixa lògica que estadistiques_setmanal_jordi()
-- (agrupació per setmana ISO de naixement, dilluns = ISODOW 1, dijous = ISODOW 4):
--
--   estadistiques_setmanal_jordi_lots()
--     Ous entrats desglossats per LOT de reproductores (dilluns/dijous/total).
--     Marca es_maquila (els ous de maquila tenen assignacions.es_maquila = true).
--
--   estadistiques_setmanal_jordi_clients()
--     Pollets servits (real, expedicions.pollets_servits) desglossats per CLIENT
--     (dilluns/dijous/total). Només comandes tipus 'Pollets', igual que el total
--     de "pollets servits" de la vista principal.

CREATE OR REPLACE FUNCTION public.estadistiques_setmanal_jordi_lots()
 RETURNS TABLE(
   setmana text,
   isoyear int,
   isoweek int,
   lot_id bigint,
   lot_nom text,
   es_maquila boolean,
   ous_dl bigint, ous_dj bigint, ous_set bigint
 )
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH full_naix AS (
    SELECT fc.id AS full_id, MAX(rn.naixement) AS data_naix
    FROM fulls_carrega fc
    JOIN assignacions a ON a.full_carrega_id = fc.id
    JOIN transferencies t ON t.assignacio_id = a.id
    JOIN resultats_naix rn ON rn.transferencia_id = t.id
    WHERE rn.naixement IS NOT NULL
    GROUP BY fc.id
  ),
  ous AS (
    SELECT a.full_carrega_id AS full_id, ce.lot_id,
           bool_or(COALESCE(a.es_maquila,false)) AS es_maquila,
           SUM(ce.quantitat_ous)::bigint AS ous
    FROM assignacions a
    JOIN carros_estoc ce ON ce.id = a.carro_id
    GROUP BY a.full_carrega_id, ce.lot_id
  ),
  per_full AS (
    SELECT EXTRACT(ISOYEAR FROM fn.data_naix)::int AS isoyear,
           EXTRACT(WEEK    FROM fn.data_naix)::int AS isoweek,
           EXTRACT(ISODOW  FROM fn.data_naix)::int AS dow,
           o.lot_id, o.es_maquila, o.ous
    FROM full_naix fn
    JOIN ous o ON o.full_id = fn.full_id
  )
  SELECT
    pf.isoyear || '-W' || to_char(pf.isoweek,'FM00') AS setmana,
    pf.isoyear,
    pf.isoweek,
    pf.lot_id,
    COALESCE(g.nom_informal, g.granja) || COALESCE(' ' || l.estirp, '') AS lot_nom,
    pf.es_maquila,
    COALESCE(SUM(pf.ous) FILTER (WHERE pf.dow = 1),0)::bigint AS ous_dl,
    COALESCE(SUM(pf.ous) FILTER (WHERE pf.dow = 4),0)::bigint AS ous_dj,
    COALESCE(SUM(pf.ous),0)::bigint                          AS ous_set
  FROM per_full pf
  LEFT JOIN lots_reproductores l   ON l.id = pf.lot_id
  LEFT JOIN granges_reproductores g ON g.id = l.granja_reproductora_id
  GROUP BY pf.isoyear, pf.isoweek, pf.lot_id, lot_nom, pf.es_maquila
  ORDER BY pf.isoyear DESC, pf.isoweek DESC, pf.es_maquila, ous_set DESC;
$function$;


CREATE OR REPLACE FUNCTION public.estadistiques_setmanal_jordi_clients()
 RETURNS TABLE(
   setmana text,
   isoyear int,
   isoweek int,
   client_id bigint,
   client_nom text,
   servits_dl bigint, servits_dj bigint, servits_set bigint
 )
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH full_naix AS (
    SELECT fc.id AS full_id, MAX(rn.naixement) AS data_naix
    FROM fulls_carrega fc
    JOIN assignacions a ON a.full_carrega_id = fc.id
    JOIN transferencies t ON t.assignacio_id = a.id
    JOIN resultats_naix rn ON rn.transferencia_id = t.id
    WHERE rn.naixement IS NOT NULL
    GROUP BY fc.id
  ),
  serv AS (
    SELECT c.full_carrega_id AS full_id, c.client_id,
           SUM(COALESCE(e.pollets_servits,0))::bigint AS servits
    FROM comandes c
    JOIN expedicions e ON e.comanda_id = c.id
    WHERE c.tipus = 'Pollets'
    GROUP BY c.full_carrega_id, c.client_id
  ),
  per_full AS (
    SELECT EXTRACT(ISOYEAR FROM fn.data_naix)::int AS isoyear,
           EXTRACT(WEEK    FROM fn.data_naix)::int AS isoweek,
           EXTRACT(ISODOW  FROM fn.data_naix)::int AS dow,
           s.client_id, s.servits
    FROM full_naix fn
    JOIN serv s ON s.full_id = fn.full_id
  )
  SELECT
    pf.isoyear || '-W' || to_char(pf.isoweek,'FM00') AS setmana,
    pf.isoyear,
    pf.isoweek,
    pf.client_id,
    cl.nom AS client_nom,
    COALESCE(SUM(pf.servits) FILTER (WHERE pf.dow = 1),0)::bigint AS servits_dl,
    COALESCE(SUM(pf.servits) FILTER (WHERE pf.dow = 4),0)::bigint AS servits_dj,
    COALESCE(SUM(pf.servits),0)::bigint                          AS servits_set
  FROM per_full pf
  LEFT JOIN clients cl ON cl.id = pf.client_id
  GROUP BY pf.isoyear, pf.isoweek, pf.client_id, cl.nom
  ORDER BY pf.isoyear DESC, pf.isoweek DESC, servits_set DESC;
$function$;
