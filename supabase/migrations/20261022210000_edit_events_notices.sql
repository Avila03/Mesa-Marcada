-- Mesa Marcada: edição segura de eventos e avisos aos participantes.
-- A identidade da mesa, do anfitrião e da Liga permanece imutável.

CREATE TABLE IF NOT EXISTS public.event_change_notices(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 changed_fields text[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_event_change_notices_recipient
 ON public.event_change_notices(recipient_id,created_at DESC);
ALTER TABLE public.event_change_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_change_notices FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(read_at) ON TABLE public.event_change_notices TO authenticated;
CREATE POLICY event_change_notices_select_own ON public.event_change_notices
 FOR SELECT TO authenticated USING(recipient_id=(SELECT auth.uid()));
CREATE POLICY event_change_notices_mark_read ON public.event_change_notices
 FOR UPDATE TO authenticated USING(recipient_id=(SELECT auth.uid()))
 WITH CHECK(recipient_id=(SELECT auth.uid()));

-- Restores controlled date changes while retaining all existing protections.
CREATE OR REPLACE FUNCTION public.protect_session_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
 v_count integer;
 v_safe_admin_restore boolean:=false;
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.room_id IS DISTINCT FROM OLD.room_id
 OR NEW.organizer_id IS DISTINCT FROM OLD.organizer_id
 OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Identidade da sessão não pode ser modificada';
 END IF;
 IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
  IF OLD.status<>'scheduled' OR EXISTS(
   SELECT 1 FROM public.session_live_state ls WHERE ls.session_id=OLD.id
  ) THEN
   RAISE EXCEPTION 'Não é possível mudar a data depois do início da partida';
  END IF;
  IF NOT (OLD.organizer_id=(SELECT auth.uid()) OR app_private.is_app_admin()) THEN
   RAISE EXCEPTION 'Somente o anfitrião pode alterar data ou horário';
  END IF;
  IF NEW.starts_at<=now() THEN
   RAISE EXCEPTION 'Escolha uma nova data e horário no futuro';
  END IF;
 END IF;
 IF OLD.status<>'scheduled' AND NEW IS DISTINCT FROM OLD THEN
  v_safe_admin_restore:=
   OLD.status='cancelled' AND NEW.status='scheduled'
   AND app_private.is_app_admin()
   AND EXISTS(SELECT 1 FROM public.admin_hidden_events h
     WHERE h.session_id=OLD.id AND h.previous_status='scheduled');
  IF NOT v_safe_admin_restore THEN
   RAISE EXCEPTION 'Sessão finalizada/cancelada é imutável';
  END IF;
 END IF;
 SELECT count(*) INTO v_count FROM public.session_attendance a WHERE a.session_id=NEW.id;
 IF NEW.max_participants<v_count THEN
  RAISE EXCEPTION 'Limite menor que confirmações existentes';
 END IF;
 RETURN NEW;
END; $$;

-- Additional check for other editable fields, including started and archived events.
CREATE OR REPLACE FUNCTION app_private.guard_event_details_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_game text; v_seat_max integer; v_buys boolean;
BEGIN
 IF NEW.title IS NOT DISTINCT FROM OLD.title
  AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at
  AND NEW.location IS NOT DISTINCT FROM OLD.location
  AND NEW.min_entry_brl IS NOT DISTINCT FROM OLD.min_entry_brl
  AND NEW.max_participants IS NOT DISTINCT FROM OLD.max_participants
  AND NEW.chip_pricing_special IS NOT DISTINCT FROM OLD.chip_pricing_special
  AND NEW.chip_price_1_brl IS NOT DISTINCT FROM OLD.chip_price_1_brl
  AND NEW.chip_price_5_brl IS NOT DISTINCT FROM OLD.chip_price_5_brl
  AND NEW.chip_price_10_brl IS NOT DISTINCT FROM OLD.chip_price_10_brl
  AND NEW.chip_price_25_brl IS NOT DISTINCT FROM OLD.chip_price_25_brl
  AND NEW.chip_price_50_brl IS NOT DISTINCT FROM OLD.chip_price_50_brl
 THEN RETURN NEW; END IF;

 IF OLD.status<>'scheduled' OR EXISTS(
  SELECT 1 FROM public.session_live_state st WHERE st.session_id=OLD.id
 ) THEN RAISE EXCEPTION 'A edição de dados é permitida apenas antes do início da partida'; END IF;
 IF OLD.league_id IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.leagues l WHERE l.id=OLD.league_id AND l.finished_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Uma Liga finalizada não aceita alterações'; END IF;
 IF length(trim(coalesce(NEW.title,''))) NOT BETWEEN 2 AND 100 THEN
  RAISE EXCEPTION 'Nome deve conter de 2 a 100 caracteres'; END IF;
 IF length(trim(coalesce(NEW.location,''))) NOT BETWEEN 2 AND 200 THEN
  RAISE EXCEPTION 'Local deve conter de 2 a 200 caracteres'; END IF;
 IF NEW.min_entry_brl<0 OR NEW.max_participants NOT BETWEEN 2 AND 10 THEN
  RAISE EXCEPTION 'Entrada ou número de vagas inválido'; END IF;
 SELECT r.game INTO v_game FROM public.rooms r WHERE r.id=OLD.room_id;
 IF v_game='blackjack' AND NEW.max_participants>6 THEN
  RAISE EXCEPTION 'A mesa de Blackjack comporta no máximo 6 participantes'; END IF;
 SELECT max(seat_no) INTO v_seat_max FROM public.session_table_seats
 WHERE session_id=OLD.id AND seat_no>0;
 IF coalesce(v_seat_max,0)>NEW.max_participants THEN
  RAISE EXCEPTION 'As vagas não podem excluir uma cadeira já reservada'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.session_chip_purchases b WHERE b.session_id=OLD.id)
 INTO v_buys;
 IF v_buys AND NEW.min_entry_brl IS DISTINCT FROM OLD.min_entry_brl THEN
  RAISE EXCEPTION 'A entrada mínima não pode mudar após uma compra'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_event_details_update ON public.sessions;
CREATE TRIGGER trg_guard_event_details_update
 BEFORE UPDATE ON public.sessions FOR EACH ROW
 EXECUTE FUNCTION app_private.guard_event_details_update();

CREATE OR REPLACE FUNCTION app_private.notify_event_details_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fields text[]:=ARRAY[]::text[];
BEGIN
 IF NEW.title IS DISTINCT FROM OLD.title THEN fields:=array_append(fields,'nome'); END IF;
 IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN fields:=array_append(fields,'data/horário'); END IF;
 IF NEW.location IS DISTINCT FROM OLD.location THEN fields:=array_append(fields,'local'); END IF;
 IF NEW.min_entry_brl IS DISTINCT FROM OLD.min_entry_brl THEN fields:=array_append(fields,'entrada'); END IF;
 IF NEW.max_participants IS DISTINCT FROM OLD.max_participants THEN fields:=array_append(fields,'vagas'); END IF;
 IF NEW.chip_pricing_special IS DISTINCT FROM OLD.chip_pricing_special OR
  NEW.chip_price_1_brl IS DISTINCT FROM OLD.chip_price_1_brl OR
  NEW.chip_price_5_brl IS DISTINCT FROM OLD.chip_price_5_brl OR
  NEW.chip_price_10_brl IS DISTINCT FROM OLD.chip_price_10_brl OR
  NEW.chip_price_25_brl IS DISTINCT FROM OLD.chip_price_25_brl OR
  NEW.chip_price_50_brl IS DISTINCT FROM OLD.chip_price_50_brl
 THEN fields:=array_append(fields,'fichas'); END IF;
 IF cardinality(fields)=0 THEN RETURN NEW; END IF;
 INSERT INTO public.event_change_notices(event_id,recipient_id,changed_fields)
 SELECT NEW.id,rec.user_id,fields FROM (
  SELECT a.user_id FROM public.session_attendance a WHERE a.session_id=NEW.id
  UNION SELECT i.user_id FROM public.event_invite_members i WHERE i.session_id=NEW.id
  UNION SELECT m.user_id FROM public.league_members m WHERE m.league_id=NEW.league_id
 ) rec
 WHERE rec.user_id<>NEW.organizer_id
 LIMIT 500;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_event_details_change ON public.sessions;
CREATE TRIGGER trg_notify_event_details_change
 AFTER UPDATE ON public.sessions FOR EACH ROW
 EXECUTE FUNCTION app_private.notify_event_details_change();

-- Explicit audited-looking, column-limited API. Even admins can edit only before start.
CREATE OR REPLACE FUNCTION public.edit_event_details(
 p_event_id uuid,p_title text,p_starts_at timestamptz,p_location text,
 p_min_entry_brl numeric,p_max_participants integer,p_chip_pricing_special boolean,
 p_chip_price_1_brl numeric,p_chip_price_5_brl numeric,
 p_chip_price_10_brl numeric,p_chip_price_25_brl numeric,p_chip_price_50_brl numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ev public.sessions%ROWTYPE;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login para editar o evento'; END IF;
 SELECT * INTO ev FROM public.sessions s WHERE s.id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
 IF ev.organizer_id<>(SELECT auth.uid()) AND NOT app_private.is_app_admin() THEN
  RAISE EXCEPTION 'Somente o anfitrião pode editar o evento'; END IF;
 IF ev.status<>'scheduled' OR EXISTS(
  SELECT 1 FROM public.session_live_state ls WHERE ls.session_id=ev.id
 ) THEN RAISE EXCEPTION 'A partida já começou ou foi encerrada'; END IF;
 IF p_starts_at IS NULL OR p_title IS NULL OR p_location IS NULL OR
  p_min_entry_brl IS NULL OR p_max_participants IS NULL OR p_chip_pricing_special IS NULL OR
  p_chip_price_1_brl IS NULL OR p_chip_price_5_brl IS NULL OR p_chip_price_10_brl IS NULL OR
  p_chip_price_25_brl IS NULL OR p_chip_price_50_brl IS NULL
 THEN RAISE EXCEPTION 'Preencha todos os campos obrigatórios'; END IF;
 IF p_min_entry_brl>1000000 OR p_min_entry_brl<0 THEN
  RAISE EXCEPTION 'Valor de entrada inválido'; END IF;
 IF p_chip_price_1_brl<=0 OR p_chip_price_5_brl<=0 OR p_chip_price_10_brl<=0 OR
  p_chip_price_25_brl<=0 OR p_chip_price_50_brl<=0 OR
  greatest(p_chip_price_1_brl,p_chip_price_5_brl,p_chip_price_10_brl,p_chip_price_25_brl,p_chip_price_50_brl)>1000
 THEN RAISE EXCEPTION 'Cada preço de ficha deve ser maior que zero e até R$ 1.000'; END IF;
 UPDATE public.sessions SET
  title=trim(p_title),starts_at=p_starts_at,location=trim(p_location),
  min_entry_brl=p_min_entry_brl,max_participants=p_max_participants,
  chip_pricing_special=p_chip_pricing_special,
  chip_price_1_brl=p_chip_price_1_brl,chip_price_5_brl=p_chip_price_5_brl,
  chip_price_10_brl=p_chip_price_10_brl,chip_price_25_brl=p_chip_price_25_brl,
  chip_price_50_brl=p_chip_price_50_brl
 WHERE id=p_event_id;
END; $$;
REVOKE ALL ON FUNCTION public.edit_event_details(uuid,text,timestamptz,text,numeric,integer,boolean,numeric,numeric,numeric,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_event_details(uuid,text,timestamptz,text,numeric,integer,boolean,numeric,numeric,numeric,numeric,numeric) TO authenticated;
