-- v1.0: payment confirmation is a record only, no real payment processing.
ALTER TABLE public.session_chip_purchases
  ADD COLUMN payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid')),
  ADD COLUMN payment_confirmed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN payment_confirmed_at timestamptz;

ALTER TABLE public.session_chip_purchases
 ADD CONSTRAINT payment_fields_consistent CHECK (
 (payment_status='pending' AND payment_confirmed_by IS NULL AND payment_confirmed_at IS NULL)
 OR (payment_status='paid' AND payment_confirmed_by IS NOT NULL AND payment_confirmed_at IS NOT NULL)
 );

-- Purchases remain immutable. Only payment metadata may be changed, by host/admin.
CREATE OR REPLACE FUNCTION app_private.prevent_purchase_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['payment_status','payment_confirmed_by','payment_confirmed_at'])
    IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['payment_status','payment_confirmed_by','payment_confirmed_at'])
 THEN
   RAISE EXCEPTION 'Não é permitido alterar fichas ou valores de uma compra';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.sessions s WHERE s.id=NEW.session_id AND s.status='scheduled'
   AND (s.organizer_id=(SELECT auth.uid()) OR EXISTS (
     SELECT 1 FROM public.app_admins a WHERE a.user_id=(SELECT auth.uid())
   ))
 ) THEN
   RAISE EXCEPTION 'Apenas o anfitrião ou administrador pode confirmar pagamento';
 END IF;
 RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.set_chip_payment(p_purchase_id uuid,p_paid boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_event uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN
   RAISE EXCEPTION 'Faça login para gerenciar pagamentos';
 END IF;
 SELECT session_id INTO v_event FROM public.session_chip_purchases
 WHERE id=p_purchase_id FOR UPDATE;
 IF v_event IS NULL THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.sessions s WHERE s.id=v_event AND s.status='scheduled'
   AND (s.organizer_id=(SELECT auth.uid()) OR EXISTS (
     SELECT 1 FROM public.app_admins a WHERE a.user_id=(SELECT auth.uid())
   ))
 ) THEN
   RAISE EXCEPTION 'Somente o anfitrião ou administrador pode confirmar pagamentos';
 END IF;
 UPDATE public.session_chip_purchases SET
   payment_status=CASE WHEN p_paid THEN 'paid' ELSE 'pending' END,
   payment_confirmed_by=CASE WHEN p_paid THEN (SELECT auth.uid()) ELSE NULL END,
   payment_confirmed_at=CASE WHEN p_paid THEN now() ELSE NULL END
 WHERE id=p_purchase_id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION app_private.set_chip_payment(uuid,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION app_private.set_chip_payment(uuid,boolean) TO authenticated;

CREATE FUNCTION public.set_chip_payment(p_purchase_id uuid,p_paid boolean)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT app_private.set_chip_payment(p_purchase_id,p_paid); $$;
REVOKE ALL ON FUNCTION public.set_chip_payment(uuid,boolean) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.set_chip_payment(uuid,boolean) TO authenticated;

-- Host/admin must confirm payments before approving results.
CREATE OR REPLACE FUNCTION app_private.check_finance_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.reviewed_by IS DISTINCT FROM (SELECT auth.uid()) OR NOT EXISTS(
   SELECT 1 FROM public.sessions s WHERE s.id=NEW.session_id
   AND s.status='scheduled' AND (s.organizer_id=NEW.reviewed_by OR EXISTS(
     SELECT 1 FROM public.app_admins a WHERE a.user_id=NEW.reviewed_by
   ))
 ) THEN RAISE EXCEPTION 'Somente o anfitrião ou administrador pode aprovar resultados'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f
   WHERE f.session_id=NEW.session_id AND f.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'Compras ou fichas finais ainda não registradas'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id
   AND p.payment_status<>'paid')
 THEN RAISE EXCEPTION 'Confirme todas as compras recebidas antes de aprovar'; END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.ensure_finance_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF OLD.status='scheduled' AND NEW.status='finished' THEN
   IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id)
   THEN RAISE EXCEPTION 'Não é possível encerrar sem participantes'; END IF;
   IF EXISTS(SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=NEW.id
     AND p.payment_status<>'paid')
   THEN RAISE EXCEPTION 'Existem compras ainda não marcadas como pagas'; END IF;
   IF EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id
     AND (NOT EXISTS (SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=a.session_id AND p.user_id=a.user_id)
     OR NOT EXISTS (SELECT 1 FROM public.session_chip_results f WHERE f.session_id=a.session_id AND f.user_id=a.user_id)
     OR NOT EXISTS (SELECT 1 FROM public.session_finance_approvals v WHERE v.session_id=a.session_id AND v.user_id=a.user_id)))
   THEN RAISE EXCEPTION 'Existem resultados ou aprovações pendentes'; END IF;
 END IF;
 RETURN NEW;
END;
$$;

-- Admin reviews follow same constraints as event hosts.
CREATE POLICY approvals_insert_admin ON public.session_finance_approvals
 FOR INSERT TO authenticated WITH CHECK(
   reviewed_by=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.app_admins a WHERE a.user_id=(SELECT auth.uid())
   ) AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled')
 );
CREATE POLICY approvals_delete_admin ON public.session_finance_approvals
 FOR DELETE TO authenticated USING(
   EXISTS (SELECT 1 FROM public.app_admins a WHERE a.user_id=(SELECT auth.uid()))
   AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled')
 );