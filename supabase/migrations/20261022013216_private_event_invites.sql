-- Mesa Marcada: convites privados e acesso permitido apenas ao convidado aceito.
-- Eventos existentes continuam públicos. Tokens nunca são armazenados em claro.
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public','private'));

CREATE TABLE IF NOT EXISTS public.event_invite_tokens(
 session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.event_invite_members(
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 invited_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_invite_members_user ON public.event_invite_members(user_id,session_id);
ALTER TABLE public.event_invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invite_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_invite_tokens FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.event_invite_members FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.event_invite_members TO authenticated;
CREATE POLICY invited_read_own ON public.event_invite_members FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) OR app_private.is_app_admin()
   OR EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.organizer_id=(SELECT auth.uid())));

CREATE OR REPLACE FUNCTION app_private.may_view_event(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (
 app_private.is_app_admin() OR EXISTS(
  SELECT 1 FROM public.sessions s WHERE s.id=p_event
    AND NOT app_private.is_event_hidden(s.id)
    AND (s.visibility='public' OR s.organizer_id=(SELECT auth.uid())
      OR EXISTS(SELECT 1 FROM public.event_invite_members m
       WHERE m.session_id=s.id AND m.user_id=(SELECT auth.uid()))
    )
 )
 );
$$;
REVOKE ALL ON FUNCTION app_private.may_view_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.may_view_event(uuid) TO authenticated;
DROP POLICY IF EXISTS sessions_select_authenticated ON public.sessions;
CREATE POLICY sessions_select_authorized ON public.sessions
 FOR SELECT TO authenticated USING (app_private.may_view_event(id));
DROP POLICY IF EXISTS attendance_select_authenticated ON public.session_attendance;
CREATE POLICY attendance_select_authorized ON public.session_attendance
 FOR SELECT TO authenticated USING(app_private.may_view_event(session_id));
DROP POLICY IF EXISTS attendance_insert_self ON public.session_attendance;
CREATE POLICY attendance_insert_authorized ON public.session_attendance
 FOR INSERT TO authenticated WITH CHECK (
 user_id=(SELECT auth.uid()) AND app_private.may_view_event(session_id)
);
-- Leitura de assentos sempre depende de evento acessível, incluindo convidados.
DROP POLICY IF EXISTS seating_read_event ON public.session_table_seats;
CREATE POLICY seating_read_authorized ON public.session_table_seats
 FOR SELECT TO authenticated USING(app_private.may_view_event(session_id));

CREATE OR REPLACE FUNCTION public.create_event_invite(p_event_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor uuid:=(SELECT auth.uid());
 code text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=p_event_id
  AND s.status='scheduled' AND s.visibility='private'
  AND NOT app_private.is_event_hidden(s.id)
  AND (s.organizer_id=actor OR app_private.is_app_admin()))
 THEN RAISE EXCEPTION 'Somente o anfitrião pode criar convite para evento privado ativo'; END IF;
 code:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.event_invite_tokens(session_id,token_hash,created_by)
 VALUES(p_event_id,encode(extensions.digest(code,'sha256'),'hex'),actor)
 ON CONFLICT(session_id) DO UPDATE SET token_hash=excluded.token_hash,
    created_by=excluded.created_by,created_at=now();
 RETURN code;
END; $$;
REVOKE ALL ON FUNCTION public.create_event_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_event_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_event_invite(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor uuid:=(SELECT auth.uid());
 event_id uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para aceitar o convite'; END IF;
 IF p_token IS NULL OR length(p_token)<>64 OR p_token !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Convite inválido'; END IF;
 SELECT t.session_id INTO event_id FROM public.event_invite_tokens t
 JOIN public.sessions s ON s.id=t.session_id
 WHERE t.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 AND s.visibility='private' AND s.status='scheduled'
 AND NOT app_private.is_event_hidden(s.id);
 IF event_id IS NULL THEN RAISE EXCEPTION 'Convite expirado ou inválido'; END IF;
 INSERT INTO public.event_invite_members(session_id,user_id)
 VALUES(event_id,actor) ON CONFLICT DO NOTHING;
 RETURN event_id;
END; $$;
REVOKE ALL ON FUNCTION public.claim_event_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_event_invite(text) TO authenticated;

-- Bloqueio adicional em RPC que usa SECURITY DEFINER para reservar assentos.
CREATE OR REPLACE FUNCTION app_private.choose_table_seat(p_event_id uuid,p_seat_no integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 IF v_game NOT IN ('poker','blackjack') THEN RAISE EXCEPTION 'Tipo de mesa inválido'; END IF;
 -- Em novas mesas cabem no máximo 10 pessoas. Configurações antigas acima
 -- de 10 continuam acessíveis sem alterar quantidade de convidados.
 v_max:=LEAST(v_event.max_participants,10);
 IF (v_game='poker' AND (p_seat_no<1 OR p_seat_no>v_max))
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
END; $$;

-- Antes de participar, convidados autenticados devem conseguir visualizar
-- quais cadeiras já estão ocupadas, sem liberar dados financeiros privados.;
