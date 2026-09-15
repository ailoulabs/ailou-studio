UPDATE public.applications SET
  description = 'Bolinhas brancas miúdas em fundo de cor cheia, o poá clássico da tricoline.',
  director_rules = 'Fundo em cor cheia e saturada da paleta, nunca branco. Bolinhas em branco #FFFFFF, creme #FFF6E5 ou um tom 45% mais claro do fundo. Bolinhas redondas de 2 mm em reticulado losangular com 9 mm até o vizinho mais próximo. Escreva background color: #RRGGBB e dot color: #RRGGBB. Sem motivos florais, sem aquarela.',
  params = '{"rapportCm":10,"layout":"dots","dotVariant":"classic","dotMm":2,"nnMm":9,"grid":"diamond"}'::jsonb
WHERE id = 'poa-delicado';

UPDATE public.applications SET
  description = 'Bolinhas de 1,5 mm em cor cheia sobre fundo claro, em reticulado losangular.',
  director_rules = 'Aqui a regra inverte: fundo na cor clara da paleta e bolinhas na cor cheia, com contraste nítido, nunca off-white sobre claro. Bolinhas de 1,5 mm em reticulado losangular com 7 mm até o vizinho mais próximo. Escreva background color: #RRGGBB e dot color: #RRGGBB. Sem aquarela.',
  params = '{"rapportCm":10,"layout":"dots","dotVariant":"fine","dotMm":1.5,"nnMm":7,"grid":"diamond"}'::jsonb
WHERE id = 'poa-miudo-claro';

UPDATE public.applications SET
  params = '{"rapportCm":10,"layout":"dots","dotVariant":"watercolor","dotMm":2,"nnMm":9,"grid":"diamond"}'::jsonb
WHERE id = 'poa-aquarela';

UPDATE public.applications SET
  description = 'Vichy de 8 mm em três tons, com cara de pano de cozinha.',
  director_rules = 'Vichy chapado de quadrados de 8 mm em três tons: branco, o tom claro da cor e a cor cheia no cruzamento, como tecido de fio tinto. Bordas nítidas. Escreva background color: #FFFFFF e check color: #RRGGBB. Sem aquarela, sem motivos figurativos.',
  params = '{"rapportCm":9.6,"layout":"plaid","squareMm":8}'::jsonb
WHERE id = 'xadrez-coordenado';

UPDATE public.applications SET
  director_rules = 'Listras verticais chapadas de 2,5 mm a cada 10 mm, em duas cores sólidas da paleta, bordas nítidas. Escreva background color: #RRGGBB e stripe color: #RRGGBB. Sem motivos figurativos, sem aquarela.',
  params = '{"rapportCm":10,"layout":"stripe","stripeMm":2.5,"spacingMm":10}'::jsonb
WHERE id = 'listrado-coordenado';

UPDATE public.applications SET
  director_rules = 'Quatro quadros iguais de 50 cm de largura por 37,5 de altura, desenhados deitados. Moldura ou filete a cerca de 2 cm da borda, buquês ou frutas em dois cantos opostos ou nos quatro cantos, centro calmo com textura discreta de linho e a área do prato de 26 cm totalmente livre. Texto manuscrito curto e selos só quando o tema pedir.',
  params = '{"frames":{"count":4,"widthCm":37.5,"heightCm":50,"shape":"rect","marginCm":2,"quietArea":{"shape":"rect","widthCm":26,"heightCm":26},"backgroundStyle":"coordinate","renderLandscape":true}}'::jsonb
WHERE id = 'jogo-americano';

INSERT INTO public.applications (id, slug, name, family, description, fabric_width_cm, cut_length_cm, suggested_role, director_rules, params, sort_order)
VALUES
  ('xadrez-enviesado','xadrez-enviesado','Xadrez enviesado','corrida','O mesmo vichy girado 45 graus, quadrados de 15 mm virando losangos.',150,50,'apoio','Vichy chapado de quadrados de 15 mm girado 45 graus, em três tons como o xadrez coordenado. Escreva background color: #FFFFFF e check color: #RRGGBB. Sem aquarela.','{"rapportCm":15,"layout":"plaid","squareMm":15,"bias":true}'::jsonb, 61),
  ('xadrez-aquarela','xadrez-aquarela','Xadrez aquarela','corrida','Xadrez pintado de 30 mm com textura de linho, para coleções em aquarela.',150,50,'apoio','Xadrez pintado de quadrados de 30 mm em duas cores da paleta sobre fundo claro, com bordas de aquarela e textura sutil de linho.','{"rapportCm":30,"layout":"plaid","squareMm":30}'::jsonb, 62),
  ('listrado-largo','listrado-largo','Listrado largo','corrida','Listras chapadas de 8 mm a cada 16 mm, com ar de toalha de feira.',150,50,'apoio','Listras verticais chapadas de 8 mm a cada 16 mm, em duas cores sólidas da paleta, bordas nítidas. Escreva background color: #RRGGBB e stripe color: #RRGGBB. Sem aquarela.','{"rapportCm":16,"layout":"stripe","stripeMm":8,"spacingMm":16}'::jsonb, 63)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug, name = EXCLUDED.name, family = EXCLUDED.family,
  description = EXCLUDED.description, suggested_role = EXCLUDED.suggested_role,
  director_rules = EXCLUDED.director_rules, params = EXCLUDED.params;