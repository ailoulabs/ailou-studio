CREATE OR REPLACE FUNCTION public.sync_generation_worker_config(_secret text, _base_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NULLIF(btrim(_secret), '') IS NULL OR NULLIF(btrim(_base_url), '') IS NULL THEN
    RAISE EXCEPTION 'worker configuration is incomplete';
  END IF;

  INSERT INTO private.app_config(key, value)
  VALUES ('worker_secret', _secret), ('base_url', rtrim(_base_url, '/'))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_generation_worker_config(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_generation_worker_config(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_generation_worker_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT value FROM private.app_config WHERE key = 'worker_secret'
$$;

REVOKE ALL ON FUNCTION public.get_generation_worker_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_generation_worker_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.kick_generation_worker(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  PERFORM private.kick_generation_worker(_job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.kick_generation_worker(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_generation_worker(uuid) TO service_role;