-- Admin close was accidentally exposed through a SECURITY INVOKER wrapper
-- which couldn't execute the restricted private function. Enforce the same
-- authorization at both layers and keep the private helper ungranted.
CREATE OR REPLACE FUNCTION public.admin_finish_league(p_league_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT app_private.is_app_admin() THEN
  RAISE EXCEPTION 'Apenas administrador geral pode finalizar esta Liga';
 END IF;
 RETURN app_private.admin_finish_league(p_league_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_finish_league(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_finish_league(uuid) TO authenticated;
