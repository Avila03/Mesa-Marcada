-- Mesa Marcada v0.9 security follow-up.
-- Only a confirmed expense creator can declare they personally paid.
-- The organizer may attribute an expense to another confirmed attendee.
CREATE OR REPLACE FUNCTION app_private.check_expense_payer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.paid_by IS NULL THEN NEW.paid_by:=NEW.created_by; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.session_attendance a
    WHERE a.session_id=NEW.session_id AND a.user_id=NEW.paid_by
  ) THEN
    RAISE EXCEPTION 'Quem pagou precisa estar confirmado no evento';
  END IF;
  IF NEW.paid_by <> NEW.created_by
    AND NOT EXISTS(
      SELECT 1 FROM public.sessions s
      WHERE s.id=NEW.session_id AND s.organizer_id=NEW.created_by
    ) THEN
    RAISE EXCEPTION 'Somente o organizador pode registrar uma despesa paga por outra pessoa';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.check_expense_payer() FROM public,anon,authenticated;