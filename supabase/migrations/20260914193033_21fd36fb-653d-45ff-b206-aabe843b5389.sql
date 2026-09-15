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
    body := jsonb_build_object('jobId', _job_id, 'workerSecret', _secret),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', _secret,
      'Authorization', 'Bearer ' || _secret
    ),
    timeout_milliseconds := 5000
  );
END;
$$;
