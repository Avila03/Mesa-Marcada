-- Shared guide for the physical table. Does not distribute cards or change scores.
CREATE TABLE public.session_table_order(
 session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
 dealer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 starter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 direction smallint NOT NULL CHECK(direction IN(-1,1)),
 distribution integer NOT NULL DEFAULT 1 CHECK(distribution>=1),
 revision integer NOT NULL CHECK(revision>=1),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_table_order_dealer_idx ON public.session_table_order(dealer_id);
CREATE INDEX session_table_order_starter_idx ON public.session_table_order(starter_id);
ALTER TABLE public.session_table_order ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_table_order FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_table_order TO authenticated;
CREATE POLICY table_order_read ON public.session_table_order FOR SELECT TO authenticated USING(
 app_private.can_view_session_private(session_id) AND app_private.may_view_event(session_id) AND NOT app_private.is_event_hidden(session_id)
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_table_order;

CREATE FUNCTION app_private.get_table_order(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sessions%ROWTYPE; result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT app_private.may_view_event(p_event_id) OR NOT app_private.can_view_session_private(p_event_id) OR app_private.is_event_hidden(p_event_id) THEN RAISE EXCEPTION 'Sem acesso à ordem desta mesa'; END IF;
 SELECT * INTO e FROM public.sessions WHERE id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evento indisponível'; END IF;
 SELECT jsonb_build_object('order',(SELECT to_jsonb(t) FROM public.session_table_order t WHERE session_id=e.id),'fixed_dealer_id',CASE WHEN (SELECT r.game FROM public.rooms r WHERE r.id=e.room_id)='blackjack' THEN (SELECT user_id FROM public.session_table_seats WHERE session_id=e.id AND seat_no=0) END,'eligible_players',ARRAY(SELECT s.user_id FROM public.session_table_seats s WHERE s.session_id=e.id AND ((SELECT r.game FROM public.rooms r WHERE r.id=e.room_id)<>'pontinho' OR EXISTS(SELECT 1 FROM public.session_score_matches m WHERE m.session_id=e.id AND (m.state->'scores'->>(array_position(m.players,s.user_id)-1))::integer>0)) ORDER BY s.seat_no),'locked',e.status<>'scheduled' OR NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=e.id) OR EXISTS(SELECT 1 FROM public.session_score_matches WHERE session_id=e.id AND status='complete')) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION app_private.get_table_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_table_order(uuid) TO authenticated;
CREATE FUNCTION public.get_table_order(p_event_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT app_private.get_table_order(p_event_id);$$;
REVOKE ALL ON FUNCTION public.get_table_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_table_order(uuid) TO authenticated;

CREATE FUNCTION app_private.table_order_command(p_request_id uuid,p_event_id uuid,p_revision integer,p_action text,p_dealer uuid,p_starter uuid,p_direction integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); e public.sessions%ROWTYPE; prior app_private.mutation_receipts%ROWTYPE;
 current_order public.session_table_order%ROWTYPE; game text; people uuid[]; eligible uuid[]; next_dealer uuid; next_starter uuid;
 idx integer; step integer; candidate uuid; dir integer; n integer; distribution integer;
 payload jsonb:=jsonb_build_object('event',p_event_id,'revision',p_revision,'action',p_action,'dealer',p_dealer,'starter',p_starter,'direction',p_direction);
BEGIN
 IF actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Faça login para organizar a mesa'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_request_id::text,0));
 SELECT * INTO prior FROM app_private.mutation_receipts WHERE actor_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF prior.kind<>'table_order_command' OR prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Identificador de outra operação'; END IF;
  RETURN prior.result_id;
 END IF;
 SELECT * INTO e FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR (e.organizer_id<>actor AND NOT app_private.is_app_admin()) OR NOT app_private.may_view_event(e.id) OR app_private.is_event_hidden(e.id) THEN RAISE EXCEPTION 'Somente o anfitrião ou administrador pode organizar a mesa'; END IF;
 IF e.status<>'scheduled' OR NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=e.id) OR EXISTS(SELECT 1 FROM public.session_score_matches WHERE session_id=e.id AND status='complete') THEN RAISE EXCEPTION 'A mesa precisa estar ao vivo e sem resultado final'; END IF;
 SELECT r.game INTO game FROM public.rooms r WHERE r.id=e.room_id;
 SELECT array_agg(s.user_id ORDER BY s.seat_no) INTO people FROM public.session_table_seats s JOIN public.session_attendance a ON a.session_id=s.session_id AND a.user_id=s.user_id WHERE s.session_id=e.id;
 SELECT array_agg(u ORDER BY i) INTO eligible FROM unnest(people) WITH ORDINALITY t(u,i)
 WHERE game<>'pontinho' OR EXISTS(SELECT 1 FROM public.session_score_matches m WHERE m.session_id=e.id AND (m.state->'scores'->>(array_position(m.players,u)-1))::integer>0);
 n:=coalesce(cardinality(people),0);
 IF n<2 OR coalesce(cardinality(eligible),0)<2 THEN RAISE EXCEPTION 'Confirme pelo menos dois jogadores ativos'; END IF;
 SELECT * INTO current_order FROM public.session_table_order WHERE session_id=e.id FOR UPDATE;
 IF p_revision IS NULL OR p_revision<>coalesce(current_order.revision,0) THEN RAISE EXCEPTION 'A ordem mudou em outro aparelho. Atualize antes de continuar'; END IF;
 IF p_action='configure' THEN
  IF p_direction IS NULL OR p_direction NOT IN(-1,1) OR p_starter IS NULL OR NOT p_starter=ANY(eligible)
   OR p_dealer IS NULL OR NOT p_dealer=ANY(eligible) OR (game<>'poker' AND p_starter=p_dealer) OR (game='blackjack' AND (p_dealer IS DISTINCT FROM (SELECT user_id FROM public.session_table_seats WHERE session_id=e.id AND seat_no=0))) THEN RAISE EXCEPTION 'Escolha responsáveis ativos e um sentido válido'; END IF;
  next_dealer:=p_dealer;next_starter:=p_starter;dir:=p_direction;distribution:=coalesce(current_order.distribution,1);
 ELSIF p_action='advance' THEN
  IF current_order.revision IS NULL OR current_order.starter_id IS NULL OR (current_order.dealer_id IS NULL AND game<>'blackjack') THEN RAISE EXCEPTION 'Defina os responsáveis antes de avançar'; END IF;
  dir:=current_order.direction;distribution:=current_order.distribution+1;next_dealer:=current_order.dealer_id;
  IF game<>'blackjack' THEN
   idx:=coalesce(array_position(people,current_order.dealer_id),1);
   FOR step IN 1..n LOOP
    candidate:=people[((idx-1+dir*step)%n+n)%n+1];
    IF candidate=ANY(eligible) THEN next_dealer:=candidate;EXIT; END IF;
   END LOOP;
  END IF;
  idx:=coalesce(array_position(people,current_order.starter_id),1);
  FOR step IN 1..n LOOP
   candidate:=people[((idx-1+dir*step)%n+n)%n+1];
   IF candidate=ANY(eligible) AND (game='poker' OR candidate<>next_dealer) THEN next_starter:=candidate;EXIT; END IF;
  END LOOP;
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
 INSERT INTO public.session_table_order(session_id,dealer_id,starter_id,direction,distribution,revision)
 VALUES(e.id,next_dealer,next_starter,dir,distribution,coalesce(current_order.revision,0)+1)
 ON CONFLICT(session_id) DO UPDATE SET dealer_id=excluded.dealer_id,starter_id=excluded.starter_id,direction=excluded.direction,distribution=excluded.distribution,revision=excluded.revision,updated_at=now();
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(actor,p_request_id,'table_order_command',payload,e.id);
 RETURN e.id;
END; $$;
REVOKE ALL ON FUNCTION app_private.table_order_command(uuid,uuid,integer,text,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.table_order_command(uuid,uuid,integer,text,uuid,uuid,integer) TO authenticated;
CREATE FUNCTION public.table_order_command(p_request_id uuid,p_event_id uuid,p_revision integer,p_action text,p_dealer uuid,p_starter uuid,p_direction integer) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT app_private.table_order_command(p_request_id,p_event_id,p_revision,p_action,p_dealer,p_starter,p_direction);$$;
REVOKE ALL ON FUNCTION public.table_order_command(uuid,uuid,integer,text,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.table_order_command(uuid,uuid,integer,text,uuid,uuid,integer) TO authenticated;
