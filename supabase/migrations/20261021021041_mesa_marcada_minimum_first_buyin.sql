-- Mesa Marcada: primeira compra deve respeitar a entrada minima do evento.
CREATE FUNCTION public.enforce_initial_buyin()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
DECLARE event_min numeric;
BEGIN
  SELECT min_entry_brl INTO event_min FROM public.sessions WHERE id=NEW.session_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.session_chip_purchases p
    WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id
  ) AND NEW.amount_brl < event_min THEN
    RAISE EXCEPTION 'A primeira compra deve ser de pelo menos R$ %', event_min;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_initial_buyin_trigger
BEFORE INSERT ON public.session_chip_purchases
FOR EACH ROW EXECUTE FUNCTION public.enforce_initial_buyin();
REVOKE ALL ON FUNCTION public.enforce_initial_buyin() FROM public,anon,authenticated;
