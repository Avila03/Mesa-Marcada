-- Mesa Marcada v1.3 — administração global com exclusão reversível.
-- A tabela public.app_admins já existe (cadastro feito pelo proprietário).
-- Ninguém obtém papel de administrador pela interface.
CREATE FUNCTION app_private.is_app_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.app_admins a WHERE a.user_id=(SELECT auth.uid())
 );
$$;
REVOKE ALL ON FUNCTION app_private.is_app_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.is_app_admin() TO authenticated;

CREATE TABLE public.admin_hidden_events (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  previous_status text NOT NULL CHECK(previous_status IN ('scheduled','finished','cancelled')),
  hidden_by uuid NOT NULL REFERENCES public.profiles(id),
  hidden_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_hidden_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_hidden_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_hidden_events TO authenticated;
CREATE POLICY admin_hidden_read ON public.admin_hidden_events FOR SELECT TO authenticated
 USING (app_private.is_app_admin());

CREATE TABLE public.event_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  action text NOT NULL CHECK(action IN ('hide','restore','cancel','finish','transfer_host')),
  performed_by uuid NOT NULL REFERENCES public.profiles(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL DEFAULT ''
);
ALTER TABLE public.event_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_admin_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.event_admin_audit TO authenticated;
CREATE POLICY audit_read_admin ON public.event_admin_audit FOR SELECT TO authenticated
 USING(app_private.is_app_admin());

CREATE FUNCTION app_private.is_event_hidden(p_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_hidden_events h WHERE h.session_id=p_event_id);
$$;
REVOKE ALL ON FUNCTION app_private.is_event_hidden(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.is_event_hidden(uuid) TO authenticated;

-- O administrador enxerga todos os eventos. Os demais não recebem
-- eventos removidos da agenda, mesmo consultando por UUID.
DROP POLICY sessions_select_authenticated ON public.sessions;
CREATE POLICY sessions_select_authenticated ON public.sessions FOR SELECT TO authenticated
 USING(app_private.is_app_admin() OR NOT app_private.is_event_hidden(id));

-- Leitura financeira administrativa; nenhum novo privilégio para
-- modificar compras de outras pessoas foi concedido.
CREATE OR REPLACE FUNCTION app_private.can_view_session_private(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (
  app_private.is_app_admin() OR
  (NOT app_private.is_event_hidden(p_session) AND (
    EXISTS(SELECT 1 FROM public.session_attendance a
      WHERE a.session_id=p_session AND a.user_id=(SELECT auth.uid()))
    OR EXISTS(SELECT 1 FROM public.sessions s
      WHERE s.id=p_session AND s.organizer_id=(SELECT auth.uid()))
  ))
 );
$$;

CREATE FUNCTION app_private.admin_manage_event(
 p_event_id uuid,p_action text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event public.sessions%ROWTYPE;v_old_status text;
BEGIN
 IF NOT app_private.is_app_admin() THEN RAISE EXCEPTION 'Somente Administrador geral'; END IF;
 SELECT * INTO v_event FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
 IF p_action='hide' THEN
   IF EXISTS(SELECT 1 FROM public.admin_hidden_events WHERE session_id=p_event_id) THEN
     RETURN true;
   END IF;
   INSERT INTO public.admin_hidden_events(session_id,previous_status,hidden_by)
   VALUES(p_event_id,v_event.status,(SELECT auth.uid()));
   IF v_event.status='scheduled' THEN
     UPDATE public.sessions SET status='cancelled' WHERE id=p_event_id;
   END IF;
 ELSIF p_action='restore' THEN
   SELECT previous_status INTO v_old_status FROM public.admin_hidden_events
   WHERE session_id=p_event_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Este evento não foi excluído'; END IF;
   IF v_old_status='scheduled' THEN
     UPDATE public.sessions SET status='scheduled' WHERE id=p_event_id;
   END IF;
   DELETE FROM public.admin_hidden_events WHERE session_id=p_event_id;
 ELSIF p_action='cancel' THEN
   IF EXISTS(SELECT 1 FROM public.admin_hidden_events WHERE session_id=p_event_id) THEN
     RAISE EXCEPTION 'Restaure o evento antes de cancelar';
   END IF;
   IF v_event.status<>'scheduled' THEN
     RAISE EXCEPTION 'Somente eventos agendados podem ser cancelados';
   END IF;
   UPDATE public.sessions SET status='cancelled' WHERE id=p_event_id;
 ELSIF p_action='finish' THEN
   IF EXISTS(SELECT 1 FROM public.admin_hidden_events WHERE session_id=p_event_id) THEN
     RAISE EXCEPTION 'Restaure o evento antes de encerrá-lo';
   END IF;
   IF v_event.status<>'scheduled' THEN RAISE EXCEPTION 'O evento não está agendado'; END IF;
   UPDATE public.sessions SET status='finished' WHERE id=p_event_id;
 ELSE RAISE EXCEPTION 'Ação administrativa inválida'; END IF;
 INSERT INTO public.event_admin_audit(session_id,action,performed_by,description)
 VALUES(p_event_id,p_action,(SELECT auth.uid()),'Gestão administrativa do evento');
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION app_private.admin_manage_event(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.admin_manage_event(uuid,text) TO authenticated;
CREATE FUNCTION public.admin_manage_event(p_event_id uuid,p_action text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT app_private.admin_manage_event(p_event_id,p_action); $$;
REVOKE ALL ON FUNCTION public.admin_manage_event(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_event(uuid,text) TO authenticated;

-- Permite revisão e confirmação financeira pelo Administrador,
-- preservando validação das fichas e pagamentos no servidor.
CREATE POLICY approvals_insert_admin ON public.session_finance_approvals
 FOR INSERT TO authenticated WITH CHECK(
  reviewed_by=(SELECT auth.uid()) AND app_private.is_app_admin()
  AND EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled')
 );
CREATE POLICY approvals_delete_admin ON public.session_finance_approvals
 FOR DELETE TO authenticated USING(
  app_private.is_app_admin()
  AND EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled')
 );

CREATE OR REPLACE FUNCTION app_private.check_finance_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.reviewed_by IS DISTINCT FROM (SELECT auth.uid())
  OR NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=NEW.session_id
   AND s.status='scheduled'
   AND (s.organizer_id=NEW.reviewed_by OR app_private.is_app_admin()))
 THEN RAISE EXCEPTION 'Apenas Anfitrião ou Administrador pode aprovar fichas'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f
   WHERE f.session_id=NEW.session_id AND f.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'Faltam compras ou fichas finais'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id
   AND p.payment_status<>'paid')
 THEN RAISE EXCEPTION 'Confirme os pagamentos antes de aprovar'; END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.prevent_purchase_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['payment_status','payment_confirmed_by','payment_confirmed_at'])
 IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['payment_status','payment_confirmed_by','payment_confirmed_at'])
 THEN RAISE EXCEPTION 'Fichas e valores de compra não podem ser editados'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s
   WHERE s.id=NEW.session_id AND s.status='scheduled'
   AND (s.organizer_id=(SELECT auth.uid()) OR app_private.is_app_admin()))
 THEN RAISE EXCEPTION 'Apenas Anfitrião ou Administrador pode marcar pagamento'; END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.confirm_chip_payment(p_purchase_id uuid,p_paid boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_session uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Login necessário'; END IF;
 SELECT session_id INTO v_session FROM public.session_chip_purchases
 WHERE id=p_purchase_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=v_session
  AND s.status='scheduled'
  AND (s.organizer_id=(SELECT auth.uid()) OR app_private.is_app_admin()))
 THEN RAISE EXCEPTION 'Apenas Anfitrião ou Administrador pode confirmar pagamento'; END IF;
 UPDATE public.session_chip_purchases SET
  payment_status=CASE WHEN p_paid THEN 'paid' ELSE 'pending' END,
  payment_confirmed_by=CASE WHEN p_paid THEN (SELECT auth.uid()) ELSE NULL END,
  payment_confirmed_at=CASE WHEN p_paid THEN now() ELSE NULL END
 WHERE id=p_purchase_id;
 RETURN true;
END;
$$;
