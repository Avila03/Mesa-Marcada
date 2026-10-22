-- Mesa Marcada: reconfirmation of existing reservations after rescheduling.
-- Never remove a seat, cash record or attendance automatically.
CREATE TABLE IF NOT EXISTS public.event_reconfirmations(
 event_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending'
   CHECK(status IN ('pending','confirmed','declined')),
 changed_at timestamptz NOT NULL DEFAULT now(),
 responded_at timestamptz,
 PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_reconfirmations_user ON public.event_reconfirmations(user_id,status);
ALTER TABLE public.event_reconfirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_reconfirmations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.event_reconfirmations TO authenticated;
DROP POLICY IF EXISTS event_reconfirmations_read ON public.event_reconfirmations;
CREATE POLICY event_reconfirmations_read ON public.event_reconfirmations
 FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) OR EXISTS (
  SELECT 1 FROM public.sessions s
  WHERE s.id=event_id AND s.organizer_id=(SELECT auth.uid())
 ));

CREATE OR REPLACE FUNCTION app_private.reconfirm_attendees_on_reschedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
  INSERT INTO public.event_reconfirmations(event_id,user_id,status,changed_at,responded_at)
  SELECT NEW.id,a.user_id,'pending',now(),NULL
  FROM public.session_attendance a WHERE a.session_id=NEW.id
  ON CONFLICT(event_id,user_id) DO UPDATE
  SET status='pending',changed_at=EXCLUDED.changed_at,responded_at=NULL;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reconfirm_attendees_on_reschedule ON public.sessions;
CREATE TRIGGER trg_reconfirm_attendees_on_reschedule
 AFTER UPDATE OF starts_at ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION app_private.reconfirm_attendees_on_reschedule();

CREATE OR REPLACE FUNCTION public.respond_event_reconfirmation(p_event_id uuid,p_accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_current text;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'É necessário entrar na conta'; END IF;
 IF p_accept IS NULL THEN RAISE EXCEPTION 'Resposta obrigatória'; END IF;
 -- Lock session and attendance to coordinate with further scheduling edits.
 PERFORM 1 FROM public.sessions s
 WHERE s.id=p_event_id AND s.status='scheduled' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evento indisponível para reconfirmação'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.session_attendance a
  WHERE a.session_id=p_event_id AND a.user_id=(SELECT auth.uid())
 ) THEN RAISE EXCEPTION 'Sua presença não está registrada neste evento'; END IF;
 UPDATE public.event_reconfirmations SET
   status=CASE WHEN p_accept THEN 'confirmed' ELSE 'declined' END,
   responded_at=now()
 WHERE event_id=p_event_id AND user_id=(SELECT auth.uid());
 IF NOT FOUND THEN RAISE EXCEPTION 'Não existe mudança de horário pendente'; END IF;
 v_current:=CASE WHEN p_accept THEN 'confirmed' ELSE 'declined' END;
 RETURN v_current;
END; $$;
REVOKE ALL ON FUNCTION public.respond_event_reconfirmation(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_event_reconfirmation(uuid,boolean) TO authenticated;

-- A player who leaves should not keep a stale reconfirmation.
CREATE OR REPLACE FUNCTION app_private.clear_reconfirmation_after_leaving()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.event_reconfirmations r
 WHERE r.event_id=OLD.session_id AND r.user_id=OLD.user_id;
 RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_clear_reconfirmation_after_leaving ON public.session_attendance;
CREATE TRIGGER trg_clear_reconfirmation_after_leaving
 AFTER DELETE ON public.session_attendance
 FOR EACH ROW EXECUTE FUNCTION app_private.clear_reconfirmation_after_leaving();
