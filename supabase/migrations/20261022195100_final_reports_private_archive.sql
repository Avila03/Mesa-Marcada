-- Archive reports are visible only through authenticated member-aware RPCs.
CREATE TABLE IF NOT EXISTS app_private.league_final_reports (
 league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
 finished_at timestamptz NOT NULL,
 summary jsonb NOT NULL
);
REVOKE ALL ON app_private.league_final_reports FROM PUBLIC, anon, authenticated;

-- Membership is frozen at closing, preserving who may read archived reports.
CREATE OR REPLACE FUNCTION app_private.freeze_closed_league_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_league uuid;
BEGIN
 v_league:=CASE WHEN TG_OP='DELETE' THEN OLD.league_id ELSE NEW.league_id END;
 IF EXISTS(SELECT 1 FROM public.leagues l WHERE l.id=v_league AND l.finished_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Os participantes de uma liga encerrada são somente leitura'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_freeze_closed_members ON public.league_members;
CREATE TRIGGER trg_freeze_closed_members
 BEFORE INSERT OR UPDATE OR DELETE ON public.league_members
 FOR EACH ROW EXECUTE FUNCTION app_private.freeze_closed_league_members();
