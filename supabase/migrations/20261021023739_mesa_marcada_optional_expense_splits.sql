-- Mesa Marcada v1.1 — racha voluntário por despesa.
-- Fichas permanecem independentes. Nenhuma cobrança real é processada.
-- Lançamentos já existentes continuam disponíveis, sem participantes
-- automáticos: uma despesa só gera dívida se alguém optar por "Rachar".

ALTER TABLE public.session_expenses
  ADD COLUMN split_open boolean NOT NULL DEFAULT true;

CREATE TABLE public.expense_split_members (
  expense_id uuid NOT NULL REFERENCES public.session_expenses(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(expense_id,user_id),
  CONSTRAINT split_member_attendance FOREIGN KEY(session_id,user_id)
    REFERENCES public.session_attendance(session_id,user_id) ON DELETE CASCADE
);
CREATE INDEX expense_split_by_event_user
  ON public.expense_split_members(session_id,user_id);

ALTER TABLE public.expense_split_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.expense_split_members FROM anon;
GRANT SELECT ON TABLE public.expense_split_members TO authenticated;

CREATE POLICY split_members_view ON public.expense_split_members FOR SELECT
TO authenticated USING(app_private.can_view_session_private(session_id));

-- Escreve por RPC autenticada e verificada no servidor. Não habilita
-- inserções/alterações diretas de outros participantes.
CREATE FUNCTION app_private.set_expense_split_membership(
  p_expense_id uuid,p_join boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_expense public.session_expenses%ROWTYPE;
        v_event_status text;
        v_user uuid;
BEGIN
  v_user:=auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  SELECT * INTO v_expense FROM public.session_expenses e
    WHERE e.id=p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  SELECT status INTO v_event_status FROM public.sessions
    WHERE id=v_expense.session_id;
  IF v_event_status<>'scheduled' THEN
    RAISE EXCEPTION 'Não é possível alterar o racha após o encerramento';
  END IF;
  IF NOT v_expense.split_open THEN
    RAISE EXCEPTION 'O racha desta despesa está fechado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.session_attendance a
    WHERE a.session_id=v_expense.session_id AND a.user_id=v_user
  ) THEN
    RAISE EXCEPTION 'Confirme presença no evento antes de participar do racha';
  END IF;
  IF p_join THEN
    INSERT INTO public.expense_split_members(expense_id,session_id,user_id)
    VALUES(p_expense_id,v_expense.session_id,v_user)
    ON CONFLICT (expense_id,user_id) DO NOTHING;
  ELSE
    DELETE FROM public.expense_split_members m
    WHERE m.expense_id=p_expense_id AND m.user_id=v_user;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION app_private.set_expense_split_membership(uuid,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.set_expense_split_membership(uuid,boolean)
  TO authenticated;
CREATE FUNCTION public.set_expense_split_membership(
  p_expense_id uuid,p_join boolean
) RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT app_private.set_expense_split_membership(p_expense_id,p_join); $$;
REVOKE ALL ON FUNCTION public.set_expense_split_membership(uuid,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_expense_split_membership(uuid,boolean)
  TO authenticated;

-- Organização opcional do anfitrião ou criador da despesa:
-- fechar evita entradas/saídas e congela o rateio existente.
CREATE FUNCTION app_private.set_expense_split_open(
  p_expense_id uuid,p_open boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_session uuid;v_author uuid;v_status text;v_host uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT e.session_id,e.created_by,s.status,s.organizer_id
  INTO v_session,v_author,v_status,v_host
  FROM public.session_expenses e JOIN public.sessions s ON s.id=e.session_id
  WHERE e.id=p_expense_id FOR UPDATE OF e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Despesa não encontrada'; END IF;
  IF v_status<>'scheduled' OR
    (v_author IS DISTINCT FROM (SELECT auth.uid())
     AND v_host IS DISTINCT FROM (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Somente o criador ou Anfitrião pode alterar este racha enquanto aberto';
  END IF;
  UPDATE public.session_expenses SET split_open=p_open WHERE id=p_expense_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION app_private.set_expense_split_open(uuid,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.set_expense_split_open(uuid,boolean)
  TO authenticated;
CREATE FUNCTION public.set_expense_split_open(
  p_expense_id uuid,p_open boolean
) RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT app_private.set_expense_split_open(p_expense_id,p_open); $$;
REVOKE ALL ON FUNCTION public.set_expense_split_open(uuid,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_expense_split_open(uuid,boolean)
  TO authenticated;

-- O banco distribui os centavos sem perder dinheiro.
-- Ex.: 100,00/3 => 33,34 + 33,33 + 33,33.
CREATE FUNCTION app_private.get_expense_split_shares(p_event_id uuid)
RETURNS TABLE(
  expense_id uuid,session_id uuid,user_id uuid,paid_by uuid,
  label text,category text,amount_brl numeric,share_brl numeric,joined_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH numbered AS (
 SELECT e.id AS expense_id,e.session_id,m.user_id,e.paid_by,
        e.label,e.category,e.amount_brl,m.joined_at,
        row_number() OVER(PARTITION BY e.id ORDER BY m.joined_at,m.user_id) AS rn,
        count(*) OVER(PARTITION BY e.id) AS cnt,
        round(e.amount_brl*100)::bigint AS cents
 FROM public.session_expenses e
 JOIN public.expense_split_members m ON m.expense_id=e.id AND m.session_id=e.session_id
 WHERE e.session_id=p_event_id
   AND (SELECT auth.uid()) IS NOT NULL
   AND app_private.can_view_session_private(p_event_id)
)
SELECT x.expense_id,x.session_id,x.user_id,x.paid_by,
       x.label,x.category,x.amount_brl,
       (floor(x.cents::numeric/x.cnt)
        + CASE WHEN x.rn <= mod(x.cents,x.cnt) THEN 1 ELSE 0 END)::numeric/100,
       x.joined_at
FROM numbered x;
$$;
REVOKE ALL ON FUNCTION app_private.get_expense_split_shares(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_expense_split_shares(uuid) TO authenticated;
CREATE FUNCTION public.get_expense_split_shares(p_event_id uuid)
RETURNS TABLE(
  expense_id uuid,session_id uuid,user_id uuid,paid_by uuid,
  label text,category text,amount_brl numeric,share_brl numeric,joined_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM app_private.get_expense_split_shares(p_event_id); $$;
REVOKE ALL ON FUNCTION public.get_expense_split_shares(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_expense_split_shares(uuid) TO authenticated;

-- Visão do próprio perfil: quanto devo ou quanto tenho a receber,
-- com pagamento efetuado a quem registrou ter arcado com a despesa.
CREATE FUNCTION app_private.get_my_expense_splits()
RETURNS TABLE(
  expense_id uuid,session_id uuid,event_title text,paid_by uuid,
  user_id uuid,label text,category text,amount_brl numeric,share_brl numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH relevant_events AS (
 SELECT DISTINCT e.session_id
 FROM public.session_expenses e
 JOIN public.expense_split_members m ON m.expense_id=e.id
 WHERE (SELECT auth.uid()) IS NOT NULL
  AND (m.user_id=(SELECT auth.uid()) OR e.paid_by=(SELECT auth.uid()))
), shares AS (
 SELECT r.*
 FROM relevant_events v
 CROSS JOIN LATERAL app_private.get_expense_split_shares(v.session_id) r
)
SELECT r.expense_id,r.session_id,s.title,r.paid_by,
       r.user_id,r.label,r.category,r.amount_brl,r.share_brl
FROM shares r JOIN public.sessions s ON s.id=r.session_id
WHERE r.user_id=(SELECT auth.uid()) OR r.paid_by=(SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION app_private.get_my_expense_splits() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_my_expense_splits() TO authenticated;
CREATE FUNCTION public.get_my_expense_splits()
RETURNS TABLE(
  expense_id uuid,session_id uuid,event_title text,paid_by uuid,
  user_id uuid,label text,category text,amount_brl numeric,share_brl numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM app_private.get_my_expense_splits(); $$;
REVOKE ALL ON FUNCTION public.get_my_expense_splits() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_expense_splits() TO authenticated;

-- Atualiza o financeiro existente: passa a usar SOMENTE os integrantes
-- voluntários de cada despesa, sem cobrar participantes não aderentes.
CREATE OR REPLACE FUNCTION app_private.get_event_finances(p_event_id uuid)
RETURNS TABLE (
  user_id uuid, display_name text, avatar_symbol text,
  share_brl numeric,paid_brl numeric,balance_brl numeric,
  chips_bought bigint,chips_final bigint,delta_chips bigint,
  approved boolean,reviewed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH attendees AS (
 SELECT a.user_id,p.display_name,p.avatar_symbol,
   row_number() OVER(ORDER BY a.confirmed_at,a.user_id) AS rn
 FROM public.session_attendance a JOIN public.profiles p ON p.id=a.user_id
 WHERE a.session_id=p_event_id AND app_private.can_view_session_private(p_event_id)
), shares AS (
 SELECT * FROM app_private.get_expense_split_shares(p_event_id)
), share_by_person AS (
 SELECT user_id,sum(share_brl)::numeric AS share_brl
 FROM shares GROUP BY user_id
), paid_expenses AS (
 SELECT expense_id,paid_by,MAX(amount_brl)::numeric AS amount_brl
 FROM shares GROUP BY expense_id,paid_by
), paid_by_person AS (
 SELECT paid_by AS user_id,sum(amount_brl)::numeric AS paid_brl
 FROM paid_expenses GROUP BY paid_by
), purchased AS (
 SELECT b.user_id,sum(b.chips_received)::bigint AS chips_bought
 FROM public.session_chip_purchases b WHERE b.session_id=p_event_id GROUP BY b.user_id
)
SELECT a.user_id,a.display_name,a.avatar_symbol,
 COALESCE(sh.share_brl,0)::numeric AS share_brl,
 COALESCE(pa.paid_brl,0)::numeric AS paid_brl,
 (COALESCE(pa.paid_brl,0)-COALESCE(sh.share_brl,0))::numeric AS balance_brl,
 b.chips_bought,f.chips_final,
 CASE WHEN b.chips_bought IS NULL OR f.chips_final IS NULL THEN NULL
  ELSE (f.chips_final-b.chips_bought)::bigint END AS delta_chips,
 (r.user_id IS NOT NULL) AS approved,r.reviewed_at
FROM attendees a
LEFT JOIN share_by_person sh ON sh.user_id=a.user_id
LEFT JOIN paid_by_person pa ON pa.user_id=a.user_id
LEFT JOIN purchased b ON b.user_id=a.user_id
LEFT JOIN public.session_chip_results f ON f.session_id=p_event_id AND f.user_id=a.user_id
LEFT JOIN public.session_finance_approvals r ON r.session_id=p_event_id AND r.user_id=a.user_id
ORDER BY a.rn;
$$;
