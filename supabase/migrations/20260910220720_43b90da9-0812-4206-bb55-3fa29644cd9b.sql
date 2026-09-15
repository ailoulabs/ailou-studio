-- lovable-cron-fallback-reviewed: 1440 runs/day; armed on enqueue and unscheduled on drain; 1 minute is the maximum acceptable delay to resume an interrupted image job.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

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
  IF _base IS NULL OR _secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := _base || '/api/public/generation-worker',
    body := jsonb_build_object('jobId', _job_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', _secret),
    timeout_milliseconds := 5000
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.sweep_generation_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  _job record;
  _open integer;
BEGIN
  SELECT count(*) INTO _open
    FROM public.generation_jobs
   WHERE status IN ('fila', 'rodando')
     AND created_at > now() - interval '2 hours';

  IF _open = 0 THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-generation-jobs') THEN
      PERFORM cron.unschedule('sweep-generation-jobs');
    END IF;
    RETURN;
  END IF;

  FOR _job IN
    SELECT id FROM public.generation_jobs
     WHERE status IN ('fila', 'rodando')
       AND (heartbeat_at IS NULL OR heartbeat_at < now() - interval '2 minutes')
       AND created_at > now() - interval '2 hours'
     ORDER BY created_at
     LIMIT 5
  LOOP
    PERFORM private.kick_generation_worker(_job.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.arm_generation_sweeper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-generation-jobs') THEN
    PERFORM cron.schedule('sweep-generation-jobs', '* * * * *', 'SELECT private.sweep_generation_jobs()');
  END IF;
END;
$$;
