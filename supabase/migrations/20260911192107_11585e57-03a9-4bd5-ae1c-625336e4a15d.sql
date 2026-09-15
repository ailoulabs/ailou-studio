CREATE TABLE public.piece_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES public.pieces(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'variante',
  label text NOT NULL DEFAULT '',
  image_path text NOT NULL,
  seam jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT piece_versions_kind_check CHECK (kind IN ('original','conserto','alta_fidelidade','ampliacao','variante'))
);

CREATE INDEX piece_versions_piece_idx ON public.piece_versions(piece_id, created_at DESC);
CREATE INDEX piece_versions_collection_idx ON public.piece_versions(collection_id);
CREATE UNIQUE INDEX piece_versions_label_idx ON public.piece_versions(piece_id, kind, label) WHERE label <> '';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.piece_versions TO authenticated;
GRANT ALL ON public.piece_versions TO service_role;

ALTER TABLE public.piece_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own piece versions" ON public.piece_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = piece_versions.collection_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = piece_versions.collection_id AND c.user_id = auth.uid()));

CREATE TRIGGER piece_versions_updated_at BEFORE UPDATE ON public.piece_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
