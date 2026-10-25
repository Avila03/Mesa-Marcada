-- Five real prestige frames. Never touch the existing 15 medals or game rankings.
CREATE TABLE IF NOT EXISTS public.profile_frame_showcase (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  frame_id text,
  variant text NOT NULL DEFAULT 'original',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT frame_id_five_only CHECK(frame_id IS NULL OR frame_id=ANY(ARRAY['safira','dupla-coroa','rei-sequencia','high-roller','conclave']::text[])),
  CONSTRAINT frame_variant CHECK(variant=ANY(ARRAY['original','ciano','noturno']::text[])),
  CONSTRAINT special_variants_only_safira CHECK(variant='original' OR frame_id='safira')
);
ALTER TABLE public.profile_frame_showcase ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_frame_showcase FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profile_frame_showcase TO authenticated;
DROP POLICY IF EXISTS frame_showcase_read ON public.profile_frame_showcase;
CREATE POLICY frame_showcase_read ON public.profile_frame_showcase FOR SELECT TO authenticated
 USING((SELECT auth.uid())=user_id OR coalesce((SELECT s.visible FROM public.profile_medal_showcase s WHERE s.user_id=profile_frame_showcase.user_id),true));
DROP POLICY IF EXISTS frame_showcase_insert ON public.profile_frame_showcase;
CREATE POLICY frame_showcase_insert ON public.profile_frame_showcase FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS frame_showcase_update ON public.profile_frame_showcase;
CREATE POLICY frame_showcase_update ON public.profile_frame_showcase FOR UPDATE TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.player_frame_grants(
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 frame_id text NOT NULL CHECK(frame_id=ANY(ARRAY['safira','dupla-coroa','rei-sequencia','high-roller','conclave']::text[])),
 granted_by uuid REFERENCES public.profiles(id),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,frame_id)
);
ALTER TABLE public.player_frame_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_frame_grants FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_frame_grants TO authenticated;
DROP POLICY IF EXISTS player_frame_grants_read ON public.player_frame_grants;
CREATE POLICY player_frame_grants_read ON public.player_frame_grants FOR SELECT TO authenticated
 USING((SELECT auth.uid())=user_id OR coalesce((SELECT s.visible FROM public.profile_medal_showcase s WHERE s.user_id=player_frame_grants.user_id),true));

