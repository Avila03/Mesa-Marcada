-- Mesa Marcada v0.8: two permanent game tables, preserving IDs and events.
UPDATE public.rooms
SET name=CASE game WHEN 'poker' THEN 'Poker' WHEN 'blackjack' THEN 'Blackjack' END,
    status='active'
WHERE game IN ('poker','blackjack');
CREATE UNIQUE INDEX IF NOT EXISTS rooms_one_per_game_idx ON public.rooms(game);
ALTER TABLE public.rooms ADD CONSTRAINT rooms_canonical_name_check
 CHECK ((game='poker' AND name='Poker') OR (game='blackjack' AND name='Blackjack'));
ALTER TABLE public.rooms ADD CONSTRAINT rooms_always_active_check CHECK (status='active');
