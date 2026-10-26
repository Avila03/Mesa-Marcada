-- Mesa Marcada v1.8.2 - fechamento por valores em reais, sem contagem de fichas finais.

-- Regra de modo em reais: os eventos em andamento migram sem perder dados.
-- Eventos encerrados ficam com suas conferências históricas intactas.
ALTER TABLE public.sessions ADD COLUMN chip_settlement_brl boolean NOT NULL DEFAULT false;
UPDATE public.sessions SET chip_settlement_brl=true WHERE status='scheduled';
ALTER TABLE public.sessions ALTER COLUMN chip_settlement_brl SET DEFAULT true;
CREATE FUNCTION app_private.protect_chip_settlement_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.chip_settlement_brl IS DISTINCT FROM NEW.chip_settlement_brl THEN
  RAISE EXCEPTION 'O modo de encerramento não pode ser alterado';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_chip_settlement_mode BEFORE UPDATE ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION app_private.protect_chip_settlement_mode();
REVOKE ALL ON FUNCTION app_private.protect_chip_settlement_mode() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.session_chip_cashouts(
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 final_brl numeric(12,2) NOT NULL CHECK(final_brl>=0),
 recorded_by uuid NOT NULL REFERENCES public.profiles(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,user_id)
);
ALTER TABLE public.session_chip_cashouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_chip_cashouts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.session_chip_cashouts TO authenticated;
CREATE POLICY chip_cashouts_private_read ON public.session_chip_cashouts
 FOR SELECT TO authenticated USING(app_private.can_view_session_private(session_id));

