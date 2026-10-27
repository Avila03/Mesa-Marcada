-- New point-based modalities share existing events and private attendance.
ALTER TABLE public.rooms DROP CONSTRAINT rooms_game_check;
ALTER TABLE public.rooms DROP CONSTRAINT rooms_canonical_name_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_game_check CHECK(game IN('poker','blackjack','truco','canastra','pontinho','uno','pife'));
ALTER TABLE public.rooms ADD CONSTRAINT rooms_canonical_name_check CHECK(name=CASE game WHEN 'poker' THEN 'Poker' WHEN 'blackjack' THEN 'Blackjack' WHEN 'truco' THEN 'Truco' WHEN 'canastra' THEN 'Canastra / Buraco' WHEN 'pontinho' THEN 'Pontinho' WHEN 'uno' THEN 'UNO' WHEN 'pife' THEN 'Pife' END);
ALTER TABLE public.profiles DROP CONSTRAINT profiles_favorite_game_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_favorite_game_check CHECK(favorite_game IN('poker','blackjack','truco','canastra','pontinho','uno','pife'));
INSERT INTO public.rooms(name,game,description,status,created_by)
SELECT v.name,v.game,v.description,'active',a.user_id FROM (VALUES
 ('Truco','truco','Gaudério, Paulista e Mineiro: uma mesa, variantes e tentos próprios.'),
 ('Canastra / Buraco','canastra','Canastra e Buraco: parcerias, canastras e pontuação por rodada.'),
 ('Pontinho','pontinho','Saldo individual, rodadas e controle de estouro.'),
 ('UNO','uno','Rodadas, pontos das cartas restantes e meta da partida.'),
 ('Pife','pife','Pif-paf sem curinga e registro de batidas.')) v(name,game,description)
CROSS JOIN LATERAL (SELECT user_id FROM public.app_admins ORDER BY user_id LIMIT 1) a
ON CONFLICT(game) DO NOTHING;
ALTER TABLE public.sessions ADD COLUMN game_variant text,ADD COLUMN score_target integer;
CREATE TABLE public.session_score_matches(
 session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
 game text NOT NULL,variant text NOT NULL,target integer NOT NULL CHECK(target>0),
 players uuid[] NOT NULL,teams integer[] NOT NULL,
 state jsonb NOT NULL,revision integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'live' CHECK(status IN('live','complete')),
 winner_ids uuid[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE TABLE public.session_score_actions(
 id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES public.session_score_matches(session_id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),action text NOT NULL,payload jsonb NOT NULL,
 before_state jsonb NOT NULL,after_state jsonb NOT NULL,revision integer NOT NULL,
 undone_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(session_id,revision)
);
CREATE INDEX score_actions_session_time ON public.session_score_actions(session_id,revision DESC);
CREATE INDEX score_actions_actor ON public.session_score_actions(actor_id);
ALTER TABLE public.session_score_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_score_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_score_matches,public.session_score_actions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_score_matches,public.session_score_actions TO authenticated;
CREATE POLICY score_matches_private_read ON public.session_score_matches FOR SELECT TO authenticated
 USING(app_private.can_view_session_private(session_id) AND app_private.may_view_event(session_id));
CREATE POLICY score_actions_private_read ON public.session_score_actions FOR SELECT TO authenticated
 USING(app_private.can_view_session_private(session_id) AND app_private.may_view_event(session_id));
CREATE FUNCTION app_private.guard_score_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g text;
BEGIN
 SELECT game INTO g FROM public.rooms WHERE id=NEW.room_id;
 IF g IN('poker','blackjack') THEN
  IF NEW.game_variant IS NOT NULL OR NEW.score_target IS NOT NULL THEN RAISE EXCEPTION 'Esta mesa utiliza fichas'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.game_variant IS DISTINCT FROM OLD.game_variant OR NEW.score_target IS DISTINCT FROM OLD.score_target) THEN
  RAISE EXCEPTION 'A variante e a meta são definidas na criação do evento';
 END IF;
 NEW.game_variant:=coalesce(NEW.game_variant,CASE g WHEN 'truco' THEN 'gauderio' WHEN 'canastra' THEN 'canastra' WHEN 'uno' THEN 'uno_classico' ELSE g END);
 IF (g='truco' AND NEW.game_variant NOT IN('gauderio','paulista','mineiro')) OR
 (g='canastra' AND NEW.game_variant NOT IN('canastra','buraco_aberto','buraco_fechado')) OR
 (g='pontinho' AND NEW.game_variant<>'pontinho') OR (g='uno' AND NEW.game_variant<>'uno_classico') OR (g='pife' AND NEW.game_variant<>'pife')
 THEN RAISE EXCEPTION 'Variante incompatível com a mesa'; END IF;
 NEW.score_target:=coalesce(NEW.score_target,CASE g WHEN 'truco' THEN CASE WHEN NEW.game_variant='gauderio' THEN 24 ELSE 12 END WHEN 'canastra' THEN 3000 WHEN 'pontinho' THEN 100 WHEN 'uno' THEN 500 ELSE 5 END);
 IF (g='truco' AND NEW.score_target<>CASE WHEN NEW.game_variant='gauderio' THEN 24 ELSE 12 END)
 OR (g='canastra' AND NEW.score_target NOT BETWEEN 100 AND 10000)
 OR (g='pontinho' AND NEW.score_target NOT BETWEEN 50 AND 500)
 OR (g='uno' AND NEW.score_target NOT BETWEEN 100 AND 2000)
 OR (g='pife' AND NEW.score_target NOT BETWEEN 1 AND 100)
 THEN RAISE EXCEPTION 'Meta inválida para esta modalidade'; END IF;
 IF (g='truco' AND (NEW.max_participants NOT IN(2,4,6) OR (NEW.game_variant<>'gauderio' AND NEW.max_participants=6)))
 OR (g='canastra' AND NEW.max_participants NOT IN(2,4))
 OR (g='pontinho' AND NEW.max_participants NOT BETWEEN 3 AND 8)
 OR (g='pife' AND NEW.max_participants NOT BETWEEN 2 AND 8)
 OR (g='uno' AND NEW.max_participants NOT BETWEEN 2 AND 10)
 THEN RAISE EXCEPTION 'Quantidade de lugares incompatível com a modalidade'; END IF;
 IF NEW.min_entry_brl<>0 OR NEW.chip_pricing_special THEN RAISE EXCEPTION 'Esta modalidade usa pontuação própria, sem entrada em fichas'; END IF;
 NEW.chip_settlement_brl:=false;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.guard_score_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_guard_score_event BEFORE INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION app_private.guard_score_event();
CREATE FUNCTION app_private.guard_score_roster() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event_id uuid;
BEGIN
 event_id:=CASE WHEN TG_OP='DELETE' THEN OLD.session_id ELSE NEW.session_id END;
 PERFORM 1 FROM public.sessions WHERE id=event_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.session_score_matches WHERE session_id=event_id) THEN RAISE EXCEPTION 'Os participantes ficam fixos após iniciar o placar'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
