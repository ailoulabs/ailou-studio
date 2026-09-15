UPDATE public.applications
SET params = jsonb_build_object(
      'bands', 5,
      'bandHeightCm', 9,
      'borderPosition', 'bottom',
      'bandHeightsCm', jsonb_build_array(9,9,9,9,9),
      'trimCm', 1,
      'trimStyle', 'renda',
      'grounds', jsonb_build_array('creme','clara','creme','cheia','creme'),
      'marginCm', 0.5
    ),
    description = 'Corte de 50 × 150 cheio de faixas ilustradas para recortar e costurar.',
    director_rules = 'Descreva faixa por faixa, de cima para baixo: o tema de cada uma, o fundo e a barrinha que separa uma da outra. Cada faixa é independente, com os motivos em fileira, e se repete da esquerda para a direita sem cortar nenhum desenho. Mesma paleta e mesmo jeito de pintar em todas.',
    updated_at = now()
WHERE id = 'barrado-multiplo';

UPDATE public.applications
SET params = jsonb_build_object(
      'bands', 1,
      'bandHeightCm', 15,
      'borderPosition', 'bottom',
      'trimCm', 1.2,
      'trimStyle', 'renda',
      'borderHeightCm', 15
    ),
    description = 'Um corte com uma borda decorada de 15 cm na base e área calma acima.',
    director_rules = 'Borda decorada de cerca de 15 cm na base, em duas camadas: a faixa principal de motivos e, logo acima dela, uma barrinha estreita de acabamento. Acima fica uma área calma quase lisa. A repetição se resolve na horizontal, sem motivo cortado nas laterais.',
    updated_at = now()
WHERE id = 'barrado-unico';

INSERT INTO public.kits (usage, name, application_ids, sort_order)
VALUES ('barrado', 'Barrado', ARRAY['barrado-multiplo','barrado-unico','estampa-principal','xadrez-coordenado','poa-delicado'], 25)
ON CONFLICT (usage) DO UPDATE
SET name = EXCLUDED.name,
    application_ids = EXCLUDED.application_ids,
    updated_at = now();