-- Confere apenas os reais distribuídos, nunca a quantidade final das denominações.
CREATE FUNCTION app_private.cashout_balanced(p_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT
   EXISTS(SELECT 1 FROM public.session_chip_purchases WHERE session_id=p_event_id)
   AND EXISTS(SELECT 1 FROM public.session_attendance WHERE session_id=p_event_id)
   AND NOT EXISTS(
     SELECT 1 FROM public.session_attendance a
      WHERE a.session_id=p_event_id
       AND NOT EXISTS(SELECT 1 FROM public.session_chip_cashouts c
          WHERE c.session_id=a.session_id AND c.user_id=a.user_id)
   )
   AND NOT EXISTS(
     SELECT 1 FROM public.session_chip_cashouts c WHERE c.session_id=p_event_id
       AND NOT EXISTS(SELECT 1 FROM public.session_attendance a
          WHERE a.session_id=c.session_id AND a.user_id=c.user_id)
   )
   AND (SELECT coalesce(sum(c.final_brl),0) FROM public.session_chip_cashouts c WHERE c.session_id=p_event_id)
       = (SELECT coalesce(sum(p.amount_brl),0) FROM public.session_chip_purchases p WHERE p.session_id=p_event_id);
$$;
REVOKE ALL ON FUNCTION app_private.cashout_balanced(uuid) FROM PUBLIC,anon,authenticated;

-- Participante registra seu valor; Anfitrião/Admin pode preencher para o participante.
CREATE FUNCTION app_private.record_chip_cashout(p_event_id uuid,p_user_id uuid,p_final_brl numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid := (SELECT auth.uid()); v_event public.sessions%ROWTYPE; v_total numeric(12,2);
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Login necessário'; END IF;
 IF p_final_brl IS NULL OR p_final_brl<0 OR p_final_brl>9999999999.99
   OR round(p_final_brl,2)<>p_final_brl
 THEN RAISE EXCEPTION 'Informe um valor válido em reais com até duas casas decimais'; END IF;
 SELECT * INTO v_event FROM public.sessions WHERE id=p_event_id FOR UPDATE;
 IF NOT FOUND OR v_event.status<>'scheduled' OR NOT v_event.chip_settlement_brl
 THEN RAISE EXCEPTION 'Conferência em reais não disponível'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=p_event_id)
 THEN RAISE EXCEPTION 'Inicie o Ao vivo antes de registrar o valor final'; END IF;
 IF v_actor<>p_user_id AND v_actor<>v_event.organizer_id AND NOT app_private.is_app_admin()
 THEN RAISE EXCEPTION 'Você não pode informar o valor de outro jogador'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=p_event_id AND a.user_id=p_user_id)
 THEN RAISE EXCEPTION 'Jogador sem presença confirmada'; END IF;
 IF EXISTS(SELECT 1 FROM public.session_chip_payouts WHERE session_id=p_event_id)
 THEN RAISE EXCEPTION 'Reabra os repasses antes de alterar qualquer valor final'; END IF;
 SELECT COALESCE(sum(amount_brl),0) INTO v_total FROM public.session_chip_purchases WHERE session_id=p_event_id;
 IF v_total<=0 THEN RAISE EXCEPTION 'Registre primeiro as compras de fichas'; END IF;
 IF p_final_brl>v_total THEN RAISE EXCEPTION 'O valor informado supera o total disponível na mesa'; END IF;
 INSERT INTO public.session_chip_cashouts(session_id,user_id,final_brl,recorded_by,updated_at)
  VALUES(p_event_id,p_user_id,p_final_brl,v_actor,now())
 ON CONFLICT(session_id,user_id) DO UPDATE SET
  final_brl=excluded.final_brl,recorded_by=excluded.recorded_by,updated_at=now();
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION app_private.record_chip_cashout(uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.record_chip_cashout(uuid,uuid,numeric) TO authenticated;
CREATE FUNCTION public.record_chip_cashout(p_event_id uuid,p_user_id uuid,p_final_brl numeric)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.record_chip_cashout(p_event_id,p_user_id,p_final_brl);
$$;
REVOKE ALL ON FUNCTION public.record_chip_cashout(uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_chip_cashout(uuid,uuid,numeric) TO authenticated;

-- Bloqueia saída após compra: o valor devido fica auditável no caixa.
CREATE FUNCTION app_private.guard_attendance_after_cash_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(
  SELECT 1 FROM public.sessions s
  WHERE s.id=OLD.session_id AND s.chip_settlement_brl
    AND (EXISTS(SELECT 1 FROM public.session_chip_purchases p
       WHERE p.session_id=OLD.session_id AND p.user_id=OLD.user_id)
    OR EXISTS(SELECT 1 FROM public.session_chip_cashouts c
       WHERE c.session_id=OLD.session_id AND c.user_id=OLD.user_id))
 ) THEN RAISE EXCEPTION 'Jogador com compras ou acerto registrado não pode cancelar presença'; END IF;
 RETURN OLD;
END; $$;
CREATE TRIGGER chip_cash_guard_attendance_delete BEFORE DELETE ON public.session_attendance
 FOR EACH ROW EXECUTE FUNCTION app_private.guard_attendance_after_cash_purchase();
REVOKE ALL ON FUNCTION app_private.guard_attendance_after_cash_purchase() FROM PUBLIC,anon,authenticated;

-- Depois que o fechamento em reais começa, não permite alterar entradas da mesa.
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
 IF v_event.chip_settlement_brl THEN
   IF EXISTS(SELECT 1 FROM public.session_chip_cashouts WHERE session_id=p_event_id)
     OR EXISTS(SELECT 1 FROM public.session_chip_payouts WHERE session_id=p_event_id)
   THEN RAISE EXCEPTION 'A conferência em reais começou; compras estão bloqueadas'; END IF;
 ELSE
   IF EXISTS(SELECT 1 FROM public.session_chip_final_items WHERE session_id=p_event_id)
     OR EXISTS(SELECT 1 FROM public.session_chip_payouts WHERE session_id=p_event_id)
   THEN RAISE EXCEPTION 'Já existe conferência final; compras estão bloqueadas'; END IF;
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

CREATE OR REPLACE FUNCTION app_private.guard_chip_purchase_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_state text;
BEGIN
 SELECT status INTO v_state FROM public.sessions WHERE id=OLD.session_id FOR UPDATE;
 IF v_state<>'scheduled' OR NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=OLD.session_id) THEN
  RAISE EXCEPTION 'Compras só podem ser removidas durante o Ao vivo';
 END IF;
 IF EXISTS(SELECT 1 FROM public.session_chip_cashouts WHERE session_id=OLD.session_id) THEN
  RAISE EXCEPTION 'Reabra a conferência em reais antes de excluir compras';
 END IF;
 IF (SELECT NOT chip_settlement_brl FROM public.sessions WHERE id=OLD.session_id) AND
   (EXISTS(SELECT 1 FROM public.session_chip_final_items WHERE session_id=OLD.session_id)
    OR EXISTS(SELECT 1 FROM public.session_chip_payouts WHERE session_id=OLD.session_id))
 THEN RAISE EXCEPTION 'Reabra a conferência antes de excluir compras'; END IF;
 RETURN OLD;
END; $$;
-- Trigger chip_purchase_delete_during_live já existe; somente a função foi atualizada.

-- Repasses em reais, autorizados e protegidos por conferência 100% equilibrada.
CREATE OR REPLACE FUNCTION app_private.set_chip_payout(p_event_id uuid,p_user_id uuid,p_confirmed boolean)
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
  IF v_event.chip_settlement_brl THEN
   IF NOT app_private.cashout_balanced(p_event_id) THEN
    RAISE EXCEPTION 'Os valores finais em reais devem totalizar as compras da mesa';
   END IF;
   SELECT final_brl INTO v_amount FROM public.session_chip_cashouts
    WHERE session_id=p_event_id AND user_id=p_user_id;
  ELSE
   IF NOT app_private.chip_final_balanced(p_event_id) THEN
    RAISE EXCEPTION 'Concilie todas as denominações antes de repassar';
   END IF;
   SELECT COALESCE(sum(f.quantity*(CASE f.chip_value
    WHEN 1 THEN v_event.chip_price_1_brl WHEN 5 THEN v_event.chip_price_5_brl
    WHEN 10 THEN v_event.chip_price_10_brl WHEN 25 THEN v_event.chip_price_25_brl
    ELSE v_event.chip_price_50_brl END)),0)
   INTO v_amount FROM public.session_chip_final_items f
   WHERE f.session_id=p_event_id AND f.user_id=p_user_id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_purchases WHERE session_id=p_event_id AND payment_status<>'paid') THEN
   RAISE EXCEPTION 'Confirme o recebimento de todas as compras';
  END IF;
  IF v_amount IS NULL OR v_amount<=0 THEN RAISE EXCEPTION 'Este jogador não tem valor a receber'; END IF;
  INSERT INTO public.session_chip_payouts(session_id,user_id,confirmed_by)
  VALUES(p_event_id,p_user_id,(SELECT auth.uid()))
  ON CONFLICT(session_id,user_id) DO UPDATE SET confirmed_by=excluded.confirmed_by,confirmed_at=now();
 ELSE
  DELETE FROM public.session_chip_payouts WHERE session_id=p_event_id AND user_id=p_user_id;
 END IF;
 RETURN true;
