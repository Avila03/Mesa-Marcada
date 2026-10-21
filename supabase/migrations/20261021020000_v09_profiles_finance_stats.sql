-- Mesa Marcada v0.9 — perfis, revisão financeira e métricas.
-- Mantém todos os eventos, fichas e jogadores existentes.
-- Os valores em BRL são somente registros informativos, não pagamentos.

ALTER TABLE public.profiles
  ADD COLUMN avatar_symbol text NOT NULL DEFAULT '♠'
    CONSTRAINT profiles_avatar_symbol_check CHECK (avatar_symbol IN ('♠','♥','♦','♣','★','🎲','🃏','🎯')),
  ADD COLUMN favorite_game text NOT NULL DEFAULT 'poker'
    CONSTRAINT profiles_favorite_game_check CHECK (favorite_game IN ('poker','blackjack')),
  ADD COLUMN bio text NOT NULL DEFAULT ''
    CONSTRAINT profiles_bio_check CHECK (char_length(bio) <= 240);

-- A pessoa que pagou uma despesa pode ser distinta de quem a registrou.
ALTER TABLE public.session_expenses
  ADD COLUMN paid_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;
UPDATE public.session_expenses SET paid_by=created_by WHERE paid_by IS NULL;

CREATE OR REPLACE FUNCTION app_private.check_expense_payer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.paid_by IS NULL THEN NEW.paid_by:=NEW.created_by; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.session_attendance a
    WHERE a.session_id=NEW.session_id AND a.user_id=NEW.paid_by
  ) THEN
    RAISE EXCEPTION 'Quem pagou a despesa precisa estar confirmado no evento';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER expense_valid_payer_before_insert_update
BEFORE INSERT OR UPDATE OF paid_by,session_id ON public.session_expenses
FOR EACH ROW EXECUTE FUNCTION app_private.check_expense_payer();

-- Aprovacao individual pelo organizador (compras/recompras + resultado de fichas).
CREATE TABLE public.session_finance_approvals (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reviewed_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id,user_id),
  CONSTRAINT session_approval_attendance_fkey FOREIGN KEY(session_id,user_id)
    REFERENCES public.session_attendance(session_id,user_id) ON DELETE CASCADE
);
CREATE INDEX session_finance_approvals_reviewer_idx ON public.session_finance_approvals(reviewed_by);
ALTER TABLE public.session_finance_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY approvals_read_authorized ON public.session_finance_approvals
  FOR SELECT TO authenticated USING(app_private.can_view_session_private(session_id));
CREATE POLICY approvals_insert_organizer ON public.session_finance_approvals
  FOR INSERT TO authenticated WITH CHECK(
    reviewed_by=(SELECT auth.uid()) AND EXISTS(
      SELECT 1 FROM public.sessions s WHERE s.id=session_id
      AND s.organizer_id=(SELECT auth.uid()) AND s.status='scheduled'
    )
  );
CREATE POLICY approvals_delete_organizer ON public.session_finance_approvals
  FOR DELETE TO authenticated USING(
    reviewed_by=(SELECT auth.uid()) AND EXISTS(
      SELECT 1 FROM public.sessions s WHERE s.id=session_id
      AND s.organizer_id=(SELECT auth.uid()) AND s.status='scheduled'
    )
  );
REVOKE ALL ON public.session_finance_approvals FROM anon;
GRANT SELECT,INSERT,DELETE ON public.session_finance_approvals TO authenticated;

-- Não se pode aprovar alguém que ainda não registrou compras e fichas finais.
CREATE OR REPLACE FUNCTION app_private.check_finance_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=NEW.session_id
    AND s.status='scheduled' AND s.organizer_id=NEW.reviewed_by) THEN
    RAISE EXCEPTION 'Somente organizador pode aprovar registros enquanto evento está aberto';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p
      WHERE p.session_id=NEW.session_id AND p.user_id=NEW.user_id)
    OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f
      WHERE f.session_id=NEW.session_id AND f.user_id=NEW.user_id) THEN
    RAISE EXCEPTION 'Jogador ainda não registrou compras e fichas finais';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER check_finance_approval_before_insert
BEFORE INSERT ON public.session_finance_approvals
FOR EACH ROW EXECUTE FUNCTION app_private.check_finance_approval();

