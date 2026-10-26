-- Use explicit INSERT/UPDATE branches so OLD is never touched on INSERT.
CREATE OR REPLACE FUNCTION app_private.notify_league_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_owner uuid;
BEGIN
 SELECT owner_id INTO target_owner FROM public.leagues WHERE id=NEW.league_id;
 IF target_owner IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.status='pending' THEN
     INSERT INTO public.league_notifications(league_id,recipient_id,actor_id,kind)
     VALUES(NEW.league_id,target_owner,NEW.user_id,'join_request');
   END IF;
 ELSE
   IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status='pending' THEN
     INSERT INTO public.league_notifications(league_id,recipient_id,actor_id,kind)
     VALUES(NEW.league_id,target_owner,NEW.user_id,'join_request');
   ELSIF OLD.status='pending' AND NEW.status IN ('approved','rejected') THEN
     INSERT INTO public.league_notifications(league_id,recipient_id,actor_id,kind)
     VALUES(NEW.league_id,NEW.user_id,target_owner,
      CASE WHEN NEW.status='approved' THEN 'join_approved' ELSE 'join_rejected' END);
   END IF;
 END IF;
 RETURN NEW;
END; $$;
