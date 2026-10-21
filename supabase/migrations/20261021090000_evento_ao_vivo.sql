-- Mesa Marcada — Evento ao Vivo v1.7.
-- Evento ao Vivo inicia SOMENTE por ação manual do Anfitrião.
-- Linha do tempo privada: presença confirmada, Anfitrião ou Administrador.
-- O encerramento depende APENAS de fichas, revisões e pagamentos de fichas,
-- não de despesas e rachas voluntários.
-- Compatibilidade: eventos existentes não exigem iniciar o modo ao vivo para
-- encerrar; novos eventos exigem. Nenhum evento pré-existente é iniciado.

ALTER TABLE public.sessions
  ADD COLUMN live_start_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.sessions ALTER COLUMN live_start_required SET DEFAULT true;

-- Bloqueia atalhos: Anfitrião não pode desligar a obrigação de iniciar
-- antes do encerramento alterando a coluna diretamente pelo PostgREST.
CREATE FUNCTION app_private.protect_event_live_required()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  IF NEW.live_start_required IS DISTINCT FROM OLD.live_start_required THEN
    RAISE EXCEPTION 'A regra do modo ao vivo não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_event_live_required
BEFORE UPDATE ON public.sessions FOR EACH ROW
EXECUTE FUNCTION app_private.protect_event_live_required();
REVOKE ALL ON FUNCTION app_private.protect_event_live_required() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.session_live_state (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid NOT NULL REFERENCES public.profiles(id)
);
ALTER TABLE public.session_live_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_live_state FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_live_state TO authenticated;
CREATE POLICY live_state_view_private
ON public.session_live_state FOR SELECT TO authenticated
USING (app_private.can_view_session_private(session_id));

CREATE TABLE public.session_live_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN (
    'started','attendance_confirmed','attendance_cancelled',
    'chips_purchased','chips_purchase_removed','payment_received','payment_reopened',
    'final_chips_recorded','review_approved','review_reopened',
    'finished','cancelled'
  )),
  actor_id uuid REFERENCES public.profiles(id),
  subject_id uuid REFERENCES public.profiles(id),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX live_activity_by_event_time
 ON public.session_live_activity(session_id,occurred_at DESC,id DESC);
ALTER TABLE public.session_live_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_live_activity FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_live_activity TO authenticated;
CREATE POLICY live_activity_view_private
ON public.session_live_activity FOR SELECT TO authenticated
USING (app_private.can_view_session_private(session_id));

-- Função interna: triggers gravam fatos reais do servidor, não relatos
-- arbitrários enviados por usuários (nenhum INSERT cliente permitido).
CREATE FUNCTION app_private.write_live_activity(
  p_session uuid,p_kind text,p_actor uuid,p_subject uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.session_live_state l WHERE l.session_id=p_session) THEN
    INSERT INTO public.session_live_activity(session_id,kind,actor_id,subject_id)
    VALUES(p_session,p_kind,p_actor,p_subject);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION app_private.write_live_activity(uuid,text,uuid,uuid)
  FROM PUBLIC,anon,authenticated;

-- Início transacional: único responsável é o próprio Anfitrião.
CREATE FUNCTION app_private.start_live_event(p_event_id uuid)
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

  INSERT INTO public.session_live_state(session_id,started_by)
  VALUES(p_event_id,(SELECT auth.uid()))
  RETURNING started_at INTO v_started;

  PERFORM app_private.write_live_activity(
    p_event_id,'started',(SELECT auth.uid()),NULL
  );
  RETURN v_started;
END;
$$;
REVOKE ALL ON FUNCTION app_private.start_live_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.start_live_event(uuid) TO authenticated;
CREATE FUNCTION public.start_live_event(p_event_id uuid)
RETURNS timestamptz LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT app_private.start_live_event(p_event_id); $$;
REVOKE ALL ON FUNCTION public.start_live_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_live_event(uuid) TO authenticated;

