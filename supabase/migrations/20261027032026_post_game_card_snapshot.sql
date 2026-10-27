-- Authenticated, participant-scoped snapshot. No financial amounts or addresses.
CREATE FUNCTION app_private.post_game_card(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sessions%ROWTYPE; m public.session_score_matches%ROWTYPE; g text; names jsonb:='[]'; lines jsonb:='[]'; label text:='Partida encerrada'; confirmed boolean:=false; n integer;
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
   SELECT coalesce(jsonb_agg(jsonb_build_object('label',x.display_name,'value',x.score) ORDER BY x.won DESC,x.score DESC,x.display_name),'[]'::jsonb) INTO lines FROM (
    SELECT p.display_name,(m.state->'scores'->>m.teams[i])::integer AS score,p.id=ANY(m.winner_ids) AS won
    FROM generate_subscripts(m.players,1) i JOIN public.profiles p ON p.id=m.players[i]
    ORDER BY won DESC,score DESC,p.display_name LIMIT 6
   ) x;
  END IF;
 END IF;
 RETURN jsonb_build_object('title',e.title,'game',g,'variant',coalesce(e.game_variant,CASE WHEN g='poker' THEN 'texas_holdem' END),'starts_at',e.starts_at,'participants',n,'winner_label',label,'winner_names',names,'lines',lines,'confirmed',confirmed);
END; $$;
REVOKE ALL ON FUNCTION app_private.post_game_card(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.post_game_card(uuid) TO authenticated;
CREATE FUNCTION public.get_post_game_card(p_event_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.post_game_card(p_event_id); $$;
REVOKE ALL ON FUNCTION public.get_post_game_card(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_post_game_card(uuid) TO authenticated;
