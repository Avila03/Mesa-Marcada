-- Mesa Marcada v2.0 — encerramento em reais sem confirmação manual de pagamentos.
-- Mantém validação por pessoa/valor e preserva eventos legados, sem migrar dados históricos.
CREATE OR REPLACE FUNCTION app_private.ensure_finance_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.status<>'scheduled' OR NEW.status<>'finished' THEN RETURN NEW; END IF;
 IF OLD.chip_settlement_brl THEN
  IF NOT EXISTS(SELECT 1 FROM public.session_live_state WHERE session_id=NEW.id)
   THEN RAISE EXCEPTION 'Inicie o evento Ao vivo antes de encerrar'; END IF;
  IF NOT app_private.cashout_balanced(NEW.id)
   THEN RAISE EXCEPTION 'Valor final em reais divergente do total comprado'; END IF;
  -- Modo BRL: recebimentos e repasses são registros informativos, sem aceite manual.
  -- O fechamento exige apenas conciliação de valores; histórico anterior é mantido.
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