END; $$;

-- Não exige resultados em pontos ou cinco denominações no fechamento de caixa em reais.
CREATE OR REPLACE FUNCTION app_private.ensure_finance_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.status<>'scheduled' OR NEW.status<>'finished' THEN RETURN NEW; END IF;
 IF OLD.chip_settlement_brl THEN
  IF NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=NEW.id)
   THEN RAISE EXCEPTION 'Inicie o evento Ao vivo antes de encerrar'; END IF;
  IF NOT app_private.cashout_balanced(NEW.id)
   THEN RAISE EXCEPTION 'Valor final em reais divergente do total comprado'; END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=NEW.id AND p.payment_status<>'paid')
   THEN RAISE EXCEPTION 'Há compras ainda não recebidas'; END IF;
  IF EXISTS(
   SELECT 1 FROM public.session_chip_cashouts c WHERE c.session_id=NEW.id AND c.final_brl>0
     AND NOT EXISTS(SELECT 1 FROM public.session_chip_payouts x
        WHERE x.session_id=c.session_id AND x.user_id=c.user_id)
  ) THEN RAISE EXCEPTION 'Confirme os repasses em reais antes de encerrar'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id)
   THEN RAISE EXCEPTION 'É preciso ter ao menos um participante'; END IF;
  IF EXISTS(SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=NEW.id AND p.payment_status<>'paid')
   THEN RAISE EXCEPTION 'Existem pagamentos não confirmados'; END IF;
  IF EXISTS(
   SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id AND (
    NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p WHERE p.session_id=a.session_id AND p.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f WHERE f.session_id=a.session_id AND f.user_id=a.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_finance_approvals x WHERE x.session_id=a.session_id AND x.user_id=a.user_id)
   )
  ) THEN RAISE EXCEPTION 'Resultados e aprovações incompletos'; END IF;
  IF NOT OLD.chip_stock_legacy THEN
   IF NOT app_private.chip_final_balanced(NEW.id) THEN
    RAISE EXCEPTION 'A contagem final não coincide com as fichas em circulação'; END IF;
   IF EXISTS(
    SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id
    AND (SELECT COALESCE(sum(f.quantity*(CASE f.chip_value
     WHEN 1 THEN OLD.chip_price_1_brl WHEN 5 THEN OLD.chip_price_5_brl
     WHEN 10 THEN OLD.chip_price_10_brl WHEN 25 THEN OLD.chip_price_25_brl
     ELSE OLD.chip_price_50_brl END)),0)
     FROM public.session_chip_final_items f WHERE f.session_id=a.session_id AND f.user_id=a.user_id)>0
    AND NOT EXISTS(SELECT 1 FROM public.session_chip_payouts x
       WHERE x.session_id=a.session_id AND x.user_id=a.user_id)
   ) THEN RAISE EXCEPTION 'Confirme todos os repasses'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;

-- Preserva a checagem por pontos apenas nos eventos antigos.
CREATE OR REPLACE FUNCTION app_private.validate_live_points_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.chip_settlement_brl THEN RETURN NEW; END IF;
 IF OLD.status='scheduled' AND NEW.status='finished' AND NOT OLD.chip_stock_legacy THEN
  IF EXISTS(SELECT 1 FROM public.session_attendance a
   LEFT JOIN public.session_chip_results r ON r.session_id=a.session_id AND r.user_id=a.user_id
   WHERE a.session_id=NEW.id AND
    (r.chips_final IS NULL OR r.chips_final IS DISTINCT FROM
      COALESCE((SELECT sum(f.quantity*f.chip_value)::bigint FROM public.session_chip_final_items f
       WHERE f.session_id=a.session_id AND f.user_id=a.user_id),0)))
   THEN RAISE EXCEPTION 'Pontos finais não conferem com as fichas físicas'; END IF;
 END IF;
 RETURN NEW;
END; $$;

-- Esvazia os atalhos antigos apenas em eventos com modo BRL, mantendo o histórico.
CREATE OR REPLACE FUNCTION public.record_chip_final(p_event_id uuid,p_quantities jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=p_event_id AND s.chip_settlement_brl)
 THEN RAISE EXCEPTION 'Use a conferência final em reais'; END IF;
 RETURN app_private.record_chip_final(p_event_id,p_quantities);
END; $$;