REVOKE ALL ON FUNCTION app_private.guard_score_roster() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER score_roster_frozen BEFORE INSERT OR UPDATE OR DELETE ON public.session_attendance FOR EACH ROW EXECUTE FUNCTION app_private.guard_score_roster();
CREATE FUNCTION app_private.guard_score_live_start() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id WHERE s.id=NEW.session_id AND r.game NOT IN('poker','blackjack'))
 AND NOT EXISTS(SELECT 1 FROM public.session_score_matches WHERE session_id=NEW.session_id)
 THEN RAISE EXCEPTION 'Confira os participantes e inicie pelo placar da modalidade'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.guard_score_live_start() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER score_live_start_guard BEFORE INSERT ON public.session_live_state FOR EACH ROW EXECUTE FUNCTION app_private.guard_score_live_start();
CREATE FUNCTION app_private.guard_chip_game_only() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id WHERE s.id=NEW.session_id AND r.game NOT IN('poker','blackjack'))
 THEN RAISE EXCEPTION 'Esta mesa possui placar próprio e não utiliza fichas'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION app_private.guard_chip_game_only() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['session_chip_purchases','session_chip_cashouts','session_chip_results','session_chip_final_items','session_chip_payouts','session_finance_approvals'] LOOP
  EXECUTE format('CREATE TRIGGER point_game_no_chips BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.guard_chip_game_only()',t);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.session_score_matches;
 END IF;