-- Qualquer alteração na contagem individual invalida aprovação anterior.
CREATE OR REPLACE FUNCTION app_private.invalidate_finance_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_session uuid; v_user uuid;
BEGIN
  IF TG_OP='DELETE' THEN v_session:=OLD.session_id;v_user:=OLD.user_id;
  ELSE v_session:=NEW.session_id;v_user:=NEW.user_id; END IF;
  DELETE FROM public.session_finance_approvals a
   WHERE a.session_id=v_session AND a.user_id=v_user;
  RETURN NULL;
END;
$$;
CREATE TRIGGER invalidate_on_purchase_change
AFTER INSERT OR UPDATE OR DELETE ON public.session_chip_purchases
FOR EACH ROW EXECUTE FUNCTION app_private.invalidate_finance_approval();
CREATE TRIGGER invalidate_on_result_change
AFTER INSERT OR UPDATE OR DELETE ON public.session_chip_results
FOR EACH ROW EXECUTE FUNCTION app_private.invalidate_finance_approval();

-- O evento só pode ser encerrado quando todos os confirmados tiverem
-- compras, resultado e aprovação do organizador.
CREATE OR REPLACE FUNCTION app_private.ensure_finance_before_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF OLD.status='scheduled' AND NEW.status='finished' THEN
    IF NOT EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=NEW.id) THEN
      RAISE EXCEPTION 'Confirme pelo menos um participante antes de encerrar';
    END IF;
    IF EXISTS(
      SELECT 1 FROM public.session_attendance a
      WHERE a.session_id=NEW.id AND (
        NOT EXISTS(SELECT 1 FROM public.session_chip_purchases p
          WHERE p.session_id=a.session_id AND p.user_id=a.user_id)
        OR NOT EXISTS(SELECT 1 FROM public.session_chip_results f
          WHERE f.session_id=a.session_id AND f.user_id=a.user_id)
        OR NOT EXISTS(SELECT 1 FROM public.session_finance_approvals v
          WHERE v.session_id=a.session_id AND v.user_id=a.user_id)
      )
    ) THEN
      RAISE EXCEPTION 'Há fichas ou aprovações pendentes; revise todos os jogadores antes de encerrar';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_financial_review_on_finish
BEFORE UPDATE OF status ON public.sessions
FOR EACH ROW EXECUTE FUNCTION app_private.ensure_finance_before_finish();

