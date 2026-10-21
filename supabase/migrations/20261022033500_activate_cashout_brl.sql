-- Ativa a conferência em reais após publicação da interface em produção.
ALTER TABLE public.sessions ALTER COLUMN chip_settlement_brl SET DEFAULT true;

-- Migração controlada de eventos ativos sem repasses confirmados.
CREATE OR REPLACE FUNCTION app_private.protect_chip_settlement_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.chip_settlement_brl IS DISTINCT FROM NEW.chip_settlement_brl
    AND NOT (OLD.status='scheduled' AND NEW.status='scheduled'
             AND OLD.chip_settlement_brl=false AND NEW.chip_settlement_brl=true)
 THEN RAISE EXCEPTION 'O modo de encerramento não pode ser alterado'; END IF;
 RETURN NEW;
END; $$;

UPDATE public.sessions SET chip_settlement_brl=true
WHERE status='scheduled' AND chip_settlement_brl=false
  AND NOT EXISTS (SELECT 1 FROM public.session_chip_payouts p WHERE p.session_id=sessions.id);

CREATE OR REPLACE FUNCTION app_private.protect_chip_settlement_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.chip_settlement_brl IS DISTINCT FROM NEW.chip_settlement_brl
 THEN RAISE EXCEPTION 'O modo de encerramento não pode ser alterado'; END IF;
 RETURN NEW;
END; $$;
