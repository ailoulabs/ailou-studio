ALTER TABLE public.pieces ADD COLUMN IF NOT EXISTS image_print_path text;
ALTER TABLE public.pieces ADD COLUMN IF NOT EXISTS print_dpi integer;
ALTER TABLE public.pieces ADD COLUMN IF NOT EXISTS made_by text NOT NULL DEFAULT 'ia';
ALTER TABLE public.pieces ADD COLUMN IF NOT EXISTS composition jsonb;
ALTER TABLE public.pieces ADD COLUMN IF NOT EXISTS free_retry_used boolean NOT NULL DEFAULT false;