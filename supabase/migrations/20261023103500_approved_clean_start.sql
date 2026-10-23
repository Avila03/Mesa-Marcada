-- One-time authorized clean start for Mesa Marcada.
-- Preserves auth.users, profiles, app_admins, rooms, leagues and league_members.
-- Removes old sessions and every dependent event/finance/audit row.
TRUNCATE TABLE public.sessions,
 public.league_requests,
 public.league_notifications,
 app_private.league_push_cooldowns,
 app_private.league_final_reports
 RESTART IDENTITY CASCADE;
UPDATE public.leagues SET finished_at=NULL WHERE finished_at IS NOT NULL;
