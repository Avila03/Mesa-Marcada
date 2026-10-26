-- Mesa Marcada v0.8: exactly two permanent game tables (Poker and Blackjack).
-- Existing IDs and event relationships are preserved: only labels are normalized.
UPDATE public.rooms
SET name = CASE game WHEN 'poker' THEN 'Poker' WHEN 'blackjack' THEN 'Blackjack' END,
    status = 'active'
WHERE game IN ('poker','blackjack');

-- Guarantees at most one table per modality, regardless of API access.
CREATE UNIQUE INDEX IF NOT EXISTS rooms_one_per_game_idx ON public.rooms(game);

-- Protect the two permanent tables from renaming/archiving by clients.
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_canonical_name_check
  CHECK ((game = 'poker' AND name = 'Poker') OR (game = 'blackjack' AND name = 'Blackjack'));
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_always_active_check
  CHECK (status = 'active');
