-- Mesa Marcada: auditável também em pontos, além do estoque físico.
-- Apenas eventos novos usam a validação estrita.
CREATE FUNCTION app_private.validate_live_points_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.status='scheduled' AND NEW.status='finished' AND NOT OLD.chip_stock_legacy THEN
  IF EXISTS(
   SELECT 1 FROM public.session_attendance a
    LEFT JOIN public.session_chip_results r
     ON r.session_id=a.session_id AND r.user_id=a.user_id
   WHERE a.session_id=NEW.id
     AND (r.chips_final IS NULL OR r.chips_final IS DISTINCT FROM
       COALESCE((SELECT sum(f.quantity*f.chip_value)::bigint
        FROM public.session_chip_final_items f
        WHERE f.session_id=a.session_id AND f.user_id=a.user_id),0))
  ) THEN
   RAISE EXCEPTION 'Pontos finais não conferem com as fichas físicas do jogador';
  END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_final_items f
   WHERE f.session_id=NEW.id AND NOT EXISTS(
     SELECT 1 FROM public.session_attendance a
     WHERE a.session_id=f.session_id AND a.user_id=f.user_id
   )) THEN
   RAISE EXCEPTION 'Há fichas finais atribuídas a um jogador sem presença';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_live_points_on_finish BEFORE UPDATE OF status ON public.sessions
FOR EACH ROW EXECUTE FUNCTION app_private.validate_live_points_before_finish();
REVOKE ALL ON FUNCTION app_private.validate_live_points_before_finish() FROM PUBLIC,anon,authenticated;
