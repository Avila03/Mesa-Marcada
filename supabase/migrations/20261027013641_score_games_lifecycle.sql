CREATE FUNCTION app_private.start_score_game(p_request_id uuid,p_event_id uuid,p_players uuid[],p_teams integer[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=(SELECT auth.uid());e public.sessions%ROWTYPE;g text;n integer;scores integer[];teams integer[];v_payload jsonb:=jsonb_build_object('event',p_event_id,'players',p_players,'teams',p_teams);receipt app_private.mutation_receipts%ROWTYPE;
BEGIN
 IF a IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Faça login para iniciar a partida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||p_request_id::text,0));
 SELECT * INTO receipt FROM app_private.mutation_receipts WHERE actor_id=a AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.kind<>'start_score_game' OR receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Identificador de outra operação'; END IF;
  RETURN receipt.result_id;
 END IF;
 SELECT * INTO e FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR (e.organizer_id<>a AND NOT app_private.is_app_admin()) OR NOT app_private.may_view_event(e.id) OR app_private.is_event_hidden(e.id) THEN RAISE EXCEPTION 'Somente o anfitrião ou administrador pode iniciar'; END IF;
 IF e.status<>'scheduled' OR EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=e.id) OR EXISTS(SELECT 1 FROM public.session_score_matches WHERE session_id=e.id) THEN RAISE EXCEPTION 'Esta partida já iniciou ou não está agendada'; END IF;
 SELECT game INTO g FROM public.rooms WHERE id=e.room_id;
 IF g NOT IN('truco','canastra','pontinho','uno','pife') THEN RAISE EXCEPTION 'Esta mesa utiliza fichas'; END IF;
 n:=coalesce(cardinality(p_players),0);
 IF n<2 OR n<>(SELECT count(DISTINCT u) FROM unnest(p_players) u) OR array_position(p_players,NULL) IS NOT NULL
 OR n<>(SELECT count(*) FROM public.session_attendance WHERE session_id=e.id)
 OR EXISTS(SELECT 1 FROM unnest(p_players) u WHERE NOT EXISTS(SELECT 1 FROM public.session_attendance t WHERE t.session_id=e.id AND t.user_id=u))
 OR n<>(SELECT count(*) FROM public.session_table_seats WHERE session_id=e.id)
 THEN RAISE EXCEPTION 'Confirme todos os participantes e seus assentos antes de iniciar'; END IF;
 IF (g='truco' AND (n NOT IN(2,4,6) OR (e.game_variant<>'gauderio' AND n=6))) OR (g='canastra' AND n NOT IN(2,4)) OR (g='pontinho' AND n NOT BETWEEN 3 AND 8) OR (g='uno' AND n NOT BETWEEN 2 AND 10) OR (g='pife' AND n NOT BETWEEN 2 AND 8)
 THEN RAISE EXCEPTION 'Número de participantes incompatível com a modalidade'; END IF;
 IF g IN('truco','canastra') THEN
  teams:=p_teams;
  IF cardinality(teams) IS DISTINCT FROM n OR array_position(teams,NULL) IS NOT NULL OR EXISTS(SELECT 1 FROM unnest(teams) t WHERE t NOT IN(0,1))
  OR (SELECT count(*) FROM unnest(teams) t WHERE t=0)<>n/2 THEN RAISE EXCEPTION 'Monte duas equipes com o mesmo número de jogadores'; END IF;
  scores:=ARRAY[0,0];
 ELSE
  teams:=ARRAY(SELECT i FROM generate_series(0,n-1) i);
  scores:=ARRAY(SELECT CASE WHEN g='pontinho' THEN e.score_target ELSE 0 END FROM generate_series(1,n));
 END IF;
 INSERT INTO public.session_score_matches(session_id,game,variant,target,players,teams,state)
 VALUES(e.id,g,e.game_variant,e.score_target,p_players,teams,jsonb_build_object('scores',scores,'round',1,'envite_recorded',false));
 INSERT INTO public.session_live_state(session_id,started_by) VALUES(e.id,a);
 PERFORM app_private.write_live_activity(e.id,'started',a,NULL);
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(a,p_request_id,'start_score_game',v_payload,e.id);
 RETURN e.id;
END; $$;
REVOKE ALL ON FUNCTION app_private.start_score_game(uuid,uuid,uuid[],integer[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.start_score_game(uuid,uuid,uuid[],integer[]) TO authenticated;
CREATE FUNCTION public.start_score_game(p_request_id uuid,p_event_id uuid,p_players uuid[],p_teams integer[]) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.start_score_game(p_request_id,p_event_id,p_players,p_teams); $$;
REVOKE ALL ON FUNCTION public.start_score_game(uuid,uuid,uuid[],integer[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_score_game(uuid,uuid,uuid[],integer[]) TO authenticated;
CREATE FUNCTION app_private.score_ints(p_values jsonb,p_count integer,p_min integer,p_max integer) RETURNS integer[] LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE values_ integer[];t text;
BEGIN
 IF jsonb_typeof(p_values) IS DISTINCT FROM 'array' OR jsonb_array_length(p_values)<>p_count THEN RAISE EXCEPTION 'Preencha os valores de todos os jogadores'; END IF;
 FOR t IN SELECT jsonb_array_elements_text(p_values) LOOP
  IF t IS NULL OR t!~'^-?[0-9]{1,8}$' THEN RAISE EXCEPTION 'Informe números inteiros válidos'; END IF;
  IF t::integer NOT BETWEEN p_min AND p_max THEN RAISE EXCEPTION 'Valor fora dos limites'; END IF;
  values_:=array_append(values_,t::integer);
 END LOOP;
 RETURN values_;
END; $$;
REVOKE ALL ON FUNCTION app_private.score_ints(jsonb,integer,integer,integer) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.validate_live_points_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.rooms WHERE id=NEW.room_id AND game NOT IN('poker','blackjack')) THEN RETURN NEW; END IF;
 IF OLD.chip_settlement_brl THEN RETURN NEW; END IF;
 IF OLD.status='scheduled' AND NEW.status='finished' AND NOT OLD.chip_stock_legacy THEN
  IF EXISTS(SELECT 1 FROM public.session_attendance a
   LEFT JOIN public.session_chip_results r ON r.session_id=a.session_id AND r.user_id=a.user_id
   WHERE a.session_id=NEW.id AND
    (r.chips_final IS NULL OR r.chips_final IS DISTINCT FROM
      COALESCE((SELECT sum(f.quantity*f.chip_value)::bigint FROM public.session_chip_final_items f
       WHERE f.session_id=a.session_id AND f.user_id=a.user_id),0)))
   THEN RAISE EXCEPTION 'Pontos finais não conferem com as fichas físicas'; END IF;
 END IF;
 RETURN NEW;
END; $$;
