-- Immutable event receipts: only new finishes; no fabricated historical awards.
CREATE TABLE app_private.event_medal_receipts(
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 medal_id text NOT NULL,level_index smallint NOT NULL CHECK(level_index BETWEEN 0 AND 3),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,user_id,medal_id)
);
CREATE INDEX event_medal_receipts_user_idx ON app_private.event_medal_receipts(user_id);
ALTER TABLE app_private.event_medal_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.event_medal_receipts FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.card_receipt_scores()
 RETURNS TABLE(session_id uuid, league_id uuid, organizer_id uuid, starts_at timestamp with time zone, game text, user_id uuid, bought bigint, final_chips bigint, net bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH purchases AS (
 SELECT p.session_id,p.user_id,sum(p.amount_brl) AS brl,sum(p.chips_received) AS points
 FROM public.session_chip_purchases p GROUP BY p.session_id,p.user_id
), eligible AS (
 SELECT s.*,r.game FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
 WHERE (SELECT auth.uid()) IS NOT NULL AND s.status='finished' AND NOT app_private.is_event_hidden(s.id)
 AND EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=s.id)
 AND CASE WHEN s.chip_settlement_brl THEN app_private.cashout_balanced(s.id)
 ELSE NOT EXISTS(
  SELECT 1 FROM public.session_attendance a
  LEFT JOIN purchases p ON p.session_id=a.session_id AND p.user_id=a.user_id
  LEFT JOIN public.session_chip_results f ON f.session_id=a.session_id AND f.user_id=a.user_id
  LEFT JOIN public.session_finance_approvals v ON v.session_id=a.session_id AND v.user_id=a.user_id
  WHERE a.session_id=s.id AND (p.user_id IS NULL OR f.user_id IS NULL OR v.user_id IS NULL)
 ) END
), amounts AS (
 SELECT s.id,s.league_id,s.organizer_id,s.starts_at,s.game,a.user_id,
  round(coalesce(p.brl,0)*100)::bigint AS invested,
  round(100*CASE WHEN s.chip_settlement_brl THEN c.final_brl
   WHEN NOT s.chip_stock_legacy AND EXISTS(SELECT 1 FROM public.session_chip_final_items fi WHERE fi.session_id=s.id AND fi.user_id=a.user_id)
   THEN (SELECT sum(fi.quantity*CASE fi.chip_value WHEN 1 THEN s.chip_price_1_brl WHEN 5 THEN s.chip_price_5_brl WHEN 10 THEN s.chip_price_10_brl WHEN 25 THEN s.chip_price_25_brl ELSE s.chip_price_50_brl END)
         FROM public.session_chip_final_items fi WHERE fi.session_id=s.id AND fi.user_id=a.user_id)
   ELSE f.chips_final*(SELECT sum(pp.brl)/nullif(sum(pp.points),0) FROM purchases pp WHERE pp.session_id=s.id)
  END)::bigint AS returned
 FROM eligible s JOIN public.session_attendance a ON a.session_id=s.id
 LEFT JOIN purchases p ON p.session_id=s.id AND p.user_id=a.user_id
 LEFT JOIN public.session_chip_cashouts c ON c.session_id=s.id AND c.user_id=a.user_id
 LEFT JOIN public.session_chip_results f ON f.session_id=s.id AND f.user_id=a.user_id
)
SELECT id,league_id,organizer_id,starts_at,game,user_id,invested,returned,returned-invested FROM amounts;
$function$;

