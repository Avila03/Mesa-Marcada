-- v7.6 · Lista de espera
-- Evento lotado: quem quer jogar entra na fila. Quando uma cadeira abre antes
-- do início (alguém sai ou o anfitrião aumenta a mesa), o primeiro da fila é
-- confirmado automaticamente na cadeira livre, recebe um aviso na central e um
-- push único. Depois do início da partida as cadeiras ficam travadas e a fila
-- deixa de andar.

CREATE TABLE IF NOT EXISTS public.session_waitlist(
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,user_id)
);
CREATE INDEX IF NOT EXISTS session_waitlist_queue_idx ON public.session_waitlist(session_id,joined_at,user_id);
CREATE INDEX IF NOT EXISTS session_waitlist_user_idx ON public.session_waitlist(user_id);
ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_waitlist FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_waitlist TO authenticated;
-- Quem enxerga o evento enxerga a fila (nomes já são públicos na mesa).
-- Entrar e sair só pelas funções abaixo.
CREATE POLICY session_waitlist_read ON public.session_waitlist
 FOR SELECT TO authenticated USING(app_private.may_view_event(session_id));

CREATE TABLE IF NOT EXISTS app_private.waitlist_push_queue(
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 queued_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 PRIMARY KEY(session_id,user_id)
);
CREATE INDEX IF NOT EXISTS waitlist_push_pending_idx ON app_private.waitlist_push_queue(session_id) WHERE sent_at IS NULL;
ALTER TABLE app_private.waitlist_push_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.waitlist_push_queue FROM PUBLIC,anon,authenticated;

-- Cadeiras disponíveis seguem a mesma regra de choose_table_seat:
-- até 10 cadeiras; Blackjack numera de 0 (crupiê) a max-1, os demais de 1 a max.
CREATE OR REPLACE FUNCTION app_private.waitlist_free_seat(p_event_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT n FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
 CROSS JOIN LATERAL generate_series(
   CASE WHEN r.game='blackjack' THEN 0 ELSE 1 END,
   CASE WHEN r.game='blackjack' THEN LEAST(s.max_participants,10)-1 ELSE LEAST(s.max_participants,10) END) n
 WHERE s.id=p_event_id
   AND NOT EXISTS(SELECT 1 FROM public.session_table_seats st WHERE st.session_id=s.id AND st.seat_no=n)
 -- O crupiê só é entregue a quem vem da fila quando é a última cadeira livre.
 ORDER BY (n=0),n LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.waitlist_free_seat(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.promote_waitlist(p_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_event public.sessions%ROWTYPE;
 v_next uuid;
 v_seat integer;
 v_count integer;
 v_promoted integer:=0;
BEGIN
 SELECT * INTO v_event FROM public.sessions s WHERE s.id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.status<>'scheduled' OR app_private.is_event_hidden(p_event_id)
    OR EXISTS(SELECT 1 FROM public.session_live_state l WHERE l.session_id=p_event_id)
 THEN RETURN 0; END IF;
 LOOP
  SELECT count(*) INTO v_count FROM public.session_attendance a WHERE a.session_id=p_event_id;
  EXIT WHEN v_count>=LEAST(v_event.max_participants,10);
  v_seat:=app_private.waitlist_free_seat(p_event_id);
  EXIT WHEN v_seat IS NULL;
  SELECT w.user_id INTO v_next FROM public.session_waitlist w
   WHERE w.session_id=p_event_id ORDER BY w.joined_at,w.user_id LIMIT 1 FOR UPDATE;
  EXIT WHEN v_next IS NULL;
  DELETE FROM public.session_waitlist WHERE session_id=p_event_id AND user_id=v_next;
  IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=p_event_id AND a.user_id=v_next) THEN
   INSERT INTO public.session_attendance(session_id,user_id) VALUES(p_event_id,v_next);
   INSERT INTO public.session_table_seats(session_id,user_id,seat_no) VALUES(p_event_id,v_next,v_seat);
   INSERT INTO public.event_change_notices(event_id,recipient_id,changed_fields)
    VALUES(p_event_id,v_next,ARRAY['vaga da lista de espera']);
   INSERT INTO app_private.waitlist_push_queue(session_id,user_id) VALUES(p_event_id,v_next)
    ON CONFLICT(session_id,user_id) DO UPDATE SET queued_at=now(),sent_at=NULL;
   v_promoted:=v_promoted+1;
  END IF;
 END LOOP;
 RETURN v_promoted;
END; $$;
REVOKE ALL ON FUNCTION app_private.promote_waitlist(uuid) FROM PUBLIC,anon,authenticated;

-- Alguém saiu do evento: a fila anda. (Os gatilhos de FK em cascata rodam
-- antes deste, então a cadeira de quem saiu já está livre.)
CREATE OR REPLACE FUNCTION app_private.waitlist_after_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.session_waitlist w WHERE w.session_id=OLD.session_id) THEN
  PERFORM app_private.promote_waitlist(OLD.session_id);
 END IF;
 RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_waitlist_after_leave ON public.session_attendance;
CREATE TRIGGER trg_waitlist_after_leave AFTER DELETE ON public.session_attendance
 FOR EACH ROW EXECUTE FUNCTION app_private.waitlist_after_leave();

-- Quem entrou por conta própria (cadeira livre) sai da fila.
CREATE OR REPLACE FUNCTION app_private.waitlist_after_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.session_waitlist WHERE session_id=NEW.session_id AND user_id=NEW.user_id;
 RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_waitlist_after_join ON public.session_attendance;
CREATE TRIGGER trg_waitlist_after_join AFTER INSERT ON public.session_attendance
 FOR EACH ROW EXECUTE FUNCTION app_private.waitlist_after_join();

-- Anfitrião aumentou a mesa: novas cadeiras vão para a fila.
CREATE OR REPLACE FUNCTION app_private.waitlist_after_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.max_participants>OLD.max_participants AND NEW.status='scheduled' THEN
  PERFORM app_private.promote_waitlist(NEW.id);
 END IF;
 RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_waitlist_after_capacity ON public.sessions;
CREATE TRIGGER trg_waitlist_after_capacity AFTER UPDATE OF max_participants ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION app_private.waitlist_after_capacity();

CREATE OR REPLACE FUNCTION public.join_event_waitlist(p_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_event public.sessions%ROWTYPE;
 v_position integer;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para entrar na lista de espera'; END IF;
 SELECT * INTO v_event FROM public.sessions s WHERE s.id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.status<>'scheduled' OR app_private.is_event_hidden(p_event_id)
    OR NOT app_private.may_view_event(p_event_id)
 THEN RAISE EXCEPTION 'Evento não está disponível'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_live_state l WHERE l.session_id=p_event_id)
 THEN RAISE EXCEPTION 'A partida já começou: a lista de espera está fechada'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=p_event_id AND a.user_id=v_actor)
 THEN RAISE EXCEPTION 'Você já está confirmado neste evento'; END IF;
 IF app_private.waitlist_free_seat(p_event_id) IS NOT NULL
    AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=p_event_id)<LEAST(v_event.max_participants,10)
 THEN RAISE EXCEPTION 'Ainda há cadeira livre. Escolha seu assento na mesa'; END IF;
 IF (SELECT count(*) FROM public.session_waitlist w WHERE w.session_id=p_event_id)>=50
    AND NOT EXISTS(SELECT 1 FROM public.session_waitlist w WHERE w.session_id=p_event_id AND w.user_id=v_actor)
 THEN RAISE EXCEPTION 'A lista de espera deste evento está cheia'; END IF;
 INSERT INTO public.session_waitlist(session_id,user_id) VALUES(p_event_id,v_actor)
 ON CONFLICT DO NOTHING;
 SELECT count(*) INTO v_position FROM public.session_waitlist w
  WHERE w.session_id=p_event_id AND (w.joined_at,w.user_id)<=(
   SELECT x.joined_at,x.user_id FROM public.session_waitlist x WHERE x.session_id=p_event_id AND x.user_id=v_actor);
 RETURN v_position;
