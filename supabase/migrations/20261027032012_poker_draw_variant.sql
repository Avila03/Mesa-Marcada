-- Legacy null Poker variants remain Texas Hold’em. Financial rules are unchanged.
CREATE OR REPLACE FUNCTION app_private.guard_score_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g text;
BEGIN
 SELECT game INTO g FROM public.rooms WHERE id=NEW.room_id;
 IF TG_OP='UPDATE' AND NEW.room_id IS DISTINCT FROM OLD.room_id THEN RAISE EXCEPTION 'A mesa do evento não pode ser alterada'; END IF;
 IF g='poker' THEN
  IF coalesce(NEW.game_variant,'texas_holdem') NOT IN('texas_holdem','five_card_draw') OR NEW.score_target IS NOT NULL THEN RAISE EXCEPTION 'Variante de Poker inválida'; END IF;
  IF TG_OP='UPDATE' AND coalesce(NEW.game_variant,'texas_holdem')<>coalesce(OLD.game_variant,'texas_holdem') THEN RAISE EXCEPTION 'A variante é definida na criação do evento'; END IF;
  IF TG_OP='INSERT' THEN NEW.game_variant:=coalesce(NEW.game_variant,'texas_holdem'); END IF;
  RETURN NEW;
 END IF;
 IF g='blackjack' THEN
  IF NEW.game_variant IS NOT NULL OR NEW.score_target IS NOT NULL THEN RAISE EXCEPTION 'Esta mesa utiliza fichas'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.game_variant IS DISTINCT FROM OLD.game_variant OR NEW.score_target IS DISTINCT FROM OLD.score_target) THEN
  RAISE EXCEPTION 'A variante e a meta são definidas na criação do evento';
 END IF;
 NEW.game_variant:=coalesce(NEW.game_variant,CASE g WHEN 'truco' THEN 'gauderio' WHEN 'canastra' THEN 'canastra' WHEN 'uno' THEN 'uno_classico' ELSE g END);
 IF (g='truco' AND NEW.game_variant NOT IN('gauderio','paulista','mineiro')) OR
 (g='canastra' AND NEW.game_variant NOT IN('canastra','buraco_aberto','buraco_fechado')) OR
 (g='pontinho' AND NEW.game_variant<>'pontinho') OR (g='uno' AND NEW.game_variant<>'uno_classico') OR (g='pife' AND NEW.game_variant<>'pife')
 THEN RAISE EXCEPTION 'Variante incompatível com a mesa'; END IF;
 NEW.score_target:=coalesce(NEW.score_target,CASE g WHEN 'truco' THEN CASE WHEN NEW.game_variant='gauderio' THEN 24 ELSE 12 END WHEN 'canastra' THEN 3000 WHEN 'pontinho' THEN 100 WHEN 'uno' THEN 500 ELSE 5 END);
 IF (g='truco' AND NEW.score_target<>CASE WHEN NEW.game_variant='gauderio' THEN 24 ELSE 12 END)
 OR (g='canastra' AND NEW.score_target NOT BETWEEN 100 AND 10000)
 OR (g='pontinho' AND NEW.score_target NOT BETWEEN 50 AND 500)
 OR (g='uno' AND NEW.score_target NOT BETWEEN 100 AND 2000)
 OR (g='pife' AND NEW.score_target NOT BETWEEN 1 AND 100)
 THEN RAISE EXCEPTION 'Meta inválida para esta modalidade'; END IF;
 IF (g='truco' AND (NEW.max_participants NOT IN(2,4,6) OR (NEW.game_variant<>'gauderio' AND NEW.max_participants=6)))
 OR (g='canastra' AND NEW.max_participants NOT IN(2,4))
 OR (g='pontinho' AND NEW.max_participants NOT BETWEEN 3 AND 8)
 OR (g='pife' AND NEW.max_participants NOT BETWEEN 2 AND 8)
 OR (g='uno' AND NEW.max_participants NOT BETWEEN 2 AND 10)
 THEN RAISE EXCEPTION 'Quantidade de lugares incompatível com a modalidade'; END IF;
 IF NEW.min_entry_brl<>0 OR NEW.chip_pricing_special THEN RAISE EXCEPTION 'Esta modalidade usa pontuação própria, sem entrada em fichas'; END IF;
 NEW.chip_settlement_brl:=false;
 RETURN NEW;
END; $$;
