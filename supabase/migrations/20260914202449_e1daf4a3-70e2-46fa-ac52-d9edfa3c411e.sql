DROP FUNCTION IF EXISTS public.claim_generation_units(uuid, integer, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.claim_generation_units(
  _job_id uuid,
  _limit integer,
  _token uuid,
  _lease_seconds integer,
  _kind text DEFAULT NULL,
  _max_attempts integer DEFAULT 2
)
RETURNS SETOF public.generation_units
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Unidade cuja posse venceu e que já esgotou as tentativas vira erro definitivo.
  UPDATE public.generation_units u
     SET status = 'erro',
         error = COALESCE(NULLIF(u.error, ''), 'A geração foi interrompida no servidor. Tente de novo.'),
         finished_at = now(),
         lease_token = NULL,
         lease_until = NULL,
         updated_at = now()
   WHERE u.job_id = _job_id
     AND u.status = 'rodando'
     AND (u.lease_until IS NULL OR u.lease_until < now())
     AND u.attempt >= _max_attempts;

  RETURN QUERY
  UPDATE public.generation_units u
     SET status = 'rodando',
         lease_token = _token,
         lease_until = now() + make_interval(secs => _lease_seconds),
         attempt = u.attempt + 1,
         started_at = COALESCE(u.started_at, now()),
         updated_at = now()
   WHERE u.id IN (
     SELECT c.id FROM public.generation_units c
      WHERE c.job_id = _job_id
        AND (_kind IS NULL OR c.kind = _kind)
        AND (c.status = 'fila'
             OR (c.status = 'rodando'
                 AND (c.lease_until IS NULL OR c.lease_until < now())
                 AND c.attempt < _max_attempts))
      ORDER BY c.created_at
      LIMIT _limit
      FOR UPDATE SKIP LOCKED
   )
   RETURNING u.*;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_generation_units(uuid, integer, uuid, integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_units(uuid, integer, uuid, integer, text, integer) TO service_role;
