-- Mesa Marcada: premium league emblems with compatibility for existing leagues.
-- Keep legacy RPCs operational while older clients are open.
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
 ,false);
$$;
REVOKE ALL ON FUNCTION app_private.valid_league_emblem(jsonb) FROM PUBLIC,anon,authenticated;

-- Existing leagues receive an editable default without losing any existing data.
ALTER TABLE public.leagues
 ADD COLUMN IF NOT EXISTS emblem jsonb NOT NULL DEFAULT
 '{"shape":"shield","symbol":"joker","colorIndex":0,"initials":"MM","withYear":true,"year":"2026"}'::jsonb;
DO $ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.leagues'::regclass AND conname='leagues_emblem_valid') THEN
  ALTER TABLE public.leagues ADD CONSTRAINT leagues_emblem_valid CHECK (app_private.valid_league_emblem(emblem));
 END IF;
END $;

-- Dedicated creation RPC requires a valid emblem; legacy RPC stays available for rollout.
CREATE OR REPLACE FUNCTION public.create_league_premium(
 p_name text,p_description text,p_visibility text,p_rules text,p_emblem jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=(SELECT auth.uid()); league uuid;
BEGIN
 IF who IS NULL THEN RAISE EXCEPTION 'Faça login para criar uma liga'; END IF;
 IF p_visibility IS NULL OR p_visibility NOT IN ('public','private')
   OR length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 65
 THEN RAISE EXCEPTION 'Nome ou privacidade inválidos'; END IF;
 IF length(coalesce(p_description,''))>500 OR length(coalesce(p_rules,''))>2500
 THEN RAISE EXCEPTION 'Descrição ou regras muito extensas'; END IF;
 IF NOT app_private.valid_league_emblem(p_emblem)
 THEN RAISE EXCEPTION 'Personalize um brasão válido antes de criar a liga'; END IF;
 INSERT INTO public.leagues(owner_id,name,description,rules,visibility,emblem)
 VALUES(who,trim(p_name),trim(coalesce(p_description,'')),trim(coalesce(p_rules,'')),p_visibility,p_emblem)
 RETURNING id INTO league;
 INSERT INTO public.league_members(league_id,user_id,role) VALUES(league,who,'owner');
 RETURN league;
END; $$;

CREATE OR REPLACE FUNCTION public.update_league_emblem(p_league_id uuid,p_emblem jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT app_private.is_league_owner(p_league_id) THEN
  RAISE EXCEPTION 'Somente o dono pode editar o brasão da liga';
 END IF;
 IF NOT app_private.valid_league_emblem(p_emblem) THEN
  RAISE EXCEPTION 'Brasão inválido. Verifique sigla, ano e opções.';
 END IF;
 UPDATE public.leagues SET emblem=p_emblem WHERE id=p_league_id;
END; $$;

-- New catalog shape avoids replacing the existing RPC signature mid-rollout.
CREATE OR REPLACE FUNCTION public.get_league_catalog_premium()
RETURNS TABLE(
 id uuid,owner_id uuid,name text,description text,rules text,visibility text,
 created_at timestamptz,member_count bigint,event_count bigint,my_role text,
 request_status text,emblem jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.id,l.owner_id,l.name,l.description,l.rules,l.visibility,l.created_at,
  (SELECT count(*) FROM public.league_members m WHERE m.league_id=l.id),
  (SELECT count(*) FROM public.sessions s WHERE s.league_id=l.id AND s.status<>'cancelled'
    AND NOT app_private.is_event_hidden(s.id)),
  (SELECT m.role FROM public.league_members m
    WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())),
  (SELECT q.status FROM public.league_requests q
    WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid())),
  l.emblem
 FROM public.leagues l WHERE (SELECT auth.uid()) IS NOT NULL
 AND (l.visibility='public' OR l.owner_id=(SELECT auth.uid()) OR
  EXISTS (SELECT 1 FROM public.league_members m WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())) OR
  EXISTS (SELECT 1 FROM public.league_requests q WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid()) AND q.status='pending'))
 ORDER BY l.created_at DESC LIMIT 150;
$$;
REVOKE ALL ON FUNCTION public.create_league_premium(text,text,text,text,jsonb),
 public.update_league_emblem(uuid,jsonb),public.get_league_catalog_premium()
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_league_premium(text,text,text,text,jsonb),
 public.update_league_emblem(uuid,jsonb),public.get_league_catalog_premium()
 TO authenticated;
