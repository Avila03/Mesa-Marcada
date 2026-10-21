-- Mesa Marcada v2.2: sentar confirma presença automaticamente.
-- Mantém eventos, confirmações existentes e regras de capacidade.
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
-- quais cadeiras já estão ocupadas, sem liberar dados financeiros privados.
DROP POLICY IF EXISTS seating_read_confirmed ON public.session_table_seats;
CREATE POLICY seating_read_event ON public.session_table_seats
 FOR SELECT TO authenticated USING (
  (SELECT auth.uid()) IS NOT NULL
  AND EXISTS(SELECT 1 FROM public.sessions s
    WHERE s.id=session_id AND NOT app_private.is_event_hidden(s.id))
 );
