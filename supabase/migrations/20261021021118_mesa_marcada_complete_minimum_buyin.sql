-- Atualiza a entrada mínima: compras anteriores abaixo do mínimo
-- exigem completar a diferença antes de recompras livres.
CREATE OR REPLACE FUNCTION public.enforce_initial_buyin()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE event_min numeric; existing_total numeric;
BEGIN
  SELECT min_entry_brl INTO event_min
  FROM public.sessions WHERE id=NEW.session_id FOR UPDATE;
  SELECT COALESCE(sum(amount_brl),0) INTO existing_total
  FROM public.session_chip_purchases p
  WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id;
  IF existing_total < event_min AND existing_total+NEW.amount_brl<event_min THEN
    RAISE EXCEPTION 'Complete a entrada mínima de R$ % (faltam R$ %)',
       event_min, event_min-existing_total;
  END IF;
  RETURN NEW;
END;
$function$;