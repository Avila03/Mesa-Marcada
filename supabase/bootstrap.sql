-- Initial project setup only. Supabase supplies auth.users before application migrations.
-- No administrator is granted automatically. Provision owners through a trusted SQL session.
CREATE TABLE IF NOT EXISTS public.app_admins(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admins FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.app_admins TO authenticated;
DROP POLICY IF EXISTS app_admins_read_self ON public.app_admins;
CREATE POLICY app_admins_read_self ON public.app_admins FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
