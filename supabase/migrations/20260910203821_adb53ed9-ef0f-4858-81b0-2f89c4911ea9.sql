UPDATE public.applications SET
  slug = 'poa-classico',
  name = 'Poá clássico',
  description = 'Bolinhas brancas miúdas em fundo de cor cheia, o poá clássico da tricoline.',
  suggested_role = 'apoio',
  director_rules = 'Escolha uma cor cheia da paleta para o fundo e branco ou creme para as bolinhas, garantindo contraste forte. Bolinhas redondas de 2 mm em grade regular com 8 mm de espaçamento. Sem motivos florais.',
  params = '{"rapportCm":10,"layout":"dots","dotVariant":"classic","dotMm":2,"spacingMm":8,"grid":"square"}'::jsonb,
  updated_at = now()
WHERE id = 'poa-delicado';

INSERT INTO public.applications (id, slug, name, family, description, fabric_width_cm, cut_length_cm, suggested_role, director_rules, params, sort_order)
VALUES
 ('poa-miudo-claro','poa-miudo-claro','Poá miúdo em fundo claro','corrida','Bolinhas de 1,5 mm em tom médio sobre fundo claro, em grade alternada.',150,50,'apoio','Fundo na cor clara da paleta e bolinhas em um tom médio da paleta, com contraste nítido, nunca off-white em fundo claro. Bolinhas de 1,5 mm em grade alternada com 6 mm de espaçamento.','{"rapportCm":10,"layout":"dots","dotVariant":"fine","dotMm":1.5,"spacingMm":6,"grid":"half-drop"}'::jsonb,60),
 ('poa-aquarela','poa-aquarela','Poá aquarela','corrida','Bolinhas brancas de 2 mm sobre fundo aquarelado manchado na cor da paleta.',150,50,'apoio','Fundo em lavagem de aquarela manchada na cor cheia da paleta, com áreas mais claras e mais escuras, e bolinhas brancas de 2 mm em grade regular com 8 mm de espaçamento.','{"rapportCm":10,"layout":"dots","dotVariant":"watercolor","dotMm":2,"spacingMm":8,"grid":"square"}'::jsonb,61)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  director_rules = EXCLUDED.director_rules, params = EXCLUDED.params, updated_at = now();

UPDATE public.applications SET
  description = 'Listras finas nas cores da coleção, ótimas para vieses e alças.',
  director_rules = 'Listras verticais finas de 2 a 3 mm com espaçamento de 8 a 12 mm, em cor cheia da paleta sobre fundo claro ou brancas sobre cor. Sem motivos figurativos.',
  params = '{"rapportCm":10,"layout":"stripe","stripeMm":2.5,"spacingMm":10}'::jsonb,
  updated_at = now()
WHERE id = 'listrado-coordenado';

UPDATE public.applications SET
  description = 'Xadrez miúdo com cara de pano de cozinha.',
  director_rules = 'Xadrez de quadrados de 8 a 12 mm em duas cores da paleta sobre fundo claro, linhas retas e uniformes, sem motivos figurativos.',
  params = '{"rapportCm":10,"layout":"plaid","squareMm":10}'::jsonb,
  updated_at = now()
WHERE id = 'xadrez-coordenado';

UPDATE public.kits SET application_ids = array_replace(application_ids, 'poa-delicado', 'poa-miudo-claro'), updated_at = now()
WHERE usage IN ('enxoval-infantil','bolsas-acessorios');