END; $$;
CREATE FUNCTION public.get_score_game(p_event_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('match',(SELECT to_jsonb(m) FROM public.session_score_matches m WHERE session_id=p_event_id),
 'actions',coalesce((SELECT jsonb_agg(a ORDER BY revision DESC) FROM (SELECT id,action,payload,revision,undone_at,created_at,actor_id FROM public.session_score_actions WHERE session_id=p_event_id ORDER BY revision DESC LIMIT 100) a),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.get_score_game(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_score_game(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.ensure_finance_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.rooms WHERE id=NEW.room_id AND game NOT IN('poker','blackjack')) THEN
  IF OLD.status='scheduled' AND NEW.status='finished' AND NOT EXISTS(SELECT 1 FROM public.session_score_matches WHERE session_id=NEW.id AND status='complete' AND cardinality(winner_ids)>0) THEN RAISE EXCEPTION 'Conclua o placar antes de encerrar o evento'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.status<>'scheduled' OR NEW.status<>'finished' THEN RETURN NEW; END IF;
 IF OLD.chip_settlement_brl THEN
  IF NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=NEW.id)
   THEN RAISE EXCEPTION 'Inicie o evento Ao vivo antes de encerrar'; END IF;
  IF NOT app_private.cashout_balanced(NEW.id)
   THEN RAISE EXCEPTION 'Valor final em reais divergente do total comprado'; END IF;
  -- Modo BRL: recebimentos e repasses são registros informativos, sem aceite manual.
  -- O fechamento exige apenas conciliação de valores; histórico anterior é mantido.
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id)
   THEN RAISE EXCEPTION 'É preciso ter ao menos um participante'; END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=NEW.id AND p.payment_status<>'paid')
   THEN RAISE EXCEPTION 'Existem pagamentos não confirmados'; END IF;
  IF EXISTS(
   SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id AND (
    NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=a.session_id AND p.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f WHERE f.session_id=a.session_id AND f.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_finance_approvals x WHERE x.session_id=a.session_id AND x.user_id=a.user_id)
   )
  ) THEN RAISE EXCEPTION 'Resultados e aprovações incompletos'; END IF;
  IF NOT OLD.chip_stock_legacy THEN
   IF NOT app_private.chip_final_balanced(NEW.id) THEN
    RAISE EXCEPTION 'A contagem final não coincide com as fichas em circulação'; END IF;
   IF EXISTS(
    SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id
    AND (SELECT COALESCE(sum(f.quantity*(CASE f.chip_value
     WHEN 1 THEN OLD.chip_price_1_brl WHEN 5 THEN OLD.chip_price_5_brl
     WHEN 10 THEN OLD.chip_price_10_brl WHEN 25 THEN OLD.chip_price_25_brl
     ELSE OLD.chip_price_50_brl END)),0)
     FROM public.session_chip_final_items f WHERE f.session_id=a.session_id AND f.user_id=a.user_id)>0
    AND NOT EXISTS(SELECT 1 FROM public.session_chip_payouts x
       WHERE x.session_id=a.session_id AND x.user_id=a.user_id)
   ) THEN RAISE EXCEPTION 'Confirme todos os repasses'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION app_private.choose_table_seat(p_event_id uuid, p_seat_no integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_event public.sessions%ROWTYPE;
 v_game text;
 v_max integer;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para escolher o assento'; END IF;
 -- Bloqueio da sessão serializa escolhas simultâneas de pessoas diferentes.
 SELECT * INTO v_event FROM public.sessions s WHERE s.id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.status<>'scheduled' OR app_private.is_event_hidden(p_event_id)
    OR NOT app_private.may_view_event(p_event_id)
 THEN RAISE EXCEPTION 'Evento não está disponível para escolher assentos'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=p_event_id)
 THEN RAISE EXCEPTION 'A distribuição das cadeiras fica travada após o início da partida'; END IF;
 IF p_seat_no IS NULL THEN
  -- Sair da cadeira cancela a participação antes do início (quando não há
  -- lançamentos financeiros). O FK das cadeiras usa ON DELETE CASCADE.
  DELETE FROM public.session_attendance
   WHERE session_id=p_event_id AND user_id=v_actor;
  RETURN true;
 END IF;
 SELECT r.game INTO v_game FROM public.rooms r WHERE r.id=v_event.room_id;
 IF v_game NOT IN ('poker','blackjack','truco','canastra','pontinho','uno','pife') THEN RAISE EXCEPTION 'Tipo de mesa inválido'; END IF;
 -- Em novas mesas cabem no máximo 10 pessoas. Configurações antigas acima
 -- de 10 continuam acessíveis sem alterar quantidade de convidados.
 v_max:=LEAST(v_event.max_participants,10);
 IF (v_game<>'blackjack' AND (p_seat_no<1 OR p_seat_no>v_max))
    OR (v_game='blackjack' AND (p_seat_no<0 OR p_seat_no>=v_max))
 THEN RAISE EXCEPTION 'Essa cadeira não existe nesta mesa'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_table_seats st
   WHERE st.session_id=p_event_id AND st.seat_no=p_seat_no AND st.user_id<>v_actor)
 THEN RAISE EXCEPTION 'Esta cadeira acaba de ser ocupada. Escolha outra'; END IF;
 -- A reserva e a confirmação são atômicas; se o evento estiver lotado,
 -- o gatilho de capacidade rejeita ambas sem criar presença órfã.
 INSERT INTO public.session_attendance(session_id,user_id)
 SELECT p_event_id,v_actor
 WHERE NOT EXISTS(SELECT 1 FROM public.session_attendance a
    WHERE a.session_id=p_event_id AND a.user_id=v_actor);
 INSERT INTO public.session_table_seats(session_id,user_id,seat_no)
 VALUES(p_event_id,v_actor,p_seat_no)
 ON CONFLICT(session_id,user_id) DO UPDATE
 SET seat_no=excluded.seat_no,chosen_at=now();
 RETURN true;
END; $function$
;