CREATE FUNCTION app_private.require_live_start_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF OLD.status='scheduled' AND NEW.status='finished'
    AND OLD.live_start_required AND NOT EXISTS (
      SELECT 1 FROM public.session_live_state l WHERE l.session_id=OLD.id
    ) THEN
    RAISE EXCEPTION 'Inicie o Evento ao Vivo antes de encerrá-lo';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER require_live_start_before_finish
BEFORE UPDATE OF status ON public.sessions
FOR EACH ROW EXECUTE FUNCTION app_private.require_live_start_before_finish();
REVOKE ALL ON FUNCTION app_private.require_live_start_before_finish() FROM PUBLIC,anon,authenticated;

-- Timeline produzida por operações confirmadas no banco.
CREATE FUNCTION app_private.track_live_table_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_session uuid;v_subject uuid;v_kind text;v_actor uuid;
BEGIN
  IF TG_TABLE_NAME='session_attendance' THEN
    v_session:=COALESCE(NEW.session_id,OLD.session_id);
    v_subject:=COALESCE(NEW.user_id,OLD.user_id);
    v_kind:=CASE WHEN TG_OP='INSERT' THEN 'attendance_confirmed' ELSE 'attendance_cancelled' END;
  ELSIF TG_TABLE_NAME='session_chip_purchases' THEN
    v_session:=COALESCE(NEW.session_id,OLD.session_id);
    v_subject:=COALESCE(NEW.user_id,OLD.user_id);
    IF TG_OP='INSERT' THEN v_kind:='chips_purchased';
    ELSIF TG_OP='DELETE' THEN v_kind:='chips_purchase_removed';
    ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      v_kind:=CASE WHEN NEW.payment_status='paid' THEN 'payment_received' ELSE 'payment_reopened' END;
    ELSE RETURN NULL;
    END IF;
  ELSIF TG_TABLE_NAME='session_chip_results' THEN
    v_session:=NEW.session_id;
    v_subject:=NEW.user_id;
    IF TG_OP='UPDATE' AND NEW.chips_final IS NOT DISTINCT FROM OLD.chips_final
      THEN RETURN NULL; END IF;
    v_kind:='final_chips_recorded';
  ELSIF TG_TABLE_NAME='session_finance_approvals' THEN
    v_session:=COALESCE(NEW.session_id,OLD.session_id);
    v_subject:=COALESCE(NEW.user_id,OLD.user_id);
    v_kind:=CASE WHEN TG_OP='INSERT' THEN 'review_approved' ELSE 'review_reopened' END;
  ELSIF TG_TABLE_NAME='sessions' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
    v_session:=NEW.id;
    v_subject:=NULL;
    IF NEW.status='finished' THEN v_kind:='finished';
    ELSIF NEW.status='cancelled' THEN v_kind:='cancelled';
    ELSE RETURN NULL;
    END IF;
  ELSE
    RETURN NULL;
  END IF;
  v_actor:=auth.uid();
  PERFORM app_private.write_live_activity(v_session,v_kind,v_actor,v_subject);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION app_private.track_live_table_change() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER live_log_attendance
 AFTER INSERT OR DELETE ON public.session_attendance
 FOR EACH ROW EXECUTE FUNCTION app_private.track_live_table_change();
CREATE TRIGGER live_log_purchases
 AFTER INSERT OR UPDATE OR DELETE ON public.session_chip_purchases
 FOR EACH ROW EXECUTE FUNCTION app_private.track_live_table_change();
CREATE TRIGGER live_log_results
 AFTER INSERT OR UPDATE ON public.session_chip_results
 FOR EACH ROW EXECUTE FUNCTION app_private.track_live_table_change();
CREATE TRIGGER live_log_review
 AFTER INSERT OR DELETE ON public.session_finance_approvals
 FOR EACH ROW EXECUTE FUNCTION app_private.track_live_table_change();
CREATE TRIGGER live_log_finish
 AFTER UPDATE OF status ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION app_private.track_live_table_change();
