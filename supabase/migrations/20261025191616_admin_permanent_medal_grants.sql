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

-- Historical owner grants are preserved in production and not replayed.

