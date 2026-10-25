-- 15 medalhas permanentes concedidas manualmente à conta administradora principal.
-- Concessão genuína de medalhas sem falsificar resultados de jogos ou rankings.
CREATE TABLE IF NOT EXISTS public.player_medal_grants (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medal_id text NOT NULL,
  level_index smallint NOT NULL CHECK (level_index BETWEEN 0 AND 3),
  granted_by uuid REFERENCES public.profiles(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,medal_id),
  CONSTRAINT player_medal_grants_medal_valid CHECK (
    medal_id = ANY (ARRAY[
      'first','collector','podium','shark','positive','record',
      'veteran','loyal','poker','blackjack','versatile',
      'champ','multi','pioneer','host'
    ]::text[])
  )
);
ALTER TABLE public.player_medal_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_medal_grants FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_medal_grants TO authenticated;
DROP POLICY IF EXISTS player_medal_grants_read ON public.player_medal_grants;
CREATE POLICY player_medal_grants_read ON public.player_medal_grants
 FOR SELECT TO authenticated
 USING (
   (SELECT auth.uid()) IS NOT NULL
   AND (
     user_id=(SELECT auth.uid())
     OR COALESCE(
       (SELECT s.visible FROM public.profile_medal_showcase s WHERE s.user_id=player_medal_grants.user_id),
       true
     )
   )
 );
-- Não conceder INSERT/UPDATE/DELETE ao cliente. A concessão só ocorre em operação administrativa auditável.

DO $grant$
DECLARE
 main_account uuid;
BEGIN
 IF (SELECT count(*) FROM public.app_admins) <> 1 THEN
   RAISE EXCEPTION 'Concessão suspensa: número de administradores inesperado';
 END IF;
 SELECT a.user_id INTO STRICT main_account
 FROM public.app_admins a
 JOIN public.profiles p ON p.id=a.user_id
 WHERE p.display_name='Bruno Avila';

 INSERT INTO public.player_medal_grants(user_id,medal_id,level_index,granted_by,reason)
 SELECT main_account,m.medal_id,m.level_index,main_account,
        'Concessão permanente autorizada pelo proprietário para visualizar e usar todas as medalhas'
 FROM (VALUES
   ('first',0),('collector',3),('podium',3),('shark',2),
   ('positive',3),('record',0),('veteran',3),('loyal',2),
   ('poker',3),('blackjack',3),('versatile',2),('champ',0),
   ('multi',2),('pioneer',0),('host',3)
 ) AS m(medal_id,level_index)
 ON CONFLICT(user_id,medal_id) DO UPDATE SET
   level_index=GREATEST(public.player_medal_grants.level_index,EXCLUDED.level_index);

 -- Pré-seleção visual, sem sobrescrever escolhas já realizadas pelo titular.
 INSERT INTO public.profile_medal_showcase(user_id,featured_id,pinned_ids,visible)
 VALUES(main_account,'collector',ARRAY['champ','shark','veteran']::text[],true)
 ON CONFLICT(user_id) DO NOTHING;
END $grant$;
