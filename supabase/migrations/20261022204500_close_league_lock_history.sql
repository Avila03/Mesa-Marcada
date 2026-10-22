-- The final result must not diverge from the event schedule.
CREATE OR REPLACE FUNCTION app_private.freeze_archived_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.league_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id=OLD.league_id AND l.finished_at IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'Eventos de uma Liga finalizada são somente leitura';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_freeze_archived_sessions ON public.sessions;
CREATE TRIGGER trg_freeze_archived_sessions BEFORE UPDATE OR DELETE
 ON public.sessions FOR EACH ROW EXECUTE FUNCTION app_private.freeze_archived_session();

-- Pending entry requests are rejected on closure (and notified by the existing
-- join-request notification trigger); no one is left waiting for a dead league.
CREATE OR REPLACE FUNCTION app_private.reject_pending_on_league_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL THEN
  UPDATE public.league_requests
  SET status='rejected',decided_at=NEW.finished_at
  WHERE league_id=NEW.id AND status='pending';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reject_pending_on_league_close ON public.leagues;
CREATE TRIGGER trg_reject_pending_on_league_close AFTER UPDATE OF finished_at
 ON public.leagues FOR EACH ROW EXECUTE FUNCTION app_private.reject_pending_on_league_close();
