ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS motif_sheet_path text,
  ADD COLUMN IF NOT EXISTS motifs jsonb NOT NULL DEFAULT '[]'::jsonb;
