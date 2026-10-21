-- Mesa Marcada v1.9: lugares reais por evento, com crupiê exclusivo no Blackjack.
-- Ocupações são opcionais no Poker, e o início do Blackjack exige crupiê.
-- Não altera nem apaga registros históricos.
CREATE TABLE public.session_table_seats(
 session_id uuid NOT NULL,
 user_id uuid NOT NULL,
 seat_no integer NOT NULL CHECK(seat_no BETWEEN 0 AND 10),
 chosen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,user_id),
 UNIQUE(session_id,seat_no),
 FOREIGN KEY(session_id,user_id) REFERENCES public.session_attendance(session_id,user_id) ON DELETE CASCADE
);
CREATE INDEX idx_session_table_seats_session ON public.session_table_seats(session_id);
ALTER TABLE public.session_table_seats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_table_seats FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_table_seats TO authenticated;
CREATE POLICY seating_read_confirmed ON public.session_table_seats
 FOR SELECT TO authenticated USING(app_private.can_view_session_private(session_id));

CREATE FUNCTION app_private.choose_table_seat(p_event_id uuid,p_seat_no integer)
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
 THEN RAISE EXCEPTION 'Evento não está disponível para escolher assentos'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=p_event_id)
 THEN RAISE EXCEPTION 'A distribuição das cadeiras fica travada após o início da partida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_attendance a
    WHERE a.session_id=p_event_id AND a.user_id=v_actor)
 THEN RAISE EXCEPTION 'Confirme sua presença antes de sentar à mesa'; END IF;
 IF p_seat_no IS NULL THEN
  DELETE FROM public.session_table_seats WHERE session_id=p_event_id AND user_id=v_actor;
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
 INSERT INTO public.session_table_seats(session_id,user_id,seat_no)
 VALUES(p_event_id,v_actor,p_seat_no)
 ON CONFLICT(session_id,user_id) DO UPDATE
 SET seat_no=excluded.seat_no,chosen_at=now();
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION app_private.choose_table_seat(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.choose_table_seat(uuid,integer) TO authenticated;
CREATE FUNCTION public.choose_table_seat(p_event_id uuid,p_seat_no integer)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.choose_table_seat(p_event_id,p_seat_no);
$$;
REVOKE ALL ON FUNCTION public.choose_table_seat(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.choose_table_seat(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.start_live_event(p_event_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event public.sessions%ROWTYPE;
        v_started timestamptz;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Faça login para iniciar o evento';
  END IF;
  SELECT * INTO v_event FROM public.sessions s
  WHERE s.id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
  IF v_event.organizer_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Somente o Anfitrião pode iniciar o Evento ao Vivo';
  END IF;
  IF v_event.status<>'scheduled'
     OR app_private.is_event_hidden(p_event_id) THEN
    RAISE EXCEPTION 'Somente eventos agendados e visíveis podem começar';
  END IF;
  IF EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=p_event_id) THEN
    RAISE EXCEPTION 'Este Evento ao Vivo já foi iniciado';
  END IF;

  -- No Blackjack há sempre uma cadeira exclusiva do crupiê.
  -- A partida não inicia sem um participante confirmado ocupando-a.
  IF EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=v_event.room_id AND r.game='blackjack')
     AND NOT EXISTS(
       SELECT 1 FROM public.session_table_seats st
       WHERE st.session_id=p_event_id AND st.seat_no=0
     ) THEN
    RAISE EXCEPTION 'Escolha o crupiê na aba Assentos antes de iniciar o Blackjack';
  END IF;

  INSERT INTO public.session_live_state(session_id,started_by)
  VALUES(p_event_id,(SELECT auth.uid()))
  RETURNING started_at INTO v_started;

  PERFORM app_private.write_live_activity(
    p_event_id,'started',(SELECT auth.uid()),NULL
  );
  RETURN v_started;
END;
$$;

