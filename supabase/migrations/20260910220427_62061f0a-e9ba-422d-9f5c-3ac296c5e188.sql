CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'fila',
  step text NOT NULL DEFAULT 'prancha',
  cancel_requested boolean NOT NULL DEFAULT false,
  plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  base_url text,
  heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.generation_jobs TO authenticated;
GRANT ALL ON public.generation_jobs TO service_role;

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own jobs select" ON public.generation_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX generation_jobs_collection_idx ON public.generation_jobs (collection_id, created_at DESC);
CREATE INDEX generation_jobs_open_idx ON public.generation_jobs (status, heartbeat_at);

CREATE TRIGGER generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.reconcile_stuck_pieces(_collection_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _count integer := 0;
  _piece record;
BEGIN
  SELECT user_id INTO _owner FROM public.collections WHERE id = _collection_id;
  IF _owner IS NULL THEN
    RETURN 0;
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> _owner THEN
    RETURN 0;
  END IF;

  FOR _piece IN
    SELECT id FROM public.pieces
    WHERE collection_id = _collection_id
      AND status = 'gerando'
      AND image_path IS NULL
      AND updated_at < now() - interval '10 minutes'
  LOOP
    UPDATE public.pieces
      SET status = 'erro',
          error = 'A geração foi interrompida. Crédito devolvido.'
      WHERE id = _piece.id;

    INSERT INTO public.credits_ledger (user_id, delta, reason, ref_collection_id, ref_piece_id)
    VALUES (_owner, 1, 'refund_interrupted', _collection_id, _piece.id);

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_pieces(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_stuck_pieces(uuid) TO authenticated, service_role;