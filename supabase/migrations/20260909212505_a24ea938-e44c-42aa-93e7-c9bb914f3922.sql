-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- UPDATED_AT
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CATALOG
CREATE TABLE public.applications (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  family text NOT NULL CHECK (family IN ('corrida','barrado','painel')),
  description text NOT NULL DEFAULT '',
  fabric_width_cm numeric NOT NULL DEFAULT 150,
  cut_length_cm numeric NOT NULL DEFAULT 50,
  suggested_role text NOT NULL CHECK (suggested_role IN ('principal','coordenado','apoio')),
  director_rules text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications readable" ON public.applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "applications admin write" ON public.applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.kits (
  usage text PRIMARY KEY,
  name text NOT NULL,
  application_ids text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kits TO authenticated;
GRANT ALL ON public.kits TO service_role;
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kits readable" ON public.kits FOR SELECT TO authenticated USING (true);
CREATE POLICY "kits admin write" ON public.kits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER kits_updated_at BEFORE UPDATE ON public.kits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- COLLECTIONS
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Coleção sem nome',
  status text NOT NULL DEFAULT 'rascunho',
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  direction jsonb,
  palette text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own collections" ON public.collections FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX collections_user_idx ON public.collections (user_id, created_at DESC);

CREATE TABLE public.pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  application_id text NOT NULL REFERENCES public.applications(id),
  role text NOT NULL DEFAULT 'coordenado',
  position int NOT NULL DEFAULT 0,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  prompt text,
  image_path text,
  cut_image_path text,
  seam jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pieces TO authenticated;
GRANT ALL ON public.pieces TO service_role;
ALTER TABLE public.pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pieces" ON public.pieces FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid()));
CREATE TRIGGER pieces_updated_at BEFORE UPDATE ON public.pieces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX pieces_collection_idx ON public.pieces (collection_id, position);

-- CREDITS
CREATE TABLE public.credits_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta int NOT NULL,
  reason text NOT NULL,
  ref_collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  ref_piece_id uuid REFERENCES public.pieces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credits_ledger TO authenticated;
GRANT ALL ON public.credits_ledger TO service_role;
ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger select" ON public.credits_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX credits_ledger_user_idx ON public.credits_ledger (user_id);

CREATE OR REPLACE FUNCTION public.get_credit_balance(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(delta), 0)::int FROM public.credits_ledger WHERE user_id = _user_id
$$;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(uuid) TO authenticated, service_role;

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, phone)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), NEW.phone)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.credits_ledger (user_id, delta, reason) VALUES (NEW.id, 10, 'welcome');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STORAGE POLICIES (bucket "pieces" is created separately)
CREATE POLICY "pieces own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pieces' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pieces own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pieces' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pieces own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pieces' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pieces own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pieces' AND (storage.foldername(name))[1] = auth.uid()::text);

