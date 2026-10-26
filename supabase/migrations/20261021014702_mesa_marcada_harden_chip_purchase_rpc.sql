-- Move a operação transacional privilegiada para app_private.
-- A API pública recebe uma função SECURITY INVOKER; privilégios elevados
-- permanecem somente na função privada, que valida auth.uid() e presença.
ALTER FUNCTION public.record_chip_purchase(uuid,jsonb) SET SCHEMA app_private;
REVOKE ALL ON FUNCTION app_private.record_chip_purchase(uuid,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION app_private.record_chip_purchase(uuid,jsonb) TO authenticated;

CREATE FUNCTION public.record_chip_purchase(p_event_id uuid,p_quantities jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$
  SELECT app_private.record_chip_purchase(p_event_id,p_quantities);
$$;
REVOKE ALL ON FUNCTION public.record_chip_purchase(uuid,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_chip_purchase(uuid,jsonb) TO authenticated;
