ALTER TABLE public.session_chip_purchases
 ADD COLUMN payment_status text NOT NULL DEFAULT 'pending'
   CHECK(payment_status IN ('pending','paid')),
 ADD COLUMN payment_confirmed_by uuid REFERENCES public.profiles(id),
 ADD COLUMN payment_confirmed_at timestamptz;

ALTER TABLE public.session_chip_purchases
 ADD CONSTRAINT payment_receipt_consistent CHECK(
  (payment_status='pending' AND payment_confirmed_by IS NULL AND payment_confirmed_at IS NULL)
  OR
  (payment_status='paid' AND payment_confirmed_by IS NOT NULL AND payment_confirmed_at IS NOT NULL)
 );

CREATE OR REPLACE FUNCTION app_private.prevent_purchase_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['payment_status','payment_confirmed_by','payment_confirmed_at'])
  IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['payment_status','payment_confirmed_by','payment_confirmed_at'])
 THEN RAISE EXCEPTION 'Fichas e valores de uma compra não podem ser alterados'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.sessions s
   WHERE s.id=NEW.session_id AND s.status='scheduled'
    AND s.organizer_id=(SELECT auth.uid())
 ) THEN RAISE EXCEPTION 'Somente o anfitrião pode confirmar recebimento'; END IF;
 RETURN NEW;
END;
$$;

CREATE FUNCTION app_private.confirm_chip_payment(p_purchase_id uuid,p_paid boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_session uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Login necessário'; END IF;
 SELECT session_id INTO v_session FROM public.session_chip_purchases WHERE id=p_purchase_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=v_session
  AND s.status='scheduled' AND s.organizer_id=(SELECT auth.uid()))
 THEN RAISE EXCEPTION 'Apenas o anfitrião pode confirmar o pagamento neste evento'; END IF;
 UPDATE public.session_chip_purchases SET
  payment_status=CASE WHEN p_paid THEN 'paid' ELSE 'pending' END,
  payment_confirmed_by=CASE WHEN p_paid THEN (SELECT auth.uid()) ELSE NULL END,
  payment_confirmed_at=CASE WHEN p_paid THEN now() ELSE NULL END
 WHERE id=p_purchase_id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION app_private.confirm_chip_payment(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.confirm_chip_payment(uuid,boolean) TO authenticated;

CREATE FUNCTION public.confirm_chip_payment(p_purchase_id uuid,p_paid boolean)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT app_private.confirm_chip_payment(p_purchase_id,p_paid); $$;
REVOKE ALL ON FUNCTION public.confirm_chip_payment(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_chip_payment(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.check_finance_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.reviewed_by IS DISTINCT FROM (SELECT auth.uid())
  OR NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=NEW.session_id
   AND s.status='scheduled' AND s.organizer_id=NEW.reviewed_by)
 THEN RAISE EXCEPTION 'Somente o anfitrião pode aprovar o resultado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f
   WHERE f.session_id=NEW.session_id AND f.user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'Faltam compras ou fichas finais'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id AND p.payment_status<>'paid')
 THEN RAISE EXCEPTION 'Confirme o pagamento das compras antes de aprovar'; END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.ensure_finance_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF OLD.status='scheduled' AND NEW.status='finished' THEN
  IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id)
  THEN RAISE EXCEPTION 'É preciso ter ao menos um participante'; END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.id AND p.payment_status<>'paid')
  THEN RAISE EXCEPTION 'Existem pagamentos não confirmados'; END IF;
  IF EXISTS(
   SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id AND (
    NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p
     WHERE p.session_id=a.session_id AND p.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f
     WHERE f.session_id=a.session_id AND f.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_finance_approvals x
     WHERE x.session_id=a.session_id AND x.user_id=a.user_id)
   )
  ) THEN RAISE EXCEPTION 'Resultados e aprovações incompletos'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
