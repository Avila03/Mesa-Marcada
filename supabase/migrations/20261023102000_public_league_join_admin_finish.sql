-- Public membership without approval, and privileged league closure.
CREATE OR REPLACE FUNCTION public.request_league_join(p_league_id uuid,p_token text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=(SELECT auth.uid()); v public.leagues%ROWTYPE;
BEGIN
 IF who IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
 SELECT * INTO v FROM public.leagues WHERE id=p_league_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;
 IF v.finished_at IS NOT NULL THEN RAISE EXCEPTION 'Esta Liga está encerrada'; END IF;
 IF EXISTS(SELECT 1 FROM public.league_members WHERE league_id=p_league_id AND user_id=who) THEN RETURN 'member'; END IF;
 IF v.visibility='public' THEN
  INSERT INTO public.league_members(league_id,user_id,role) VALUES(p_league_id,who,'member') ON CONFLICT DO NOTHING;
  DELETE FROM public.league_requests WHERE league_id=p_league_id AND user_id=who;
  RETURN 'member';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.league_invites i WHERE i.league_id=p_league_id
  AND p_token IS NOT NULL AND length(p_token)=64 AND p_token ~ '^[a-f0-9]{64}$'
  AND i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) THEN
  RAISE EXCEPTION 'Convite inválido ou expirado';
 END IF;
 INSERT INTO public.league_requests(league_id,user_id,status,created_at,decided_at)
 VALUES(p_league_id,who,'pending',now(),NULL)
 ON CONFLICT(league_id,user_id) DO UPDATE SET status='pending',created_at=now(),decided_at=NULL;
 RETURN 'pending';
END; $$;
REVOKE ALL ON FUNCTION public.request_league_join(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_league_join(uuid,text) TO authenticated;

-- Admins are allowed to archive any League, without bypassing result consistency.
CREATE OR REPLACE FUNCTION app_private.admin_finish_league(p_league_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_owner uuid; v_actual uuid:=(SELECT auth.uid()); v_report jsonb;
BEGIN
 IF v_actual IS NULL OR NOT app_private.is_app_admin() THEN RAISE EXCEPTION 'Apenas administrador geral'; END IF;
 SELECT owner_id INTO v_owner FROM public.leagues WHERE id=p_league_id;
 IF v_owner IS NULL THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;
 -- Run the canonical close as the owner within the same transaction.
 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 BEGIN
  v_report:=public.finish_league(p_league_id);
 EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub',v_actual::text,true);
  RAISE;
 END;
 PERFORM set_config('request.jwt.claim.sub',v_actual::text,true);
 RETURN v_report;
END; $$;
REVOKE ALL ON FUNCTION app_private.admin_finish_league(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_finish_league(p_league_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT app_private.admin_finish_league(p_league_id);
$$;
REVOKE ALL ON FUNCTION public.admin_finish_league(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_finish_league(uuid) TO authenticated;
