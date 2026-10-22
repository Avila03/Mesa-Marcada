-- Restore standardized Minimalista, Clássico and Premium crest finishes.
-- Missing finish is accepted for compatibility with already-open clients;
-- all stored older league crests receive "premium", preserving prior appearance.
CREATE OR REPLACE FUNCTION app_private.valid_league_emblem(p_emblem jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(
  jsonb_typeof(p_emblem)='object'
  AND p_emblem ?& ARRAY['shape','symbol','colorIndex','initials','withYear','year']
  AND p_emblem->>'shape' IN ('shield','circle','hex','card')
  AND p_emblem->>'symbol' IN (
   'joker','two-jokers','dealer','crown','spade','heart','diamond','club',
   'ace','two-aces','cards','deck','royal','straight','flush','full-house',
   'four-kind','all-in','blackjack','twenty-one','chip','chip-stack','die',
   'dice','roulette','roulette-ball','poker-table'
  )
  AND jsonb_typeof(p_emblem->'colorIndex')='number'
  AND p_emblem->>'colorIndex' ~ '^[0-5]$'
  AND p_emblem->>'initials' ~ '^[A-Z0-9]{1,4}$'
  AND jsonb_typeof(p_emblem->'withYear')='boolean'
  AND p_emblem->>'year' ~ '^[0-9]{4}$'
  AND (NOT (p_emblem ? 'finish') OR p_emblem->>'finish' IN ('minimal','classic','premium'))
 ,false);
$$;
REVOKE ALL ON FUNCTION app_private.valid_league_emblem(jsonb) FROM PUBLIC,anon,authenticated;

ALTER TABLE public.leagues ALTER COLUMN emblem SET DEFAULT
 '{"shape":"shield","symbol":"joker","colorIndex":0,"initials":"MM","withYear":true,"year":"2026","finish":"premium"}'::jsonb;

UPDATE public.leagues
 SET emblem=jsonb_set(emblem,'{finish}','"premium"'::jsonb,true)
 WHERE NOT (emblem ? 'finish');
