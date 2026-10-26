ALTER TABLE public.event_change_notices
 ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION app_private.notify_event_details_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fields text[]:=ARRAY[]::text[];
BEGIN
 IF NEW.title IS DISTINCT FROM OLD.title THEN fields:=array_append(fields,'nome'); END IF;
 IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN fields:=array_append(fields,'data/horário'); END IF;
 IF NEW.location IS DISTINCT FROM OLD.location THEN fields:=array_append(fields,'local'); END IF;
 IF NEW.min_entry_brl IS DISTINCT FROM OLD.min_entry_brl THEN fields:=array_append(fields,'entrada'); END IF;
 IF NEW.max_participants IS DISTINCT FROM OLD.max_participants THEN fields:=array_append(fields,'vagas'); END IF;
 IF NEW.chip_pricing_special IS DISTINCT FROM OLD.chip_pricing_special OR
  NEW.chip_price_1_brl IS DISTINCT FROM OLD.chip_price_1_brl OR
  NEW.chip_price_5_brl IS DISTINCT FROM OLD.chip_price_5_brl OR
  NEW.chip_price_10_brl IS DISTINCT FROM OLD.chip_price_10_brl OR
  NEW.chip_price_25_brl IS DISTINCT FROM OLD.chip_price_25_brl OR
  NEW.chip_price_50_brl IS DISTINCT FROM OLD.chip_price_50_brl
 THEN fields:=array_append(fields,'fichas'); END IF;
 IF cardinality(fields)=0 THEN RETURN NEW; END IF;
 INSERT INTO public.event_change_notices(event_id,recipient_id,changed_fields,edited_by)
 SELECT NEW.id,rec.user_id,fields,(SELECT auth.uid()) FROM (
  SELECT a.user_id FROM public.session_attendance a WHERE a.session_id=NEW.id
  UNION SELECT i.user_id FROM public.event_invite_members i WHERE i.session_id=NEW.id
  UNION SELECT m.user_id FROM public.league_members m WHERE m.league_id=NEW.league_id
 ) rec WHERE rec.user_id<>NEW.organizer_id LIMIT 500;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.claim_event_push_targets(p_event_id uuid, p_kind text, p_server_secret text)
 RETURNS TABLE(endpoint text, p256dh text, auth_key text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 actor uuid:=(SELECT auth.uid());
 old_time timestamptz;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF p_server_secret IS NULL OR length(p_server_secret)<40 OR
 NOT EXISTS(SELECT 1 FROM app_private.push_server_auth a
  WHERE a.secret_hash=encode(extensions.digest(p_server_secret,'sha256'),'hex'))
 THEN RAISE EXCEPTION 'Entrega não autorizada'; END IF;
 IF p_kind NOT IN ('poll','live','summary','edit')
 THEN RAISE EXCEPTION 'Notificação não autorizada'; END IF;
 IF p_kind='edit' AND NOT EXISTS(
  SELECT 1 FROM public.event_change_notices n
  WHERE n.event_id=p_event_id AND n.edited_by=actor AND n.created_at>now()-interval '5 minutes'
 ) THEN RAISE EXCEPTION 'Não existe alteração recente para notificar'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s
  WHERE s.id=p_event_id AND NOT app_private.is_event_hidden(s.id)
  AND (s.organizer_id=actor OR app_private.is_app_admin())
 ) THEN RAISE EXCEPTION 'Somente o anfitrião pode enviar avisos'; END IF;
 INSERT INTO app_private.push_notice_cooldowns(session_id,actor_id,kind,sent_at)
 VALUES(p_event_id,actor,p_kind,now())
 ON CONFLICT(session_id,actor_id,kind) DO UPDATE
 SET sent_at=excluded.sent_at
 WHERE app_private.push_notice_cooldowns.sent_at <now()-interval '30 seconds';
 IF NOT FOUND THEN RAISE EXCEPTION 'Espere alguns segundos para enviar outro aviso'; END IF;
 RETURN QUERY
 SELECT p.endpoint,p.p256dh,p.auth_key FROM public.push_subscriptions p
 WHERE p.user_id<>actor
 AND p.user_id IN(
   SELECT a.user_id FROM public.session_attendance a WHERE a.session_id=p_event_id
   UNION SELECT m.user_id FROM public.event_invite_members m WHERE m.session_id=p_event_id
   UNION SELECT lm.user_id FROM public.league_members lm JOIN public.sessions s ON s.league_id=lm.league_id WHERE s.id=p_event_id AND p_kind='edit'
 )
 LIMIT 200;
END; $function$;