-- SEED CATALOG
INSERT INTO public.applications (id,slug,name,family,description,fabric_width_cm,cut_length_cm,suggested_role,director_rules,params,sort_order) VALUES
('estampa-principal','estampa-principal','Estampa principal','corrida','A estampa que dá o tom da coleção, com os desenhos maiores e mais coloridos.',150,50,'principal','Motivos grandes bem distribuídos, com respiro entre eles. Usa toda a paleta e concentra o colorido da coleção.','{"rapportCm":30,"layout":"tossed"}'::jsonb,0),
('delicadeza-miniatura','delicadeza-miniatura','Delicadeza em miniatura','corrida','Os mesmos desenhos, bem pequenininhos, para forros e detalhes.',150,50,'coordenado','Versão miúda dos motivos principais, distribuição densa e uniforme, sem elementos dominantes.','{"rapportCm":20,"layout":"tossed"}'::jsonb,1),
('ramos-detalhes','ramos-detalhes','Ramos e detalhes','corrida','Folhas e raminhos em meio salto, para dar movimento sem competir.',150,50,'coordenado','Somente folhagem e elementos secundários, em meio salto, com contraste médio e fundo claro.','{"rapportCm":25,"layout":"half-drop"}'::jsonb,2),
('listrado-coordenado','listrado-coordenado','Listrado coordenado','corrida','Listras nas cores da coleção, ótimas para vieses e alças.',150,50,'apoio','Listras verticais de larguras variadas, sem motivos figurativos.','{"rapportCm":12,"layout":"stripe"}'::jsonb,3),
('poa-delicado','poa-delicado','Poá delicado','corrida','Bolinhas miúdas para descansar o olho e fechar a coleção.',150,50,'apoio','Bolinhas regulares e pequenas, duas cores no máximo, fundo claro.','{"rapportCm":10,"layout":"dots"}'::jsonb,4),
('xadrez-coordenado','xadrez-coordenado','Xadrez coordenado','corrida','Xadrez leve com cara de pano de cozinha.',150,50,'apoio','Xadrez de duas ou três cores da paleta, linhas finas, sem motivos figurativos.','{"rapportCm":16,"layout":"plaid"}'::jsonb,5),
('textura-suave','textura-suave','Textura suave','corrida','Um fundo texturizado quase liso, para dar descanso visual.',150,50,'apoio','Textura orgânica de baixo contraste, sem desenho reconhecível.','{"rapportCm":20,"layout":"texture"}'::jsonb,6),
('toalha-de-mesa','toalha-de-mesa','Toalha de mesa','corrida','Estampa corrida arejada, pensada para cobrir a mesa inteira.',150,50,'coordenado','Motivos médios bem espaçados, muito fundo à mostra, para não pesar em grandes áreas.','{"rapportCm":30,"layout":"tossed"}'::jsonb,7),
('barrado-unico','barrado-unico','Barrado único','barrado','Um corte inteiro com uma faixa decorada de 50 cm ao longo do comprimento.',150,50,'coordenado','Faixa contínua ao longo da largura do tecido, com repetição resolvida na horizontal e degradê suave para o fundo.','{"bands":1,"bandHeightCm":50,"borderPosition":"bottom"}'::jsonb,8),
('barrado-multiplo','barrado-multiplo','Barrado múltiplo','barrado','Cinco faixas de 10 cm no mesmo corte, para render várias peças pequenas.',150,50,'coordenado','Cinco faixas independentes de 10 cm, cada uma com motivos menores, todas com emenda resolvida na horizontal.','{"bands":5,"bandHeightCm":10,"borderPosition":"bottom"}'::jsonb,9),
('trilho-de-mesa','trilho-de-mesa','Trilho de mesa','barrado','Faixa decorada nas duas pontas e centro calmo para apoiar as travessas.',150,50,'coordenado','Bordas decoradas nas duas extremidades e centro calmo, quase liso, para não competir com a louça.','{"bands":1,"bandHeightCm":50,"borderPosition":"both"}'::jsonb,10),
('jogo-americano','jogo-americano','Jogo americano','painel','Quatro jogos americanos posicionados em um corte, prontos para recortar e costurar.',150,50,'principal','Quatro quadros iguais, moldura decorada e centro calmo para o prato. Nada de motivo importante no meio.','{"frames":{"count":4,"widthCm":37.5,"heightCm":50,"shape":"rect","marginCm":1.5,"quietArea":{"shape":"rect","widthCm":26,"heightCm":26},"backgroundStyle":"coordinate"}}'::jsonb,11),
('capa-de-almofada','capa-de-almofada','Capa de almofada','painel','Três frentes de almofada de 50 × 50 cm no mesmo corte.',150,50,'coordenado','Três quadros de 50 × 50 com composição centralizada e fundo coordenado com a estampa principal.','{"frames":{"count":3,"widthCm":50,"heightCm":50,"shape":"rect","marginCm":1.5,"backgroundStyle":"coordinate"}}'::jsonb,12),
('guardanapo','guardanapo','Guardanapo','painel','Três guardanapos de 50 × 50 cm com um acento em um dos cantos.',150,50,'apoio','Três quadros de 50 × 50 com fundo liso e um único acento decorativo em um dos cantos.','{"frames":{"count":3,"widthCm":50,"heightCm":50,"shape":"rect","marginCm":1.5,"backgroundStyle":"plain"}}'::jsonb,13),
('capa-de-sousplat','capa-de-sousplat','Capa de sousplat','painel','Quatro círculos de 35 cm para cobrir o sousplat.',150,50,'apoio','Quatro quadros redondos de 35 cm, composição radial simples e fundo liso.','{"frames":{"count":4,"widthCm":35,"heightCm":35,"shape":"circle","marginCm":2,"backgroundStyle":"plain"}}'::jsonb,14);

INSERT INTO public.kits (usage,name,application_ids,sort_order) VALUES
('mesa-posta','Mesa posta e cozinha',ARRAY['jogo-americano','trilho-de-mesa','toalha-de-mesa','guardanapo','poa-delicado']::text[],0),
('cozinha','Cozinha',ARRAY['barrado-multiplo','barrado-unico','estampa-principal','xadrez-coordenado','poa-delicado']::text[],1),
('costura-criativa','Costura criativa e patchwork',ARRAY['estampa-principal','delicadeza-miniatura','ramos-detalhes','listrado-coordenado','poa-delicado']::text[],2),
('enxoval-infantil','Enxoval infantil',ARRAY['estampa-principal','delicadeza-miniatura','capa-de-almofada','barrado-unico','poa-delicado']::text[],3),
('bolsas-acessorios','Bolsas e acessórios',ARRAY['estampa-principal','delicadeza-miniatura','listrado-coordenado','capa-de-almofada','poa-delicado']::text[],4);