-- Rateio de despesas em centavos, distribuindo restos de divisão
-- deterministicamente entre os confirmados. Pago - quota = saldo.
CREATE OR REPLACE FUNCTION app_private.get_event_finances(p_event_id uuid)
RETURNS TABLE(
  user_id uuid, display_name text, avatar_symbol text,
  share_brl numeric, paid_brl numeric, balance_brl numeric,
  chips_bought bigint, chips_final bigint, delta_chips bigint,
  approved boolean, reviewed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH attendees AS (
 SELECT a.user_id,p.display_name,p.avatar_symbol,
   row_number() OVER(ORDER BY a.confirmed_at,a.user_id) AS rn,
   count(*) OVER() AS total_people
 FROM public.session_attendance a JOIN public.profiles p ON p.id=a.user_id
 WHERE a.session_id=p_event_id AND app_private.can_view_session_private(p_event_id)
), expense_totals AS (
 SELECT COALESCE(round(sum(e.amount_brl)*100)::bigint,0) AS total_cents
 FROM public.session_expenses e WHERE e.session_id=p_event_id
), purchases AS (
 SELECT b.user_id,sum(b.chips_received)::bigint AS chips_bought
 FROM public.session_chip_purchases b WHERE b.session_id=p_event_id GROUP BY b.user_id
), paid AS (
 SELECT e.paid_by AS user_id,sum(e.amount_brl)::numeric AS paid_brl
 FROM public.session_expenses e WHERE e.session_id=p_event_id GROUP BY e.paid_by
)
SELECT a.user_id,a.display_name,a.avatar_symbol,
 (floor(et.total_cents::numeric / a.total_people)
  +CASE WHEN a.rn <= mod(et.total_cents,a.total_people) THEN 1 ELSE 0 END)::numeric/100 AS share_brl,
 COALESCE(pa.paid_brl,0)::numeric AS paid_brl,
 (COALESCE(pa.paid_brl,0)-
  (floor(et.total_cents::numeric/a.total_people)
   +CASE WHEN a.rn <= mod(et.total_cents,a.total_people) THEN 1 ELSE 0 END)::numeric/100)::numeric AS balance_brl,
 b.chips_bought,
 f.chips_final,
 CASE WHEN b.chips_bought IS NULL OR f.chips_final IS NULL THEN NULL
   ELSE (f.chips_final-b.chips_bought)::bigint END AS delta_chips,
 (r.user_id IS NOT NULL) AS approved,
 r.reviewed_at
FROM attendees a
CROSS JOIN expense_totals et
LEFT JOIN purchases b ON b.user_id=a.user_id
LEFT JOIN paid pa ON pa.user_id=a.user_id
LEFT JOIN public.session_chip_results f ON f.session_id=p_event_id AND f.user_id=a.user_id
LEFT JOIN public.session_finance_approvals r ON r.session_id=p_event_id AND r.user_id=a.user_id
ORDER BY a.rn;
$$;
CREATE FUNCTION public.get_event_finances(p_event_id uuid)
RETURNS TABLE(
  user_id uuid, display_name text, avatar_symbol text,
  share_brl numeric, paid_brl numeric, balance_brl numeric,
  chips_bought bigint, chips_final bigint, delta_chips bigint,
  approved boolean, reviewed_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM app_private.get_event_finances(p_event_id); $$;
REVOKE ALL ON FUNCTION public.get_event_finances(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_event_finances(uuid) TO authenticated;
REVOKE ALL ON FUNCTION app_private.get_event_finances(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION app_private.get_event_finances(uuid) TO authenticated;

-- Estatísticas agregadas, sem publicar valores em BRL.
-- Exclui eventos não encerrados ou incompletos/sem revisão.
CREATE OR REPLACE FUNCTION app_private.get_player_stats(p_game text DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,display_name text,avatar_symbol text,game text,
  sessions_played bigint,net_chips bigint,best_event_chips bigint,
  avg_chips numeric,avg_yield_pct numeric,last_played_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH bought AS (
 SELECT b.session_id,b.user_id,sum(b.chips_received)::bigint AS chips
 FROM public.session_chip_purchases b GROUP BY b.session_id,b.user_id
), eligible AS (
 SELECT s.id,s.starts_at,r.game
 FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
 WHERE (SELECT auth.uid()) IS NOT NULL
   AND s.status='finished' AND (p_game IS NULL OR r.game=p_game)
   AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=s.id)>=1
   AND NOT EXISTS (
     SELECT 1 FROM public.session_attendance a
     LEFT JOIN bought b ON b.session_id=a.session_id AND b.user_id=a.user_id
     LEFT JOIN public.session_chip_results f
       ON f.session_id=a.session_id AND f.user_id=a.user_id
     LEFT JOIN public.session_finance_approvals v
       ON v.session_id=a.session_id AND v.user_id=a.user_id
     WHERE a.session_id=s.id
       AND (b.user_id IS NULL OR f.user_id IS NULL OR v.user_id IS NULL)
   )
), scores AS (
 SELECT a.user_id,e.game,e.starts_at,
   (f.chips_final-b.chips)::bigint AS net,
   (f.chips_final-b.chips)::numeric/nullif(b.chips,0)*100 AS yield_pct
 FROM eligible e
 JOIN public.session_attendance a ON a.session_id=e.id
 JOIN bought b ON b.session_id=e.id AND b.user_id=a.user_id
 JOIN public.session_chip_results f ON f.session_id=e.id AND f.user_id=a.user_id
)
SELECT p.id,p.display_name,p.avatar_symbol,s.game,
 count(*)::bigint,sum(s.net)::bigint,max(s.net)::bigint,
 round(avg(s.net)::numeric,1),round(avg(s.yield_pct),1),max(s.starts_at)
FROM scores s JOIN public.profiles p ON p.id=s.user_id
GROUP BY p.id,p.display_name,p.avatar_symbol,s.game
ORDER BY round(avg(s.yield_pct),1) DESC, sum(s.net) DESC;
$$;
CREATE FUNCTION public.get_player_stats(p_game text DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,display_name text,avatar_symbol text,game text,
  sessions_played bigint,net_chips bigint,best_event_chips bigint,
  avg_chips numeric,avg_yield_pct numeric,last_played_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM app_private.get_player_stats(p_game); $$;
REVOKE ALL ON FUNCTION public.get_player_stats(text) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_player_stats(text) TO authenticated;
REVOKE ALL ON FUNCTION app_private.get_player_stats(text) FROM public,anon;
GRANT EXECUTE ON FUNCTION app_private.get_player_stats(text) TO authenticated;

-- Funções de triggers internas não devem ser chamadas diretamente por usuários.
REVOKE ALL ON FUNCTION app_private.check_finance_approval() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION app_private.invalidate_finance_approval() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION app_private.ensure_finance_before_finish() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION app_private.check_expense_payer() FROM public,anon,authenticated;
