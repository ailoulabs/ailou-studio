# AiLou Studio

Criador de coleções de estampas coordenadas para costura criativa.
Aplicativo web da Ailou usado por artesãs (e pelo time da Casa Criativa) para
propor a paleta, escolher motivos, gerar as estampas com IA e exportar o pacote
para a estamparia.

## Stack

- **TanStack Start** (React + Vite + Nitro) — SSR + rotas de servidor
- **Supabase** — Postgres (com pg_cron e pg_net), Auth, Storage
- **OpenAI GPT-Image-2.5** (`gpt-image-2.5-flare`, `sunburst`) — reserva e conserto de emenda com máscara
- **Google Gemini** (`gemini-3.1-flash-image`, "Nano Banana 2") — provedor principal desde 14/09/2026
- **Vercel** (Node runtime, Fluid Compute) — hospedagem serverless

## Rodando localmente

Requer Node.js 22+ e npm.

```sh
npm install
cp .env.example .env.local   # preencher com as chaves reais
npm run dev
```

O app fica em `http://localhost:8080`.

## Variáveis de ambiente

Lista completa em [`.env.example`](.env.example). Nenhuma chave real fica commitada; em produção, cole tudo em Vercel → Project Settings → Environment Variables.

Obrigatórias para o servidor:

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`, `GEMINI_API_KEY`
- `GENERATION_WORKER_SECRET` (gere com `openssl rand -base64 32`)

Obrigatórias para o cliente (mesmos valores, prefixo `VITE_`):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Opcionais:

- `WORKER_BASE_URL` — força o endereço que o processador usa para se auto-acionar. Vazio = usa a origem da requisição.
- `REPLICATE_API_TOKEN` — upscale opcional das peças posicionadas (fora do MVP).

## Banco (Supabase)

As migrações estão em [`supabase/migrations/`](supabase/migrations/). Se aplicá-las manualmente, siga a ordem alfabética (o timestamp já garante isso). No projeto AiLou Studio atual (organização AiLou Labs, `us-east-1`) todas já estão aplicadas.

Depois de subir o app em produção, sincronize o segredo do processador com o banco (uma vez por ambiente):

```sql
select public.sync_generation_worker_config(
  current_setting('app.worker_secret'),  -- ou passe o valor direto
  'https://ailou-studio.vercel.app'      -- endereço público do app
);
```

O verificador por minuto (`sweep-generation-jobs`) é armado automaticamente em `private.arm_generation_sweeper()` sempre que uma nova geração entra na fila e se auto-desarma quando a fila esvazia.

## Deploy no Vercel

1. Faça push do repositório para GitHub.
2. No Vercel, "Import Project" apontando para o repositório. Framework preset: **Vite** ou "Other" (o Nitro do TanStack Start gera diretamente a saída Vercel Build Output API v3).
3. Cole as variáveis de [`.env.example`](.env.example) em Environment Variables (produção + preview).
4. Deploy. A URL de produção fica em `https://<projeto>.vercel.app`.
5. **Enable Fluid Compute** em Project Settings → Functions (se ainda não estiver ligado). Ele libera até 300s por invocação no plano Hobby, necessário para as peças pesadas (jogo americano 2560×1920 pode passar de 40s).
6. Considere subir a memória padrão das funções para 1024 MB (Project Settings → Functions → Default Memory). O runtime antigo tinha 128 MB, o que causava OOM silencioso nas estampas grandes.

## Tornar alguém administrador

No editor SQL do Supabase, trocando o e-mail:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'troque@pelo-email.com'
on conflict (user_id, role) do nothing;
```

Depois disso, a pessoa vê `/catalogo`, com a lista de pessoas cadastradas e o botão "Tornar admin" para promover outras.

## Testes

```sh
npm test         # vitest
npm run typecheck
npm run lint
```
