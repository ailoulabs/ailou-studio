DROP FUNCTION IF EXISTS public.admin_list_users();
DROP FUNCTION IF EXISTS public.admin_grant_admin(uuid);

CREATE OR REPLACE FUNCTION private.admin_list_users()
RETURNS TABLE (user_id uuid, email text, created_at timestamptz, is_admin boolean, balance integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id,
         u.email::text,
         u.created_at,
         EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin'),
         COALESCE((SELECT SUM(c.delta)::int FROM public.credits_ledger c WHERE c.user_id = u.id), 0)
  FROM auth.users u
  ORDER BY u.created_at DESC
  LIMIT 200
$$;

REVOKE ALL ON FUNCTION private.admin_list_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.admin_list_users() TO service_role;