-- Read-only verified progress. No player can mint grants through this function.
CREATE OR REPLACE FUNCTION public.get_player_frame_progress(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id)
 THEN RAISE EXCEPTION 'Jogador inexistente'; END IF;
 WITH
 confirmed_buys AS (
  SELECT session_id,user_id,sum(chips_received)::bigint AS chips
  FROM public.session_chip_purchases
  WHERE payment_status='paid'
  GROUP BY session_id,user_id
 ),
 qualified_events AS (
  SELECT s.id,s.league_id,s.starts_at,r.game
  FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
  WHERE s.status='finished' AND s.league_id IS NOT NULL
    AND NOT app_private.is_event_hidden(s.id)
    AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=s.id)>=2
    AND NOT EXISTS (
     SELECT 1 FROM public.session_attendance a
     LEFT JOIN confirmed_buys b ON b.session_id=a.session_id AND b.user_id=a.user_id
     LEFT JOIN public.session_chip_results sr ON sr.session_id=a.session_id AND sr.user_id=a.user_id
     LEFT JOIN public.session_finance_approvals fa ON fa.session_id=a.session_id AND fa.user_id=a.user_id
     WHERE a.session_id=s.id AND (b.user_id IS NULL OR sr.user_id IS NULL OR fa.user_id IS NULL)
    )
 ),
 scored AS (
  SELECT e.id AS event_id,e.league_id,e.starts_at,e.game,a.user_id,
    (cr.chips_final-b.chips)::bigint AS net
  FROM qualified_events e
  JOIN public.session_attendance a ON a.session_id=e.id
  JOIN confirmed_buys b ON b.session_id=a.session_id AND b.user_id=a.user_id
  JOIN public.session_chip_results cr ON cr.session_id=a.session_id AND cr.user_id=a.user_id
 ),
 timeline AS (
  SELECT e.*,row_number() OVER(PARTITION BY league_id,game ORDER BY starts_at,id) AS seq
  FROM qualified_events e
 ),
 competing AS (
  SELECT DISTINCT league_id,game,user_id FROM scored
 ),
 cumulative AS (
  SELECT e.id AS event_id,e.league_id,e.game,e.starts_at,e.seq,p.user_id,
    coalesce((SELECT sum(s.net) FROM scored s JOIN timeline t ON t.id=s.event_id
      WHERE s.league_id=e.league_id AND s.game=e.game AND s.user_id=p.user_id
        AND t.seq<=e.seq),0)::bigint AS total,
    EXISTS(SELECT 1 FROM scored sc WHERE sc.event_id=e.id AND sc.user_id=p.user_id) AS played
  FROM timeline e JOIN competing p ON p.league_id=e.league_id AND p.game=e.game
 ),
 leaders AS (
  SELECT c.*,
    rank() OVER(PARTITION BY event_id ORDER BY total DESC) AS place,
    count(*) OVER(PARTITION BY event_id,total) AS tied
  FROM cumulative c
 ),
 leader_windows AS (
  SELECT l.*,
    count(*) OVER w AS checked,
    sum(CASE WHEN place=1 AND tied=1 AND total>0 THEN 1 ELSE 0 END) OVER w AS wins,
    sum(CASE WHEN played THEN 1 ELSE 0 END) OVER w AS participations
  FROM leaders l
  WINDOW w AS (PARTITION BY league_id,game,user_id ORDER BY seq ROWS BETWEEN 5 PRECEDING AND CURRENT ROW)
 ),
 leader_score AS (
  SELECT coalesce(max(CASE WHEN checked=6 AND wins=6 AND participations>=4 THEN 6
    ELSE least(wins,5) END),0)::int AS score
  FROM leader_windows WHERE user_id=p_user_id
 ),
 payables AS (
  SELECT x.session_id,x.paid_by,sum(x.amount_brl)::numeric AS spent
  FROM public.session_expenses x
  JOIN qualified_events qe ON qe.id=x.session_id
  WHERE x.amount_brl>0 AND x.split_open=true
    AND (SELECT count(*) FROM public.expense_split_members m WHERE m.expense_id=x.id)>=2
    AND NOT EXISTS (
      SELECT 1 FROM public.expense_split_members m
      WHERE m.expense_id=x.id AND m.user_id<>x.paid_by
        AND NOT EXISTS(SELECT 1 FROM public.expense_split_settlements st
          WHERE st.expense_id=x.id AND st.user_id=m.user_id AND st.confirmed_at IS NOT NULL)
    )
  GROUP BY x.session_id,x.paid_by
 ),
 payment_ranks AS (
  SELECT qe.id,qe.starts_at,a.user_id,coalesce(p.spent,0)::numeric AS paid,
    rank() OVER(PARTITION BY qe.id ORDER BY coalesce(p.spent,0) DESC) AS standing,
    count(*) OVER(PARTITION BY qe.id,coalesce(p.spent,0)) AS tied
  FROM qualified_events qe
  JOIN public.session_attendance a ON a.session_id=qe.id
  LEFT JOIN payables p ON p.session_id=qe.id AND p.paid_by=a.user_id
 ),
 paid_windows AS (
  SELECT *,
    count(*) OVER w AS checked,
    sum(CASE WHEN standing=1 AND tied=1 AND paid>0 THEN 1 ELSE 0 END) OVER w AS streak
  FROM payment_ranks
  WHERE user_id=p_user_id
  WINDOW w AS (ORDER BY starts_at,id ROWS BETWEEN 4 PRECEDING AND CURRENT ROW)
 ),
 high_score AS (
  SELECT coalesce(max(CASE WHEN checked=5 AND streak=5 THEN 5 ELSE least(streak,4) END),0)::int AS score
  FROM paid_windows
 ),
 champions AS (
  SELECT league_id,game,user_id,net,
    max(net) OVER(PARTITION BY league_id,game) AS top_net
  FROM (
    SELECT f.league_id,g.game,m.item->>'user_id' AS user_id,
           coalesce((m.item->>'net_chips')::numeric,0) AS net
    FROM app_private.league_final_reports f
    CROSS JOIN LATERAL (VALUES('poker'::text),('blackjack'::text)) g(game)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(f.summary->'games'->g.game->'ranking','[]'::jsonb)) m(item)
  ) all_members
 ),
 dual_score AS (
  SELECT count(*)::int AS score FROM (
    SELECT league_id FROM champions
    WHERE user_id=p_user_id::text AND net=top_net AND net>0
    GROUP BY league_id HAVING count(DISTINCT game)=2
  ) qualifying_leagues
 ),
 profile_score AS (
  SELECT
   (CASE WHEN p.avatar_path IS NOT NULL AND length(trim(p.avatar_path))>0 THEN 1 ELSE 0 END
   +CASE WHEN p.bio IS NOT NULL AND length(trim(p.bio))>0 THEN 1 ELSE 0 END
   +CASE WHEN p.favorite_game IN('poker','blackjack') THEN 1 ELSE 0 END
   +CASE WHEN sh.featured_id IS NOT NULL THEN 1 ELSE 0 END
   +CASE WHEN coalesce(cardinality(sh.pinned_ids),0)=3 THEN 1 ELSE 0 END)::int AS score
  FROM public.profiles p LEFT JOIN public.profile_medal_showcase sh ON sh.user_id=p.id
  WHERE p.id=p_user_id
 )
 SELECT jsonb_build_object(
  'safira',coalesce((SELECT score FROM profile_score),0),
  'dupla-coroa',coalesce((SELECT score FROM dual_score),0),
  'rei-sequencia',coalesce((SELECT score FROM leader_score),0),
  'high-roller',coalesce((SELECT score FROM high_score),0),
  'conclave',coalesce((SELECT count(DISTINCT league_id) FROM scored WHERE user_id=p_user_id),0)
 ) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_player_frame_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_frame_progress(uuid) TO authenticated;

-- Exactly five true administrator grants; no fabricated games or finances.
DO $$
DECLARE principal uuid;
BEGIN
 IF (SELECT count(*) FROM public.app_admins)<>1 THEN
  RAISE EXCEPTION 'Revisar conta principal antes de conceder molduras';
 END IF;
 SELECT a.user_id INTO STRICT principal
 FROM public.app_admins a JOIN public.profiles p ON p.id=a.user_id
 WHERE p.display_name='Bruno Avila';
 INSERT INTO public.player_frame_grants(user_id,frame_id,granted_by,reason)
 SELECT principal,x.id,principal,'Concessão real das 5 molduras solicitada pelo proprietário'
 FROM (VALUES('safira'),('dupla-coroa'),('rei-sequencia'),('high-roller'),('conclave')) x(id)
 ON CONFLICT(user_id,frame_id) DO NOTHING;
 INSERT INTO public.profile_frame_showcase(user_id,frame_id,variant)
 VALUES(principal,'safira','original')
 ON CONFLICT(user_id) DO NOTHING;
END $$;
