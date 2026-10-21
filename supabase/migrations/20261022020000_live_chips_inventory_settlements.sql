-- Mesa Marcada v1.8 — fichas só no Ao vivo, maleta e acerto em reais.
-- Nunca apaga dados históricos; eventos pré-existentes recebem compatibilidade.
ALTER TABLE public.sessions ADD COLUMN chip_stock_legacy boolean NOT NULL DEFAULT true;
ALTER TABLE public.sessions ALTER COLUMN chip_stock_legacy SET DEFAULT false;
CREATE OR REPLACE FUNCTION app_private.protect_chip_stock_legacy()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.chip_stock_legacy IS DISTINCT FROM OLD.chip_stock_legacy THEN
  RAISE EXCEPTION 'Modo de estoque é definido quando o evento é criado';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_chip_stock_legacy BEFORE UPDATE ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION app_private.protect_chip_stock_legacy();
REVOKE ALL ON FUNCTION app_private.protect_chip_stock_legacy() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.session_chip_final_items (
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 chip_value integer NOT NULL CHECK (chip_value IN (1,5,10,25,50)),
 quantity integer NOT NULL CHECK (quantity BETWEEN 0 AND 5000),
 PRIMARY KEY(session_id,user_id,chip_value)
);
ALTER TABLE public.session_chip_final_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_chip_final_items FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_chip_final_items TO authenticated;
CREATE POLICY chip_final_items_private_read ON public.session_chip_final_items
 FOR SELECT TO authenticated USING(app_private.can_view_session_private(session_id));

CREATE TABLE public.session_chip_payouts (
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 confirmed_by uuid NOT NULL REFERENCES public.profiles(id),
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,user_id)
);
ALTER TABLE public.session_chip_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_chip_payouts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_chip_payouts TO authenticated;
CREATE POLICY chip_payouts_private_read ON public.session_chip_payouts
 FOR SELECT TO authenticated USING(app_private.can_view_session_private(session_id));

-- Operação atômica sob bloqueio da sessão: impede duas compras simultâneas
-- de exceder o estoque de 40 unidades por denominação.
CREATE OR REPLACE FUNCTION app_private.record_chip_purchase_for(
 p_event_id uuid,p_quantities jsonb,p_user_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_event public.sessions%ROWTYPE;
 v_values integer[] := ARRAY[1,5,10,25,50];
 v_prices numeric[];
 v_quantity integer;
 v_sold integer;
 v_limit integer;
 v_total_pieces integer:=0;
 v_total_points bigint:=0;
 v_amount numeric(12,2):=0;
 v_purchase_id uuid;
 v_i integer;
 v_raw text;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Faça login para registrar fichas'; END IF;
 IF p_user_id IS NULL THEN RAISE EXCEPTION 'Selecione o jogador'; END IF;
 IF p_quantities IS NULL OR jsonb_typeof(p_quantities)<>'array'
 OR jsonb_array_length(p_quantities)<>5 THEN
  RAISE EXCEPTION 'Informe cinco quantidades válidas';
 END IF;
 SELECT * INTO v_event FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.status<>'scheduled'
 OR app_private.is_event_hidden(p_event_id) THEN
  RAISE EXCEPTION 'Evento indisponível';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=p_event_id) THEN
  RAISE EXCEPTION 'As compras só são permitidas depois de iniciar o Ao vivo';
 END IF;
 IF v_actor<>p_user_id AND v_actor<>v_event.organizer_id AND NOT app_private.is_app_admin() THEN
  RAISE EXCEPTION 'Somente o Anfitrião pode registrar compras de outro participante';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=p_event_id AND a.user_id=p_user_id) THEN
  RAISE EXCEPTION 'O jogador precisa confirmar presença antes da compra';
 END IF;
 IF EXISTS(SELECT 1 FROM public.session_chip_final_items WHERE session_id=p_event_id)
 OR EXISTS(SELECT 1 FROM public.session_chip_payouts WHERE session_id=p_event_id) THEN
  RAISE EXCEPTION 'Já existe conferência final; compras estão bloqueadas';
 END IF;
 v_prices:=ARRAY[v_event.chip_price_1_brl,v_event.chip_price_5_brl,
  v_event.chip_price_10_brl,v_event.chip_price_25_brl,v_event.chip_price_50_brl];
 FOR v_i IN 1..5 LOOP
  v_raw:=p_quantities->>(v_i-1);
  IF v_raw IS NULL OR v_raw !~ '^[0-9]{1,4}$' THEN
   RAISE EXCEPTION 'Quantidade inválida para ficha de %',v_values[v_i];
  END IF;
  v_quantity:=v_raw::integer;
  SELECT COALESCE(sum(i.quantity),0)::integer INTO v_sold
   FROM public.session_chip_purchases p
   JOIN public.session_chip_purchase_items i ON i.purchase_id=p.id
   WHERE p.session_id=p_event_id AND i.chip_value=v_values[v_i];
  v_limit:=CASE WHEN v_event.chip_stock_legacy THEN GREATEST(40,v_sold) ELSE 40 END;
  IF v_quantity+v_sold>v_limit THEN
   RAISE EXCEPTION 'Ficha %: somente % disponíveis na maleta',v_values[v_i],v_limit-v_sold;
  END IF;
  v_total_pieces:=v_total_pieces+v_quantity;
  v_total_points:=v_total_points+v_values[v_i]*v_quantity;
  v_amount:=v_amount+v_prices[v_i]*v_quantity;
 END LOOP;
 IF v_total_pieces<1 OR v_total_pieces>200 THEN
  RAISE EXCEPTION 'Informe entre 1 e 200 fichas por compra';
 END IF;
 UPDATE public.sessions SET chip_pricing_locked=true WHERE id=p_event_id AND NOT chip_pricing_locked;
 INSERT INTO public.session_chip_purchases
  (session_id,user_id,chips_received,amount_brl,note)
  VALUES(p_event_id,p_user_id,v_total_points,v_amount,'Compra ao vivo por denominações')
  RETURNING id INTO v_purchase_id;
 FOR v_i IN 1..5 LOOP
  v_quantity:=(p_quantities->>(v_i-1))::integer;
  IF v_quantity>0 THEN
   INSERT INTO public.session_chip_purchase_items(purchase_id,chip_value,quantity,unit_price_brl)
   VALUES(v_purchase_id,v_values[v_i],v_quantity,v_prices[v_i]);
  END IF;
 END LOOP;
 RETURN v_purchase_id;
