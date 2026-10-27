CREATE FUNCTION app_private.score_game_command(p_request_id uuid,p_event_id uuid,p_expected_revision integer,p_action text,p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=(SELECT auth.uid());e public.sessions%ROWTYPE;m public.session_score_matches%ROWTYPE;
 receipt app_private.mutation_receipts%ROWTYPE;v_payload jsonb:=jsonb_build_object('event',p_event_id,'revision',p_expected_revision,'action',p_action,'payload',p_payload);
 previous public.session_score_actions%ROWTYPE;before_ jsonb;scores integer[];losses integer[];clean integer[];dirty integer[];cards integer[];hands integer[];dead integer[];
 n integer;side integer;points integer;i integer;w integer;round_ integer;envited boolean;finished_ boolean:=false;winner_ids_ uuid[]:='{}';best integer;win_side integer;kind text;
BEGIN
 IF a IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Operação inválida ou sem autenticação'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(a::text||p_request_id::text,0));
 SELECT * INTO receipt FROM app_private.mutation_receipts WHERE actor_id=a AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.kind<>'score_game_command' OR receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Identificador de outra operação'; END IF;
  RETURN receipt.result_id;
 END IF;
 SELECT * INTO e FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR (e.organizer_id<>a AND NOT app_private.is_app_admin()) OR NOT app_private.may_view_event(e.id) OR app_private.is_event_hidden(e.id) THEN RAISE EXCEPTION 'Somente o anfitrião ou administrador pode registrar resultados'; END IF;
 IF e.status<>'scheduled' THEN RAISE EXCEPTION 'Evento encerrado ou cancelado: histórico imutável'; END IF;
 SELECT * INTO m FROM public.session_score_matches WHERE session_id=e.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inicie a partida pelo placar'; END IF;
 IF p_expected_revision IS DISTINCT FROM m.revision THEN RAISE EXCEPTION 'O placar foi atualizado em outra tela. Atualize antes de registrar'; END IF;
 IF m.status='complete' AND p_action NOT IN('undo','finish') THEN RAISE EXCEPTION 'A meta já foi atingida. Encerre ou desfaça o último lançamento'; END IF;
 before_:=m.state;n:=cardinality(m.players);scores:=app_private.score_ints(m.state->'scores',CASE WHEN m.game IN('truco','canastra') THEN 2 ELSE n END,-10000000,10000000);
 round_:=(m.state->>'round')::integer;envited:=(m.state->>'envite_recorded')::boolean;
 IF p_action='finish' THEN
  IF m.status<>'complete' OR cardinality(m.winner_ids)=0 THEN RAISE EXCEPTION 'Conclua o placar antes de encerrar'; END IF;
  UPDATE public.sessions SET status='finished' WHERE id=e.id;
 ELSIF p_action='undo' THEN
  SELECT * INTO previous FROM public.session_score_actions WHERE session_id=e.id AND action NOT IN('undo','finish') AND undone_at IS NULL ORDER BY revision DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Não há lançamento para desfazer'; END IF;
  UPDATE public.session_score_actions SET undone_at=clock_timestamp() WHERE id=previous.id;
  m.state:=previous.before_state;
  scores:=app_private.score_ints(m.state->'scores',cardinality(scores),-10000000,10000000);
 ELSIF m.game='truco' AND p_action IN('truco_hand','truco_envite') THEN
  side:=(app_private.score_ints(jsonb_build_array(p_payload->'side'),1,0,1))[1];
  IF p_action='truco_hand' THEN
   points:=(app_private.score_ints(jsonb_build_array(p_payload->'points'),1,1,12))[1];
   IF (m.variant='gauderio' AND points NOT IN(1,2,3,4)) OR (m.variant='paulista' AND points NOT IN(1,3,6,9,12)) OR (m.variant='mineiro' AND points NOT IN(2,4,6,10,12)) THEN RAISE EXCEPTION 'Valor da mão incompatível com a variante'; END IF;
   IF m.variant='paulista' AND 11=ANY(scores) AND points NOT IN(1,3) THEN RAISE EXCEPTION 'Confira a mão de onze'; END IF;
   IF m.variant='mineiro' AND 10=ANY(scores) AND points NOT IN(2,4) THEN RAISE EXCEPTION 'Confira a mão de dez'; END IF;
   scores[side+1]:=scores[side+1]+points;round_:=round_+1;envited:=false;
  ELSE
   IF m.variant<>'gauderio' OR envited THEN RAISE EXCEPTION 'Envite indisponível nesta variante ou já registrado nesta mão'; END IF;
   kind:=p_payload->>'kind';
   points:=CASE kind WHEN 'envido' THEN 2 WHEN 'real' THEN 3 WHEN 'envido_real' THEN 5 WHEN 'flor' THEN 3 WHEN 'contra_flor' THEN 6 WHEN 'envido_recusado' THEN 1 WHEN 'envido_envido' THEN 4 WHEN 'envido_envido_real' THEN 7 WHEN 'envite_conferido' THEN (app_private.score_ints(jsonb_build_array(p_payload->'points'),1,1,m.target))[1] WHEN 'falta' THEN m.target-greatest(scores[1],scores[2]) WHEN 'contra_flor_resto' THEN m.target-greatest(scores[1],scores[2]) ELSE NULL END;
   IF points IS NULL OR points<1 THEN RAISE EXCEPTION 'Envite inválido'; END IF;
   scores[side+1]:=scores[side+1]+points;envited:=true;
  END IF;
  m.state:=jsonb_build_object('scores',scores,'round',round_,'envite_recorded',envited);
 ELSIF m.game='canastra' AND p_action='canastra_round' THEN
  w:=(app_private.score_ints(jsonb_build_array(p_payload->'winner'),1,-1,1))[1];
  cards:=app_private.score_ints(p_payload->'cards',2,0,10000);hands:=app_private.score_ints(p_payload->'hands',2,0,10000);
  clean:=app_private.score_ints(p_payload->'clean',2,0,30);dirty:=app_private.score_ints(p_payload->'dirty',2,0,30);dead:=app_private.score_ints(p_payload->'dead',2,0,1);
  IF w>=0 AND (dead[w+1]=1 OR (CASE WHEN m.variant='buraco_fechado' THEN clean[w+1]+dirty[w+1] ELSE clean[w+1] END)<1) THEN RAISE EXCEPTION 'A batida exige morto pego e a canastra prevista na variante'; END IF;
  FOR i IN 1..2 LOOP scores[i]:=scores[i]+cards[i]+200*clean[i]+100*dirty[i]-hands[i]-100*dead[i]+CASE WHEN w=i-1 THEN 100 ELSE 0 END; END LOOP;
  m.state:=jsonb_build_object('scores',scores,'round',round_+1,'envite_recorded',false);
 ELSIF m.game IN('pontinho','uno','pife') AND p_action=m.game||'_round' THEN
  w:=(app_private.score_ints(jsonb_build_array(p_payload->'winner'),1,0,n-1))[1];
  IF m.game='pontinho' THEN
   losses:=app_private.score_ints(p_payload->'losses',n,0,500);
   IF scores[w+1]<=0 OR losses[w+1]<>0 THEN RAISE EXCEPTION 'O vencedor deve estar na disputa e não perde pontos'; END IF;
   FOR i IN 1..n LOOP
    IF scores[i]<=0 AND losses[i]<>0 THEN RAISE EXCEPTION 'Jogador eliminado não participa de nova rodada'; END IF;
    scores[i]:=scores[i]-losses[i];
   END LOOP;
  ELSIF m.game='uno' THEN
   losses:=app_private.score_ints(p_payload->'losses',n,0,10000);
   IF losses[w+1]<>0 THEN RAISE EXCEPTION 'O vencedor não pode ter cartas restantes'; END IF;
   scores[w+1]:=scores[w+1]+(SELECT sum(x)::integer FROM unnest(losses) x);
  ELSE scores[w+1]:=scores[w+1]+1;
  END IF;
  m.state:=jsonb_build_object('scores',scores,'round',round_+1,'envite_recorded',false);
 ELSE RAISE EXCEPTION 'Lançamento incompatível com a modalidade';
 END IF;
 IF m.game='pontinho' THEN
  finished_:=(SELECT count(*) FROM unnest(scores) x WHERE x>0)=1;
  IF finished_ THEN SELECT ARRAY[m.players[ordinality::integer]] INTO winner_ids_ FROM unnest(scores) WITH ORDINALITY t(score,ordinality) WHERE score>0; END IF;
 ELSE
  SELECT max(x) INTO best FROM unnest(scores) x;
  finished_:=best>=m.target AND (SELECT count(*) FROM unnest(scores) x WHERE x=best)=1;
  IF finished_ THEN
   SELECT ordinality::integer-1 INTO win_side FROM unnest(scores) WITH ORDINALITY t(score,ordinality) WHERE score=best;
   SELECT array_agg(m.players[idx.num]) INTO winner_ids_ FROM generate_subscripts(m.players,1) AS idx(num) WHERE m.teams[idx.num]=win_side;
  END IF;
 END IF;
 UPDATE public.session_score_matches SET state=m.state,revision=m.revision+1,status=CASE WHEN finished_ THEN 'complete' ELSE 'live' END,winner_ids=coalesce(winner_ids_,'{}'),completed_at=CASE WHEN finished_ THEN coalesce(m.completed_at,now()) ELSE NULL END WHERE session_id=e.id;
 INSERT INTO public.session_score_actions(id,session_id,actor_id,action,payload,before_state,after_state,revision) VALUES(p_request_id,e.id,a,p_action,p_payload,before_,m.state,m.revision+1);
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(a,p_request_id,'score_game_command',v_payload,p_request_id);
 RETURN p_request_id;
END; $$;
REVOKE ALL ON FUNCTION app_private.score_game_command(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.score_game_command(uuid,uuid,integer,text,jsonb) TO authenticated;
CREATE FUNCTION public.score_game_command(p_request_id uuid,p_event_id uuid,p_expected_revision integer,p_action text,p_payload jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.score_game_command(p_request_id,p_event_id,p_expected_revision,p_action,p_payload); $$;
REVOKE ALL ON FUNCTION public.score_game_command(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.score_game_command(uuid,uuid,integer,text,jsonb) TO authenticated;