CREATE OR REPLACE FUNCTION app_private.card_receipt_finance(p_user_id uuid,p_exclude_event uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE stats jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login para consultar conquistas'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user_id)
 THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
 WITH
 eligible AS (
 SELECT DISTINCT e.session_id AS id,e.league_id,e.organizer_id,e.starts_at,e.game
 FROM (SELECT * FROM app_private.card_receipt_scores() WHERE session_id IS DISTINCT FROM p_exclude_event) e
 WHERE (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=e.session_id)>=2
 ), scores AS (
 SELECT e.session_id,e.league_id,e.organizer_id,e.starts_at,e.game,e.user_id,e.net
 FROM (SELECT * FROM app_private.card_receipt_scores() WHERE session_id IS DISTINCT FROM p_exclude_event) e JOIN eligible q ON q.id=e.session_id
 ),
 ranked AS (
  SELECT sc.*,rank() OVER(PARTITION BY sc.session_id ORDER BY sc.net DESC) AS standing,
  count(*) OVER(PARTITION BY sc.session_id) AS participants
  FROM scores sc
 ),
 my AS (SELECT * FROM ranked WHERE user_id=p_user_id),
 wins AS (
  SELECT game,count(*)::bigint AS total FROM my
  WHERE standing=1 AND net>0 GROUP BY game
 ),
 podium AS (
  SELECT game,count(*)::bigint AS total FROM my
  WHERE standing<=3 AND participants>=4 GROUP BY game
 ),
 shark_games AS (
  SELECT game,count(*)::bigint AS total,
   count(*) FILTER(WHERE standing=1 AND net>0)::bigint AS won
  FROM my GROUP BY game
 ),
 best_shark AS (
  SELECT COALESCE(max(CASE
   WHEN total>=40 AND won::numeric/total>=0.75 THEN 40
   WHEN total>=20 AND won::numeric/total>=0.70 THEN 20
   WHEN total>=10 AND won::numeric/total>=0.60 THEN 10
   ELSE 0 END),0)::bigint AS tier
  FROM shark_games
 ),
 records AS (
  SELECT user_id,game,net,
   row_number() OVER(PARTITION BY user_id,game ORDER BY starts_at,session_id) AS seq,
   max(net) OVER(PARTITION BY user_id,game ORDER BY starts_at,session_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS former_best
  FROM scores
 ),
 loyalty AS (
  SELECT coalesce(max(n),0)::bigint AS best FROM (
   SELECT league_id,count(*)::bigint AS n FROM my
   WHERE league_id IS NOT NULL GROUP BY league_id
  ) v
 ),
 per_game AS (
  SELECT game,count(*)::bigint AS total,sum(net)::bigint AS sum_net FROM my GROUP BY game
 ),
 pioneers AS (
  SELECT p_league.league_id,p_league.session_id
  FROM (
   SELECT id AS session_id,league_id,
    row_number() OVER(PARTITION BY league_id ORDER BY starts_at,id) AS position
   FROM eligible WHERE league_id IS NOT NULL
  ) p_league
  WHERE p_league.position=1
 ),
 winners AS (
  SELECT report.league_id,game.game_name,
   (member.value->>'user_id')::uuid AS player_id,
   (member.value->>'net_chips')::numeric AS points
  FROM app_private.league_final_reports report
  CROSS JOIN LATERAL (VALUES('poker'::text),('blackjack'::text)) game(game_name)
  CROSS JOIN LATERAL jsonb_array_elements(
   coalesce(report.summary->'games'->game.game_name->'ranking','[]'::jsonb)
  ) member(value)
  WHERE (member.value->>'net_chips')::numeric>0
  AND (member.value->>'net_chips')::numeric=(
   SELECT max((op.value->>'net_chips')::numeric)
   FROM jsonb_array_elements(
    coalesce(report.summary->'games'->game.game_name->'ranking','[]'::jsonb)
   ) op(value)
  )
 ),
 awards AS (
  SELECT key, greatest(0,coalesce(value,0))::bigint AS progress FROM (
   VALUES
    ('first'::text,(SELECT count(*) FROM my WHERE standing=1 AND net>0)),
    ('collector',(SELECT coalesce(max(total),0) FROM wins)),
    ('podium',(SELECT coalesce(max(total),0) FROM podium)),
    ('shark',(SELECT tier FROM best_shark)),
    ('positive',(SELECT count(*) FROM my WHERE net>0)),
    ('record',(SELECT count(*) FROM records WHERE user_id=p_user_id AND seq>=3 AND net>0 AND net>former_best)),
    ('veteran',(SELECT count(*) FROM my)),
    ('loyal',(SELECT best FROM loyalty)),
    ('poker',(SELECT count(*) FROM my WHERE game='poker')),
    ('blackjack',(SELECT count(*) FROM my WHERE game='blackjack')),
    ('versatile',(SELECT CASE WHEN
      coalesce((SELECT sum_net FROM per_game WHERE game='poker'),0)>0
      AND coalesce((SELECT sum_net FROM per_game WHERE game='blackjack'),0)>0
      THEN least(coalesce((SELECT total FROM per_game WHERE game='poker'),0),
                 coalesce((SELECT total FROM per_game WHERE game='blackjack'),0))
      ELSE 0 END)),
    ('champ',(SELECT count(*) FROM winners WHERE player_id=p_user_id)),
    ('multi',(SELECT count(DISTINCT league_id) FROM winners WHERE player_id=p_user_id)),
    ('pioneer',(SELECT count(*) FROM pioneers pi JOIN my m ON m.session_id=pi.session_id)),
    ('host',(SELECT count(*) FROM eligible e WHERE e.organizer_id=p_user_id))
  ) values_by_medal(key,value)
 )
 SELECT coalesce(jsonb_object_agg(key,progress),'{}'::jsonb) INTO stats FROM awards;
 RETURN stats;
END; $function$;



CREATE FUNCTION app_private.card_receipt_progress(p_user_id uuid,p_exclude_event uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE old jsonb; fresh jsonb;
BEGIN
 old:=app_private.card_receipt_finance(p_user_id,p_exclude_event);
 WITH valid AS (
  SELECT s.id,s.league_id,s.organizer_id,s.starts_at,m.* FROM public.sessions s
  JOIN public.session_score_matches m ON m.session_id=s.id
  WHERE s.status='finished' AND m.status='complete' AND cardinality(m.players)>=2
  AND cardinality(m.winner_ids)>0 AND NOT app_private.is_event_hidden(s.id) AND s.id IS DISTINCT FROM p_exclude_event
 ), my AS (
  SELECT v.*,p_user_id=ANY(v.winner_ids) AS won FROM valid v WHERE p_user_id=ANY(v.players)
 ), modes AS (
  SELECT game,count(*) n,count(*) FILTER(WHERE won) wins FROM my GROUP BY game
 ), all_history AS (
  SELECT DISTINCT e.session_id AS id,e.league_id,e.organizer_id,e.starts_at,e.game,e.user_id
  FROM (SELECT * FROM app_private.card_receipt_scores() WHERE session_id IS DISTINCT FROM p_exclude_event) e
  WHERE (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=e.session_id)>=2
  UNION ALL SELECT session_id,league_id,organizer_id,starts_at,game,p_user_id FROM my
 ), loyalty AS (
  SELECT coalesce(max(n),0) n FROM (SELECT count(*) n FROM all_history WHERE user_id=p_user_id AND league_id IS NOT NULL GROUP BY league_id)x
 ), first_events AS (
  SELECT id,league_id,row_number() OVER(PARTITION BY league_id ORDER BY starts_at,id) position
  FROM (SELECT DISTINCT id,league_id,starts_at FROM all_history WHERE league_id IS NOT NULL
   UNION SELECT session_id,league_id,starts_at FROM valid WHERE league_id IS NOT NULL)x
 ), league_wins AS (
  SELECT r.league_id FROM app_private.league_final_reports r
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.summary->'score_games','[]'::jsonb)) g
  WHERE (g->'ranking'->0->>'user_id')::uuid=p_user_id AND (g->'ranking'->0->>'wins')::bigint>0

 ), awards AS (
 SELECT game key,n value FROM modes
 UNION ALL SELECT game||'_wins',wins FROM modes
 UNION ALL SELECT 'first',coalesce((old->>'first')::bigint,0)+(SELECT count(*) FROM my WHERE won)
 UNION ALL SELECT 'collector',greatest(coalesce((old->>'collector')::bigint,0),coalesce((SELECT max(wins) FROM modes),0))
 UNION ALL SELECT 'shark',greatest(coalesce((old->>'shark')::bigint,0),coalesce((SELECT max(CASE WHEN n>=40 AND wins::numeric/n>=0.75 THEN 40 WHEN n>=20 AND wins::numeric/n>=0.70 THEN 20 WHEN n>=10 AND wins::numeric/n>=0.60 THEN 10 ELSE 0 END) FROM modes),0))
 UNION ALL SELECT 'veteran',coalesce((old->>'veteran')::bigint,0)+(SELECT count(*) FROM my)
 UNION ALL SELECT 'loyal',(SELECT n FROM loyalty)
 UNION ALL SELECT 'host',coalesce((old->>'host')::bigint,0)+(SELECT count(*) FROM valid WHERE organizer_id=p_user_id)
 UNION ALL SELECT 'explorer',(SELECT count(DISTINCT game) FROM all_history WHERE user_id=p_user_id)
 UNION ALL SELECT 'truco_routes',(SELECT count(DISTINCT variant) FROM my WHERE game='truco')
 UNION ALL SELECT 'canastra_routes',(SELECT count(DISTINCT variant) FROM my WHERE game='canastra')
 UNION ALL SELECT 'duo_wins',(SELECT count(*) FROM my WHERE won AND game IN('truco','canastra') AND cardinality(winner_ids)>=2)
 UNION ALL SELECT 'draw_poker',(SELECT count(*) FROM (SELECT * FROM app_private.card_receipt_scores() WHERE session_id IS DISTINCT FROM p_exclude_event) e JOIN public.sessions s ON s.id=e.session_id WHERE e.user_id=p_user_id AND e.game='poker' AND s.game_variant='five_card_draw' AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=s.id)>=2)
 UNION ALL SELECT 'league_cards',(SELECT count(*) FROM league_wins)
 UNION ALL SELECT 'pioneer',coalesce((old->>'pioneer')::bigint,0)+(SELECT count(*) FROM first_events f JOIN my m ON m.session_id=f.id WHERE f.position=1)
 ) SELECT coalesce(jsonb_object_agg(key,greatest(value,0)),'{}'::jsonb) INTO fresh FROM awards;
 RETURN old||jsonb_build_object('truco',0,'canastra',0,'pontinho',0,'uno',0,'pife',0,'truco_wins',0,'canastra_wins',0,'pontinho_wins',0,'uno_wins',0,'pife_wins',0)||fresh;
