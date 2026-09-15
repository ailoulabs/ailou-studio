-- 1. Unidades de geração: uma linha por trabalho, com posse por token.
CREATE TABLE public.generation_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  piece_id uuid REFERENCES public.pieces(id) ON DELETE CASCADE,
  kind text NOT NULL,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  status text NOT NULL DEFAULT 'fila',
  attempt integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.generation_units TO authenticated;
GRANT ALL ON public.generation_units TO service_role;

ALTER TABLE public.generation_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own units select" ON public.generation_units
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.generation_jobs j
   WHERE j.id = generation_units.job_id AND j.user_id = auth.uid()
));

CREATE TRIGGER generation_units_updated_at
BEFORE UPDATE ON public.generation_units
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX generation_units_job_idx ON public.generation_units (job_id, status);
CREATE INDEX generation_units_collection_idx ON public.generation_units (collection_id);
CREATE UNIQUE INDEX generation_units_dedupe_idx
  ON public.generation_units (collection_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('fila', 'rodando');

-- 2. Reserva atômica de unidades pelo processador.
CREATE OR REPLACE FUNCTION public.claim_generation_units(
  _job_id uuid, _limit integer, _token uuid, _lease_seconds integer, _kind text DEFAULT NULL
)
RETURNS SETOF public.generation_units
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
             OR (c.status = 'rodando' AND (c.lease_until IS NULL OR c.lease_until < now())))
      ORDER BY c.created_at
      LIMIT _limit
      FOR UPDATE SKIP LOCKED
   )
   RETURNING u.*;
$$;

REVOKE ALL ON FUNCTION public.claim_generation_units(uuid, integer, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_generation_units(uuid, integer, uuid, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_units(uuid, integer, uuid, integer, text) TO service_role;

-- 3. Renovação do prazo durante uma chamada longa.
CREATE OR REPLACE FUNCTION public.touch_generation_unit(_id uuid, _token uuid, _lease_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _job uuid;
BEGIN
  UPDATE public.generation_units
     SET lease_until = now() + make_interval(secs => _lease_seconds), updated_at = now()
   WHERE id = _id AND lease_token = _token
   RETURNING job_id INTO _job;
  IF _job IS NULL THEN RETURN false; END IF;
  UPDATE public.generation_jobs SET heartbeat_at = now() WHERE id = _job;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_generation_unit(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_generation_unit(uuid, uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_generation_unit(uuid, uuid, integer) TO service_role;

-- 4. Publicação do resultado: só quem tem o token grava.
CREATE OR REPLACE FUNCTION public.finish_generation_unit(
  _id uuid, _token uuid, _status text, _error text, _result jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _ok boolean := false;
BEGIN
  UPDATE public.generation_units
     SET status = _status,
         error = _error,
         result = COALESCE(_result, result),
         finished_at = CASE WHEN _status IN ('ok', 'erro', 'cancelada') THEN now() ELSE NULL END,
         lease_token = NULL,
         lease_until = NULL,
         updated_at = now()
   WHERE id = _id AND lease_token = _token;
  _ok := FOUND;
  RETURN _ok;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_generation_unit(uuid, uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_generation_unit(uuid, uuid, text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_generation_unit(uuid, uuid, text, text, jsonb) TO service_role;

-- 5. Parar a geração: só o dono, sem policy de escrita aberta.
CREATE OR REPLACE FUNCTION public.cancel_generation_job(_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _owner uuid;
BEGIN
  SELECT user_id INTO _owner FROM public.generation_jobs WHERE id = _job_id;
  IF _owner IS NULL OR auth.uid() IS NULL OR _owner <> auth.uid() THEN
    RETURN false;
  END IF;

  UPDATE public.generation_jobs SET cancel_requested = true WHERE id = _job_id;
  UPDATE public.generation_units
     SET status = 'cancelada', finished_at = now(), updated_at = now()
   WHERE job_id = _job_id AND status = 'fila';
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_generation_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_generation_job(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_generation_job(uuid) TO authenticated, service_role;

-- 6. Cadastro sem créditos de boas-vindas.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, phone)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), NEW.phone)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 7. A reconciliação antiga (com estorno) sai; o servidor faz esse trabalho agora.
DROP FUNCTION IF EXISTS public.reconcile_stuck_pieces(uuid);

-- 8. Varredura de segurança: janela de 24 horas.
CREATE OR REPLACE FUNCTION private.sweep_generation_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'private', 'public'
AS $$
DECLARE
  _job record;
  _open integer;
BEGIN
  SELECT count(*) INTO _open
    FROM public.generation_jobs
   WHERE status IN ('fila', 'rodando')
     AND created_at > now() - interval '24 hours';

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
       AND created_at > now() - interval '24 hours'
     ORDER BY created_at
     LIMIT 5
  LOOP
    PERFORM private.kick_generation_worker(_job.id);
  END LOOP;
END;
$$;