-- Limpeza v7.5: funções antigas que o app não chama mais e que nenhuma outra
-- função ou política usa. As versões atuais seguem ativas
-- (get_league_catalog_final, get_league_ranking_v2, get_player_stats_v2,
-- record_chip_purchase_once/for, record_chip_cashout e o fluxo de acertos atual).
DROP FUNCTION IF EXISTS public.confirm_chip_payment(p_purchase_id uuid, p_paid boolean);
DROP FUNCTION IF EXISTS public.get_global_ranking(p_game text);
DROP FUNCTION IF EXISTS public.get_league_catalog();
DROP FUNCTION IF EXISTS public.get_league_catalog_premium();
DROP FUNCTION IF EXISTS public.get_league_ranking(p_league_id uuid);
DROP FUNCTION IF EXISTS public.get_player_stats(p_game text);
DROP FUNCTION IF EXISTS public.get_player_stats_period(p_game text, p_period text);
DROP FUNCTION IF EXISTS public.record_chip_final(p_event_id uuid, p_quantities jsonb);
DROP FUNCTION IF EXISTS public.record_chip_purchase(p_event_id uuid, p_quantities jsonb);
DROP FUNCTION IF EXISTS public.set_chip_payout(p_event_id uuid, p_user_id uuid, p_confirmed boolean);
DROP FUNCTION IF EXISTS public.set_expense_settled(p_expense_id uuid, p_user_id uuid, p_settled boolean);
