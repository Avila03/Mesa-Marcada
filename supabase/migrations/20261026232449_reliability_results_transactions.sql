-- Idempotent commands: the receipt and business mutation commit together.
CREATE TABLE app_private.mutation_receipts(
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,kind text NOT NULL,payload jsonb NOT NULL,result_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE app_private.mutation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.mutation_receipts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app_private.record_chip_purchase_once(p_request_id uuid,p_event_id uuid,p_quantities jsonb,p_user_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $once$
DECLARE v_actor uuid:=(SELECT auth.uid());v_result uuid;v_payload jsonb:=jsonb_build_object('event',p_event_id,'quantities',p_quantities,'user',p_user_id);v_prior app_private.mutation_receipts%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Autenticação e identificador obrigatórios'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||p_request_id::text,0));
 SELECT * INTO v_prior FROM app_private.mutation_receipts WHERE actor_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.kind<>'record_chip_purchase_once' OR v_prior.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Este identificador já pertence a outro lançamento'; END IF;
  RETURN v_prior.result_id;
 END IF;
 v_result:=app_private.record_chip_purchase_for(p_event_id,p_quantities,p_user_id);
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(v_actor,p_request_id,'record_chip_purchase_once',v_payload,v_result);
 RETURN v_result;
END; $once$;
REVOKE ALL ON FUNCTION app_private.record_chip_purchase_once(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.record_chip_purchase_once(uuid,uuid,jsonb,uuid) TO authenticated;
CREATE FUNCTION public.record_chip_purchase_once(p_request_id uuid,p_event_id uuid,p_quantities jsonb,p_user_id uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $once$ SELECT app_private.record_chip_purchase_once(p_request_id,p_event_id,p_quantities,p_user_id); $once$;
REVOKE ALL ON FUNCTION public.record_chip_purchase_once(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_chip_purchase_once(uuid,uuid,jsonb,uuid) TO authenticated;

CREATE FUNCTION app_private.create_expense_once(p_request_id uuid,p_event_id uuid,p_label text,p_amount numeric,p_category text,p_paid_by uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $once$
DECLARE v_actor uuid:=(SELECT auth.uid());v_result uuid;v_payload jsonb:=jsonb_build_object('event',p_event_id,'label',p_label,'amount',p_amount,'category',p_category,'payer',p_paid_by);v_prior app_private.mutation_receipts%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Autenticação e identificador obrigatórios'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||p_request_id::text,0));
 SELECT * INTO v_prior FROM app_private.mutation_receipts WHERE actor_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.kind<>'create_expense_once' OR v_prior.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Este identificador já pertence a outro lançamento'; END IF;
  RETURN v_prior.result_id;
 END IF;
 IF NOT app_private.can_write_session_private(p_event_id) OR NOT app_private.may_view_event(p_event_id) THEN RAISE EXCEPTION 'Sem permissão para registrar despesas'; END IF;
 IF length(trim(p_label)) NOT BETWEEN 2 AND 180 OR p_amount IS NULL OR p_amount<=0 OR round(p_amount,2)<>p_amount OR p_amount>99999999 THEN RAISE EXCEPTION 'Descrição ou valor inválidos'; END IF;
 INSERT INTO public.session_expenses(session_id,created_by,paid_by,label,amount_brl,category)
 VALUES(p_event_id,v_actor,p_paid_by,trim(p_label),p_amount,p_category) RETURNING id INTO v_result;
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(v_actor,p_request_id,'create_expense_once',v_payload,v_result);
 RETURN v_result;
END; $once$;
REVOKE ALL ON FUNCTION app_private.create_expense_once(uuid,uuid,text,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.create_expense_once(uuid,uuid,text,numeric,text,uuid) TO authenticated;
CREATE FUNCTION public.create_expense_once(p_request_id uuid,p_event_id uuid,p_label text,p_amount numeric,p_category text,p_paid_by uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $once$ SELECT app_private.create_expense_once(p_request_id,p_event_id,p_label,p_amount,p_category,p_paid_by); $once$;
REVOKE ALL ON FUNCTION public.create_expense_once(uuid,uuid,text,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_expense_once(uuid,uuid,text,numeric,text,uuid) TO authenticated;

CREATE FUNCTION app_private.create_poll_once(p_request_id uuid,p_event_id uuid,p_question text,p_options text[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $once$
DECLARE v_actor uuid:=(SELECT auth.uid());v_result uuid;v_payload jsonb:=jsonb_build_object('event',p_event_id,'question',p_question,'options',p_options);v_prior app_private.mutation_receipts%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Autenticação e identificador obrigatórios'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||p_request_id::text,0));
 SELECT * INTO v_prior FROM app_private.mutation_receipts WHERE actor_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.kind<>'create_poll_once' OR v_prior.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Este identificador já pertence a outro lançamento'; END IF;
  RETURN v_prior.result_id;
 END IF;
 IF NOT app_private.can_write_session_private(p_event_id) OR NOT app_private.may_view_event(p_event_id) THEN RAISE EXCEPTION 'Sem permissão para criar enquetes'; END IF;
 IF p_question IS NULL OR length(trim(p_question)) NOT BETWEEN 2 AND 200 OR coalesce(cardinality(p_options),0) NOT BETWEEN 2 AND 41
 OR EXISTS(SELECT 1 FROM unnest(p_options) o WHERE o IS NULL OR length(trim(o)) NOT BETWEEN 1 AND 80)
 OR (SELECT count(DISTINCT lower(trim(o))) FROM unnest(p_options) o)<>cardinality(p_options)
 THEN RAISE EXCEPTION 'Informe uma pergunta e de 2 a 41 opções válidas e distintas'; END IF;
 INSERT INTO public.session_polls(session_id,created_by,question) VALUES(p_event_id,v_actor,trim(p_question)) RETURNING id INTO v_result;
 INSERT INTO public.session_poll_options(poll_id,label,position) SELECT v_result,trim(o),(n-1)::integer FROM unnest(p_options) WITH ORDINALITY t(o,n);
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(v_actor,p_request_id,'create_poll_once',v_payload,v_result);
 RETURN v_result;
END; $once$;
REVOKE ALL ON FUNCTION app_private.create_poll_once(uuid,uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.create_poll_once(uuid,uuid,text,text[]) TO authenticated;
CREATE FUNCTION public.create_poll_once(p_request_id uuid,p_event_id uuid,p_question text,p_options text[]) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $once$ SELECT app_private.create_poll_once(p_request_id,p_event_id,p_question,p_options); $once$;
REVOKE ALL ON FUNCTION public.create_poll_once(uuid,uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_poll_once(uuid,uuid,text,text[]) TO authenticated;

CREATE INDEX IF NOT EXISTS purchases_user_session_idx ON public.session_chip_purchases(user_id,session_id);
CREATE INDEX IF NOT EXISTS cashouts_user_session_idx ON public.session_chip_cashouts(user_id,session_id);
CREATE INDEX IF NOT EXISTS results_user_session_idx ON public.session_chip_results(user_id,session_id);
CREATE INDEX IF NOT EXISTS expense_payer_session_idx ON public.session_expenses(paid_by,session_id);
CREATE INDEX IF NOT EXISTS split_members_user_idx ON public.expense_split_members(user_id,expense_id);
CREATE INDEX IF NOT EXISTS split_settlements_user_idx ON public.expense_split_settlements(user_id,session_id);
CREATE INDEX IF NOT EXISTS event_audit_session_time_idx ON public.event_admin_audit(session_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS sessions_organizer_time_idx ON public.sessions(organizer_id,starts_at);
DROP POLICY IF EXISTS approvals_insert_admin ON public.session_finance_approvals;
DROP POLICY IF EXISTS approvals_insert_organizer ON public.session_finance_approvals;
CREATE POLICY approvals_insert_authorized ON public.session_finance_approvals FOR INSERT TO authenticated
WITH CHECK(reviewed_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled' AND (s.organizer_id=(SELECT auth.uid()) OR app_private.is_app_admin())));
DROP POLICY IF EXISTS approvals_delete_admin ON public.session_finance_approvals;
DROP POLICY IF EXISTS approvals_delete_organizer ON public.session_finance_approvals;
CREATE POLICY approvals_delete_authorized ON public.session_finance_approvals FOR DELETE TO authenticated
USING(EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled' AND (app_private.is_app_admin() OR (s.organizer_id=(SELECT auth.uid()) AND reviewed_by=(SELECT auth.uid())))));