END; $$;

REVOKE ALL ON FUNCTION app_private.card_receipt_scores() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION app_private.card_receipt_finance(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION app_private.card_receipt_progress(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION app_private.capture_event_medals() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid; prior jsonb; current_stats jsonb; rule record; old_tier integer; new_tier integer; gift integer;
 rules CONSTANT jsonb := '{"first":[1],"collector":[5,15,30,50],"podium":[5,15,30,50],"shark":[10,20,40],"positive":[10,25,50,100],"record":[1],"veteran":[10,30,75,150],"loyal":[10,25,50],"poker":[10,25,50,100],"blackjack":[10,25,50,100],"versatile":[5,15,30],"champ":[1],"multi":[2,3,5],"pioneer":[1],"host":[5,15,30,60],"truco":[3,10,25,50],"canastra":[3,10,25,50],"pontinho":[3,10,25,50],"uno":[3,10,25,50],"pife":[3,10,25,50],"truco_wins":[1,5,15,30],"canastra_wins":[1,5,15,30],"pontinho_wins":[1,5,15,30],"uno_wins":[1,5,15,30],"pife_wins":[1,5,15,30],"explorer":[3,5,7],"truco_routes":[2,3],"canastra_routes":[2,3],"duo_wins":[3,10,25,50],"draw_poker":[1,5,15,30],"league_cards":[1,3,5]}'::jsonb;
BEGIN
 IF NEW.status<>'finished' OR OLD.status='finished' OR (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
 -- Serialize concurrent closes for shared players; sorted locks avoid deadlocks.
 FOR who IN SELECT DISTINCT u FROM (SELECT a.user_id u FROM public.session_attendance a WHERE a.session_id=NEW.id UNION SELECT NEW.organizer_id)x ORDER BY u LOOP
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,6400));
 END LOOP;
 FOR who IN SELECT DISTINCT u FROM (SELECT a.user_id u FROM public.session_attendance a WHERE a.session_id=NEW.id UNION SELECT NEW.organizer_id)x ORDER BY u LOOP
  prior:=app_private.card_receipt_progress(who,NEW.id);
  current_stats:=app_private.card_receipt_progress(who,NULL);
  FOR rule IN SELECT key,value FROM jsonb_each(rules) LOOP
   SELECT coalesce(max(ordinality-1),-1) INTO old_tier FROM jsonb_array_elements_text(rule.value) WITH ORDINALITY t(value,ordinality) WHERE value::bigint<=coalesce((prior->>rule.key)::bigint,0);
   SELECT coalesce(max(ordinality-1),-1) INTO new_tier FROM jsonb_array_elements_text(rule.value) WITH ORDINALITY t(value,ordinality) WHERE value::bigint<=coalesce((current_stats->>rule.key)::bigint,0);
   SELECT coalesce(max(level_index),-1) INTO gift FROM public.player_medal_grants WHERE user_id=who AND medal_id=rule.key;
   IF new_tier>greatest(old_tier,gift) THEN
    INSERT INTO app_private.event_medal_receipts(session_id,user_id,medal_id,level_index) VALUES(NEW.id,who,rule.key,new_tier) ON CONFLICT DO NOTHING;
   END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.capture_event_medals() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_capture_event_medals AFTER UPDATE OF status ON public.sessions FOR EACH ROW EXECUTE FUNCTION app_private.capture_event_medals();

CREATE OR REPLACE FUNCTION app_private.post_game_card(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sessions%ROWTYPE; m public.session_score_matches%ROWTYPE; g text; names jsonb:='[]'; lines jsonb:='[]'; label text:='Partida encerrada'; confirmed boolean:=false; n integer; league jsonb; teams jsonb:='[]'; awards jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login para gerar o card'; END IF;
 SELECT * INTO e FROM public.sessions WHERE id=p_event_id;
 IF NOT FOUND OR e.status<>'finished' OR app_private.is_event_hidden(e.id)
 OR NOT app_private.may_view_event(e.id) OR NOT app_private.can_view_session_private(e.id)
 THEN RAISE EXCEPTION 'O card exige um evento encerrado e acesso aos resultados'; END IF;
 SELECT game INTO g FROM public.rooms WHERE id=e.room_id;
 SELECT count(*) INTO n FROM public.session_attendance WHERE session_id=e.id;
 IF g IN('poker','blackjack') THEN
  WITH scores AS (SELECT * FROM app_private.event_scores() WHERE session_id=e.id), winners AS (
   SELECT p.display_name FROM scores s JOIN public.profiles p ON p.id=s.user_id
   WHERE s.net>0 AND s.net=(SELECT max(net) FROM scores)
  ) SELECT coalesce(jsonb_agg(display_name ORDER BY display_name),'[]'::jsonb) INTO names FROM winners;
  SELECT EXISTS(SELECT 1 FROM app_private.event_scores() WHERE session_id=e.id) INTO confirmed;
  label:='Destaque em saldo';
 ELSE
  SELECT * INTO m FROM public.session_score_matches WHERE session_id=e.id AND status='complete';
  IF NOT FOUND THEN RAISE EXCEPTION 'Resultado da modalidade ainda não foi conferido'; END IF;
  confirmed:=true;label:=CASE WHEN cardinality(m.winner_ids)>1 THEN 'Equipe vencedora' ELSE 'Vencedor da partida' END;
  SELECT coalesce(jsonb_agg(p.display_name ORDER BY p.display_name),'[]'::jsonb) INTO names FROM public.profiles p WHERE p.id=ANY(m.winner_ids);
  IF g IN('truco','canastra') THEN
   SELECT jsonb_agg(jsonb_build_object('label',CASE side WHEN 0 THEN 'Equipe Azul' ELSE 'Equipe Vermelha' END,'value',(m.state->'scores'->>side)::integer) ORDER BY side) INTO lines FROM generate_series(0,1) side;
  ELSE
   SELECT coalesce(jsonb_agg(jsonb_build_object('label',x.display_name,'value',x.score,'winner',x.won,'eliminated',g='pontinho' AND NOT x.won) ORDER BY x.won DESC,x.score DESC,x.display_name),'[]'::jsonb) INTO lines FROM (
    SELECT p.display_name,(m.state->'scores'->>m.teams[i])::integer AS score,p.id=ANY(m.winner_ids) AS won
    FROM generate_subscripts(m.players,1) i JOIN public.profiles p ON p.id=m.players[i]
    ORDER BY won DESC,score DESC,p.display_name LIMIT 6
   ) x;
  END IF;
 END IF;
 SELECT jsonb_build_object('name',l.name,'emblem',l.emblem) INTO league FROM public.leagues l WHERE l.id=e.league_id;
 IF g IN('truco','canastra') THEN
  SELECT jsonb_agg(jsonb_build_object('label',CASE side WHEN 0 THEN 'Equipe Azul' ELSE 'Equipe Vermelha' END,'score',(m.state->'scores'->>side)::integer,'names',coalesce((SELECT jsonb_agg(p.display_name ORDER BY i) FROM generate_subscripts(m.players,1) i JOIN public.profiles p ON p.id=m.players[i] WHERE m.teams[i]=side),'[]'::jsonb),'winner',EXISTS(SELECT 1 FROM generate_subscripts(m.players,1) i WHERE m.teams[i]=side AND m.players[i]=ANY(m.winner_ids))) ORDER BY side) INTO teams FROM generate_series(0,1) side;
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('medal_id',r.medal_id,'level_index',r.level_index,'player_name',p.display_name) ORDER BY r.medal_id,p.display_name),'[]'::jsonb) INTO awards FROM app_private.event_medal_receipts r JOIN public.profiles p ON p.id=r.user_id WHERE r.session_id=e.id;
 RETURN jsonb_build_object('league',league,'teams',teams,'awards',awards,'target',e.score_target,'title',e.title,'game',g,'variant',coalesce(e.game_variant,CASE WHEN g='poker' THEN 'texas_holdem' END),'starts_at',e.starts_at,'participants',n,'winner_label',label,'winner_names',names,'lines',lines,'confirmed',confirmed);
END; $$;