END; $$;
REVOKE ALL ON FUNCTION public.join_event_waitlist(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_event_waitlist(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_event_waitlist(p_event_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
 DELETE FROM public.session_waitlist WHERE session_id=p_event_id AND user_id=v_actor;
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.leave_event_waitlist(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leave_event_waitlist(uuid) TO authenticated;

-- Push "Abriu uma vaga": entregue pelo backend com o segredo do servidor, uma
-- vez por promoção. Com evento informado, qualquer pessoa que enxerga o evento
-- pode acelerar a entrega logo após sair; sem evento (agendador periódico),
-- drena a fila inteira.
CREATE OR REPLACE FUNCTION public.claim_waitlist_push_targets(p_event_id uuid,p_server_secret text)
RETURNS TABLE(endpoint text,p256dh text,auth_key text,session_id uuid,title text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_server_secret IS NULL OR length(p_server_secret)<40 OR NOT EXISTS(
  SELECT 1 FROM app_private.push_server_auth k
  WHERE k.secret_hash=encode(extensions.digest(p_server_secret,'sha256'),'hex'))
 THEN RAISE EXCEPTION 'Entrega não autorizada'; END IF;
 IF p_event_id IS NOT NULL AND ((SELECT auth.uid()) IS NULL OR NOT app_private.may_view_event(p_event_id))
 THEN RAISE EXCEPTION 'Evento não disponível'; END IF;
 RETURN QUERY
 WITH fresh AS(
  UPDATE app_private.waitlist_push_queue q SET sent_at=now()
  WHERE q.sent_at IS NULL AND (p_event_id IS NULL OR q.session_id=p_event_id)
    AND q.queued_at>now()-interval '1 day'
    AND EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=q.session_id AND a.user_id=q.user_id)
  RETURNING q.session_id AS sid,q.user_id AS uid
 )
 SELECT p.endpoint,p.p256dh,p.auth_key,s.id,s.title
 FROM fresh f JOIN public.sessions s ON s.id=f.sid AND s.status='scheduled'
 JOIN public.push_subscriptions p ON p.user_id=f.uid
 LIMIT 500;
END; $$;
REVOKE ALL ON FUNCTION public.claim_waitlist_push_targets(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_push_targets(uuid,text) TO anon,authenticated;

DO $$BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='session_waitlist')
 THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_waitlist; END IF;
END$$;
