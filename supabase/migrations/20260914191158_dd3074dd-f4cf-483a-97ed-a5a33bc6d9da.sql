CREATE OR REPLACE FUNCTION public.sync_generation_worker_config(_secret text, _base_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  _secret text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT value INTO _secret FROM private.app_config WHERE key = 'worker_secret';
  RETURN _secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_generation_worker_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_generation_worker_secret() TO service_role;

CREATE OR REPLACE FUNCTION private.kick_generation_worker(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  _base text;
  _secret text;
BEGIN
  SELECT COALESCE(j.base_url, (SELECT value FROM private.app_config WHERE key = 'base_url'))
    INTO _base
    FROM public.generation_jobs j WHERE j.id = _job_id;
  SELECT value INTO _secret FROM private.app_config WHERE key = 'worker_secret';
  IF NULLIF(btrim(_base), '') IS NULL OR NULLIF(btrim(_secret), '') IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(_base, '/') || '/api/public/generation-worker',
    body := jsonb_build_object('jobId', _job_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', _secret),
    timeout_milliseconds := 5000
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kick_generation_worker(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM private.kick_generation_worker(_job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.kick_generation_worker(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_generation_worker(uuid) TO service_role;