END; $$;
REVOKE ALL ON FUNCTION app_private.record_chip_purchase_for(uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.record_chip_purchase_for(uuid,jsonb,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION app_private.record_chip_purchase(
 p_event_id uuid,p_quantities jsonb
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT app_private.record_chip_purchase_for(p_event_id,p_quantities,(SELECT auth.uid()));
$$;
CREATE FUNCTION public.record_chip_purchase_for(p_event_id uuid,p_quantities jsonb,p_user_id uuid)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.record_chip_purchase_for(p_event_id,p_quantities,p_user_id);
$$;
REVOKE ALL ON FUNCTION public.record_chip_purchase_for(uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_chip_purchase_for(uuid,jsonb,uuid) TO authenticated;

-- Correções de compras também respeitam o início e o bloqueio de conferência.
CREATE FUNCTION app_private.guard_chip_purchase_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state text;
BEGIN
 SELECT status INTO v_state FROM public.sessions WHERE id=OLD.session_id FOR UPDATE;
 IF v_state<>'scheduled' OR NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=OLD.session_id) THEN
  RAISE EXCEPTION 'Compras só podem ser removidas durante o Ao vivo';
 END IF;
 IF EXISTS(SELECT 1 FROM public.session_chip_final_items WHERE session_id=OLD.session_id)
 OR EXISTS(SELECT 1 FROM public.session_chip_payouts WHERE session_id=OLD.session_id) THEN
  RAISE EXCEPTION 'Reabra a conferência antes de excluir compras';
 END IF;
 RETURN OLD;
END; $$;
CREATE TRIGGER chip_purchase_delete_during_live BEFORE DELETE ON public.session_chip_purchases
 FOR EACH ROW EXECUTE FUNCTION app_private.guard_chip_purchase_delete();
REVOKE ALL ON FUNCTION app_private.guard_chip_purchase_delete() FROM PUBLIC,anon,authenticated;

-- Cada jogador informa as 5 denominações ao encerrar. O banco converte
-- pontos para ranking e apaga aprovações/repasses que ficaram obsoletos.
CREATE FUNCTION app_private.record_chip_final(p_event_id uuid,p_quantities jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_values integer[] := ARRAY[1,5,10,25,50];
 v_i integer; v_raw text;v_quantity integer;v_sold integer;
 v_points bigint:=0;v_event public.sessions%ROWTYPE;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Login necessário'; END IF;
 IF p_quantities IS NULL OR jsonb_typeof(p_quantities)<>'array'
 OR jsonb_array_length(p_quantities)<>5 THEN RAISE EXCEPTION 'Informe cinco quantidades'; END IF;
 SELECT * INTO v_event FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.status<>'scheduled' THEN RAISE EXCEPTION 'Evento encerrado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=p_event_id) THEN
  RAISE EXCEPTION 'Resultado disponível somente no Ao vivo';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_attendance WHERE session_id=p_event_id AND user_id=v_actor) THEN
  RAISE EXCEPTION 'Confirme sua presença antes de registrar resultado';
 END IF;
 FOR v_i IN 1..5 LOOP
  v_raw:=p_quantities->>(v_i-1);
  IF v_raw IS NULL OR v_raw !~ '^[0-9]{1,4}$' THEN
   RAISE EXCEPTION 'Quantidade inválida para ficha de %',v_values[v_i];
  END IF;
  v_quantity:=v_raw::integer;
  SELECT COALESCE(sum(i.quantity),0)::integer INTO v_sold
  FROM public.session_chip_purchase_items i JOIN public.session_chip_purchases p ON p.id=i.purchase_id
  WHERE p.session_id=p_event_id AND i.chip_value=v_values[v_i];
  IF v_quantity>v_sold THEN
   RAISE EXCEPTION 'Há apenas % fichas de % em circulação',v_sold,v_values[v_i];
  END IF;
  IF v_quantity+COALESCE((
     SELECT sum(quantity) FROM public.session_chip_final_items f
     WHERE f.session_id=p_event_id AND f.chip_value=v_values[v_i] AND f.user_id<>v_actor
   ),0)>v_sold THEN
   RAISE EXCEPTION 'A conferência ultrapassa as fichas % em circulação',v_values[v_i];
  END IF;
  v_points:=v_points+v_values[v_i]*v_quantity;
 END LOOP;
 DELETE FROM public.session_finance_approvals WHERE session_id=p_event_id AND user_id=v_actor;
 DELETE FROM public.session_chip_payouts WHERE session_id=p_event_id;
 INSERT INTO public.session_chip_results(session_id,user_id,chips_final,updated_at)
  VALUES(p_event_id,v_actor,v_points,now())
  ON CONFLICT(session_id,user_id) DO UPDATE
  SET chips_final=EXCLUDED.chips_final,updated_at=now();
 DELETE FROM public.session_chip_final_items WHERE session_id=p_event_id AND user_id=v_actor;
 FOR v_i IN 1..5 LOOP
  INSERT INTO public.session_chip_final_items(session_id,user_id,chip_value,quantity)
  VALUES(p_event_id,v_actor,v_values[v_i],(p_quantities->>(v_i-1))::integer);
 END LOOP;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION app_private.record_chip_final(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.record_chip_final(uuid,jsonb) TO authenticated;
CREATE FUNCTION public.record_chip_final(p_event_id uuid,p_quantities jsonb)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.record_chip_final(p_event_id,p_quantities);
$$;
REVOKE ALL ON FUNCTION public.record_chip_final(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_chip_final(uuid,jsonb) TO authenticated;

-- A mesma validação usada pelos repasses e pelo encerramento.
CREATE FUNCTION app_private.chip_final_balanced(p_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT
  (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=p_event_id)>0
  AND NOT EXISTS(
   SELECT 1 FROM public.session_attendance a
   WHERE a.session_id=p_event_id
    AND NOT EXISTS(SELECT 1 FROM public.session_chip_results r WHERE r.session_id=a.session_id AND r.user_id=a.user_id)
  )
  AND NOT EXISTS(
    SELECT 1 FROM (VALUES(1),(5),(10),(25),(50)) AS vals(v)
    WHERE
     COALESCE((SELECT sum(i.quantity) FROM public.session_chip_purchase_items i
       JOIN public.session_chip_purchases p ON p.id=i.purchase_id
       WHERE p.session_id=p_event_id AND i.chip_value=vals.v),0)
     <>
     COALESCE((SELECT sum(f.quantity) FROM public.session_chip_final_items f
       WHERE f.session_id=p_event_id AND f.chip_value=vals.v),0)
  )
  AND NOT EXISTS(
    SELECT 1 FROM public.session_chip_purchases p
    WHERE p.session_id=p_event_id AND NOT EXISTS(
      SELECT 1 FROM public.session_chip_purchase_items i WHERE i.purchase_id=p.id
    )
  );
$$;
REVOKE ALL ON FUNCTION app_private.chip_final_balanced(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app_private.set_chip_payout(p_event_id uuid,p_user_id uuid,p_confirmed boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.sessions%ROWTYPE; v_amount numeric(12,2);
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Login necessário'; END IF;
 SELECT * INTO v_event FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.status<>'scheduled' THEN RAISE EXCEPTION 'Evento encerrado'; END IF;
 IF (SELECT auth.uid())<>v_event.organizer_id AND NOT app_private.is_app_admin() THEN
   RAISE EXCEPTION 'Somente o Anfitrião pode confirmar repasses';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=p_event_id) THEN
   RAISE EXCEPTION 'Inicie a partida';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_attendance WHERE session_id=p_event_id AND user_id=p_user_id) THEN
   RAISE EXCEPTION 'Jogador não confirmado';
 END IF;
 IF p_confirmed THEN
  IF NOT app_private.chip_final_balanced(p_event_id) THEN
   RAISE EXCEPTION 'Concilie todas as denominações antes de repassar';
  END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_purchases WHERE session_id=p_event_id AND payment_status<>'paid') THEN
   RAISE EXCEPTION 'Confirme o recebimento de todas as compras';
  END IF;
  SELECT COALESCE(sum(f.quantity*(CASE f.chip_value
   WHEN 1 THEN v_event.chip_price_1_brl WHEN 5 THEN v_event.chip_price_5_brl
   WHEN 10 THEN v_event.chip_price_10_brl WHEN 25 THEN v_event.chip_price_25_brl
   ELSE v_event.chip_price_50_brl END)),0)
  INTO v_amount FROM public.session_chip_final_items f
  WHERE f.session_id=p_event_id AND f.user_id=p_user_id;
  IF v_amount<=0 THEN RAISE EXCEPTION 'Este jogador não tem valor a receber'; END IF;
  INSERT INTO public.session_chip_payouts(session_id,user_id,confirmed_by)
  VALUES(p_event_id,p_user_id,(SELECT auth.uid()))
  ON CONFLICT(session_id,user_id) DO UPDATE
  SET confirmed_by=EXCLUDED.confirmed_by,confirmed_at=now();
 ELSE
  DELETE FROM public.session_chip_payouts WHERE session_id=p_event_id AND user_id=p_user_id;
 END IF;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION app_private.set_chip_payout(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.set_chip_payout(uuid,uuid,boolean) TO authenticated;
CREATE FUNCTION public.set_chip_payout(p_event_id uuid,p_user_id uuid,p_confirmed boolean)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.set_chip_payout(p_event_id,p_user_id,p_confirmed);
$$;
REVOKE ALL ON FUNCTION public.set_chip_payout(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_chip_payout(uuid,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.ensure_finance_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_missing integer;
BEGIN
 IF OLD.status='scheduled' AND NEW.status='finished' THEN
  IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id)
   THEN RAISE EXCEPTION 'É preciso ter ao menos um participante'; END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_purchases p
   WHERE p.session_id=NEW.id AND p.payment_status<>'paid')
   THEN RAISE EXCEPTION 'Existem pagamentos não confirmados'; END IF;
  IF EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id AND (
    NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=a.session_id AND p.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f WHERE f.session_id=a.session_id AND f.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_finance_approvals x WHERE x.session_id=a.session_id AND x.user_id=a.user_id)
  )) THEN RAISE EXCEPTION 'Resultados e aprovações incompletos'; END IF;
  IF NOT OLD.chip_stock_legacy THEN
   IF NOT app_private.chip_final_balanced(NEW.id) THEN
    RAISE EXCEPTION 'A contagem final não coincide com as fichas em circulação';
   END IF;
   SELECT count(*) INTO v_missing FROM public.session_attendance a
   WHERE a.session_id=NEW.id
    AND (SELECT COALESCE(sum(f.quantity*(CASE f.chip_value
     WHEN 1 THEN OLD.chip_price_1_brl WHEN 5 THEN OLD.chip_price_5_brl
     WHEN 10 THEN OLD.chip_price_10_brl WHEN 25 THEN OLD.chip_price_25_brl
     ELSE OLD.chip_price_50_brl END)),0)
     FROM public.session_chip_final_items f
     WHERE f.session_id=a.session_id AND f.user_id=a.user_id)>0
    AND NOT EXISTS(SELECT 1 FROM public.session_chip_payouts x
       WHERE x.session_id=a.session_id AND x.user_id=a.user_id);
   IF v_missing>0 THEN RAISE EXCEPTION 'Confirme os repasses de todos os jogadores'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
