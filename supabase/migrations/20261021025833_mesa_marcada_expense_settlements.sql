-- Mesa Marcada v1.2: acertos voluntários entre jogadores, sem processar dinheiro.
-- Cada quitação é confirmada exclusivamente pela pessoa que pagou a despesa.
CREATE TABLE public.expense_split_settlements (
  expense_id uuid NOT NULL REFERENCES public.session_expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  confirmed_by uuid NOT NULL REFERENCES public.profiles(id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(expense_id,user_id),
  FOREIGN KEY(expense_id,user_id) REFERENCES public.expense_split_members(expense_id,user_id) ON DELETE CASCADE
);
CREATE INDEX expense_split_settlements_event ON public.expense_split_settlements(session_id);
ALTER TABLE public.expense_split_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_split_settlements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.expense_split_settlements TO authenticated;
CREATE POLICY settlements_read_event_members ON public.expense_split_settlements
FOR SELECT TO authenticated USING (app_private.can_view_session_private(session_id));

-- Alterar integrantes recalcula quotas. Invalida confirmações anteriores,
-- pois valores confirmados não podem persistir após um novo rateio.
CREATE FUNCTION app_private.invalidate_expense_settlements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  DELETE FROM public.expense_split_settlements
  WHERE expense_id=COALESCE(NEW.expense_id,OLD.expense_id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER invalidate_settlements_after_join
AFTER INSERT OR DELETE ON public.expense_split_members
FOR EACH ROW EXECUTE FUNCTION app_private.invalidate_expense_settlements();
REVOKE ALL ON FUNCTION app_private.invalidate_expense_settlements()
FROM PUBLIC,anon,authenticated;

-- Evita alterar valores e atribuição de pagamento sem recompor o racha.
CREATE FUNCTION app_private.invalidate_settlements_on_expense_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.amount_brl IS DISTINCT FROM OLD.amount_brl
  OR NEW.paid_by IS DISTINCT FROM OLD.paid_by THEN
    DELETE FROM public.expense_split_settlements WHERE expense_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invalidate_settlements_expense_change
BEFORE UPDATE ON public.session_expenses
FOR EACH ROW EXECUTE FUNCTION app_private.invalidate_settlements_on_expense_change();
REVOKE ALL ON FUNCTION app_private.invalidate_settlements_on_expense_change()
FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app_private.set_expense_settled(
  p_expense_id uuid,p_user_id uuid,p_settled boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_paid_by uuid;v_session uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT e.paid_by,e.session_id INTO v_paid_by,v_session
  FROM public.session_expenses e WHERE e.id=p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  IF v_paid_by IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Somente quem pagou a despesa pode confirmar recebimento';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.expense_split_members m
    WHERE m.expense_id=p_expense_id AND m.user_id=p_user_id
  ) THEN RAISE EXCEPTION 'Este jogador não participa do racha'; END IF;
  IF p_user_id=v_paid_by THEN
    RAISE EXCEPTION 'Sua própria parcela já está paga';
  END IF;
  IF p_settled THEN
    INSERT INTO public.expense_split_settlements
    (expense_id,user_id,session_id,confirmed_by)
    VALUES(p_expense_id,p_user_id,v_session,(SELECT auth.uid()))
    ON CONFLICT(expense_id,user_id) DO NOTHING;
  ELSE
    DELETE FROM public.expense_split_settlements
    WHERE expense_id=p_expense_id AND user_id=p_user_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION app_private.set_expense_settled(uuid,uuid,boolean)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.set_expense_settled(uuid,uuid,boolean) TO authenticated;
CREATE FUNCTION public.set_expense_settled(
 p_expense_id uuid,p_user_id uuid,p_settled boolean
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT app_private.set_expense_settled(p_expense_id,p_user_id,p_settled); $$;
REVOKE ALL ON FUNCTION public.set_expense_settled(uuid,uuid,boolean)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_expense_settled(uuid,uuid,boolean) TO authenticated;
