-- Permite somente ao Administrador restaurar o status 'scheduled' de
-- evento ocultado enquanto era agendado. Todos os outros eventos
-- finalizados/cancelados permanecem imutáveis.
CREATE OR REPLACE FUNCTION public.protect_session_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
DECLARE v_count integer; v_safe_admin_restore boolean:=false;
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.room_id IS DISTINCT FROM OLD.room_id
 OR NEW.organizer_id IS DISTINCT FROM OLD.organizer_id
 OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
   RAISE EXCEPTION 'Identidade da sessão não pode ser modificada';
 END IF;
 IF NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
   RAISE EXCEPTION 'Alteração de data exige reconfirmação; recurso ainda não implementado';
 END IF;
 IF OLD.status<>'scheduled' AND NEW IS DISTINCT FROM OLD THEN
   v_safe_admin_restore:=
     OLD.status='cancelled' AND NEW.status='scheduled'
     AND app_private.is_app_admin()
     AND EXISTS(SELECT 1 FROM public.admin_hidden_events h
       WHERE h.session_id=OLD.id AND h.previous_status='scheduled');
   IF NOT v_safe_admin_restore THEN
     RAISE EXCEPTION 'Sessão finalizada/cancelada é imutável';
   END IF;
 END IF;
 SELECT count(*) INTO v_count FROM public.session_attendance a WHERE a.session_id=NEW.id;
 IF NEW.max_participants<v_count THEN
   RAISE EXCEPTION 'Limite menor que confirmações existentes';
 END IF;
 RETURN NEW;
END;
$$;