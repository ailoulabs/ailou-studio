ALTER TABLE public.pieces ADD COLUMN IF NOT EXISTS timings jsonb;

UPDATE public.applications
SET description = 'Poá clássico: bolinhas lisas e sólidas, como o poá de tricoline das lojas',
    updated_at = now()
WHERE slug = 'poa-classico';
