import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();


/** Um motivo concreto pedido pela artesã: nome na tela e descrição para o prompt. */
export interface DirectionMotif {
  /** Nome curto em português, mostrado na tela. */
  name: string;
  /** Descrição curta em inglês, usada no prompt de imagem. */
  en: string;
}

export interface DirectionResult {
  summaryBullets: string[];
  shared: string;
  pieces: { pieceId: string; guidance: string }[];
  suggestedColors: string[];
  paletteReason: string;
  motifs?: DirectionMotif[];
  avoid?: string[];
  fillers?: string[];
  /** Categoria obrigatória quando a pessoa disse "somente X". Vazio quando não houver. */
  category?: string;
  styleLevels?: {
    size: number;
    density: number;
    contrast: number;
    sizeReason: string;
    densityReason: string;
    contrastReason: string;
  };
}

const MOTIF_LIST_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["name", "en"],
    properties: { name: { type: "string" }, en: { type: "string" } },
  },
} as const;

const DIRECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summaryBullets",
    "shared",
    "pieces",
    "suggestedColors",
    "paletteReason",
    "motifs",
    "avoid",
    "fillers",
    "category",
    "styleLevels",
  ],
  properties: {
    summaryBullets: { type: "array", items: { type: "string" } },
    shared: { type: "string" },
    motifs: MOTIF_LIST_SCHEMA,
    avoid: { type: "array", items: { type: "string" } },
    fillers: { type: "array", items: { type: "string" } },
    category: { type: "string" },
    pieces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pieceId", "guidance"],
        properties: { pieceId: { type: "string" }, guidance: { type: "string" } },
      },
    },
    suggestedColors: { type: "array", items: { type: "string" } },
    paletteReason: { type: "string" },
    styleLevels: {
      type: "object",
      additionalProperties: false,
      required: ["size", "density", "contrast", "sizeReason", "densityReason", "contrastReason"],
      properties: {
        size: { type: "integer", minimum: -2, maximum: 2 },
        density: { type: "integer", minimum: -2, maximum: 2 },
        contrast: { type: "integer", minimum: -2, maximum: 2 },
        sizeReason: { type: "string" },
        densityReason: { type: "string" },
        contrastReason: { type: "string" },
      },
    },
  },
} as const;

const SYSTEM_PT = `Você é diretor criativo de estamparia têxtil brasileira, especialista em coleções coordenadas para costura criativa.
Interprete a ideia da artesã e preserve exatamente as espécies, objetos e temas pedidos, e respeite as exclusões:
se a pessoa disse que não quer X, X não entra em motifs nem em fillers, de jeito nenhum.
MOTIVOS: em motifs liste de 6 a 10 motivos concretos do tema pedido, cada um com name em português para a tela
e en com uma descrição curta em inglês para o prompt de imagem, com variações quando fizer sentido.
Em avoid liste em inglês tudo que a pessoa disse que não quer.
Em fillers liste de 2 a 3 elementos pequenos de preenchimento coerentes com o tema, nunca folhas ou botões por padrão.
CATEGORIA OBRIGATÓRIA: se a pessoa disser "somente X" (somente doces, somente frutas, somente folhagem),
escreva X em category, em inglês, e então todos os motifs e todos os fillers têm de ser instâncias de X.
Item apenas relacionado ao tema não entra: em "somente doces para bebê", chupeta, mamadeira, ursinho, laço e nuvem ficam de fora.
Quando não houver "somente", deixe category como texto vazio.
Descreva escala relativa, densidade, contraste e fundo em linguagem de desenho, nunca em termos técnicos.
NUNCA cite pixels, DPI, dimensões de arquivo, nomes de campos internos ou termos de software.
Para peças de painel, descreva a composição do quadro: moldura, área calma no centro e tratamento dos cantos.
Para peças de barrado, descreva a borda decorada e a área calma acima dela.
Para peças de estampa corrida, descreva motivos espalhados sem borda.
COORDENADOS DE APOIO (poá, listrado, xadrez, textura): escolha o par de cores dentro da paleta aprovada e escreva na orientação da peça,
em inglês entre parênteses no final, qual é o fundo e qual é a marca, assim: (background color: #XXXXXX, dot color: #XXXXXX)
ou (background color: #XXXXXX, stripe color: #XXXXXX). O contraste tem que ser forte: nunca bolinha branca ou off-white em fundo claro.
No poá clássico o fundo é uma cor cheia da paleta e a bolinha é branca ou creme.
Escreva de 4 a 6 tópicos curtos em summaryBullets.
PALETA: você é quem propõe a paleta. Nunca repita uma paleta recebida como se fosse definitiva.
Proponha exatamente 5 cores em hexadecimal derivadas da ideia, do estilo e da imagem de referência:
as cores naturais dos elementos pedidos (por exemplo margarida branca e amarela significa branco ou creme,
o amarelo do miolo e o verde das folhas), uma cor de fundo clara e um acento coerente com o estilo.
Se vierem coresObrigatorias, todas entram na paleta sem alterar o tom.
Se vierem coresPreferidas, use apenas as que combinarem com a ideia.
Em paletteReason explique a escolha em 2 frases, em português, sem travessão.
AJUSTES DA COLEÇÃO: em styleLevels escolha um nível inteiro de -2 a 2 para cada ajuste, valendo para a coleção inteira.
size: -2 miúdo (maior desenho com cerca de 8% da largura do rapport), -1 pequeno 12%, 0 médio 18%, 1 grande 25%, 2 bem grande 35%.
density: -2 bem arejado (motivos cobrindo cerca de 20% do fundo), -1 arejado 30%, 0 equilibrado 45%, 1 cheio 60%, 2 bem cheio 75%.
contrast: -2 bem suave (tons próximos e lavados, quase tom sobre tom) até 2 bem forte (cores cheias e saturadas com fundo bem escuro ou bem claro em relação aos motivos).
Explique cada escolha em uma linha curta em português, sem travessão, nos campos sizeReason, densityReason e contrastReason.
Escreva tudo em português do Brasil, sem usar o caractere travessão.`;

const MODEL_DIRECTOR = "gpt-5-mini";

const UNDERSTAND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summaryBullets", "shared", "motifs", "avoid", "fillers", "category"],
  properties: {
    summaryBullets: { type: "array", items: { type: "string" } },
    shared: { type: "string" },
    motifs: MOTIF_LIST_SCHEMA,
    avoid: { type: "array", items: { type: "string" } },
    fillers: { type: "array", items: { type: "string" } },
    category: { type: "string" },
  },
} as const;

const UNDERSTAND_SYSTEM = `Você é diretor criativo de estamparia têxtil brasileira.
Sua tarefa aqui é só uma: devolver, em português do Brasil, o que você entendeu do pedido da artesã.
Escreva de 4 a 6 tópicos curtos em summaryBullets cobrindo tema e elementos, jeito de desenhar, uso das peças,
clima da coleção e o que vai em cada peça da lista, citando o nome de cada peça.
Em shared escreva uma frase que amarre a coleção inteira.
Preserve exatamente as espécies, objetos e temas pedidos e respeite as exclusões:
se a pessoa disse que não quer X, X não entra em motifs nem em fillers.
Em motifs liste de 6 a 10 motivos concretos do tema, cada um com name em português e en com descrição curta em inglês.
Em avoid liste em inglês tudo que a pessoa disse que não quer.
Em fillers liste de 2 a 3 elementos pequenos de preenchimento coerentes com o tema, nunca folhas ou botões por padrão.
CATEGORIA OBRIGATÓRIA: se a pessoa disser "somente X" (somente doces, somente frutas, somente folhagem),
escreva X em category, em inglês, e então todos os motifs e todos os fillers têm de ser instâncias de X.
Item apenas relacionado ao tema não entra: em "somente doces para bebê", chupeta, mamadeira, ursinho, laço e nuvem ficam de fora.
Quando não houver "somente", deixe category como texto vazio.
Não proponha cores, não fale de paleta, não fale de tamanho, quantidade ou contraste.
Nunca cite pixels, DPI, arquivos ou termos de software. Nunca use o caractere travessão.`;

export interface UnderstandResult {
  summaryBullets: string[];
  shared: string;
  motifs: DirectionMotif[];
  avoid: string[];
  fillers: string[];
  category?: string;
}

/** Etapa 1: só o entendimento do pedido, em texto, sem paleta e sem imagem. */
export const understandIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid }).parse)
  .handler(async ({ data, context }): Promise<UnderstandResult> => {
    const { supabase, userId } = context;
    const { openAiKey, openAiError } = await import("@/lib/ai/openai.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("*, pieces(*)")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");

    const pieces = ((collection.pieces ?? []) as { application_id: string; position: number }[]).sort(
      (a, b) => a.position - b.position,
    );
    const { data: apps } = await supabase
      .from("applications")
      .select("id, name, family")
      .in("id", pieces.map((p) => p.application_id));
    const appById = new Map((apps ?? []).map((a) => [a.id, a]));
    const brief = (collection.brief ?? {}) as Record<string, unknown>;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_DIRECTOR,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: UNDERSTAND_SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              nomeDaColecao: collection.name,
              ideia: brief["idea"] ?? "",
              estilo: brief["style"] ?? "",
              uso: brief["usage"] ?? "",
              pecas: pieces.map((p) => appById.get(p.application_id)?.name ?? p.application_id),
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "entendimento", strict: true, schema: UNDERSTAND_SCHEMA },
        },
      }),
    });
    if (!res.ok) throw new Error(openAiError(res.status));
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(json.choices[0]!.message.content) as UnderstandResult;
    parsed.motifs = (parsed.motifs ?? []).filter((m) => m?.name && m?.en).slice(0, 10);
    parsed.avoid = (parsed.avoid ?? []).filter(Boolean);
    parsed.fillers = (parsed.fillers ?? []).filter(Boolean).slice(0, 3);
    parsed.category = String(parsed.category ?? "").trim();

    const previous = (collection.direction ?? null) as Record<string, unknown> | null;
    await supabase
      .from("collections")
      .update({
        direction: { ...(previous ?? {}), ...parsed } as never,
        status: "proposta",
      })
      .eq("id", data.collectionId)
      .eq("user_id", userId);

    return parsed;
  });


export const creativeDirector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid, paletteOnly: z.boolean().optional() }).parse)
  .handler(async ({ data, context }): Promise<DirectionResult> => {
    const { supabase, userId } = context;
    const { openAiKey, openAiError } = await import("@/lib/ai/openai.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("*, pieces(*)")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");

    const pieces = (collection.pieces ?? []) as {
      id: string;
      application_id: string;
      role: string;
      position: number;
      overrides: unknown;
    }[];
    pieces.sort((a, b) => a.position - b.position);

    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .in(
        "id",
        pieces.map((p) => p.application_id),
      );
    const appById = new Map((apps ?? []).map((a) => [a.id, a]));

    const brief = (collection.brief ?? {}) as Record<string, unknown>;
    const reference = typeof brief["reference"] === "string" ? (brief["reference"] as string) : null;

    const pieceLines = pieces.map((p) => {
      const app = appById.get(p.application_id);
      return {
        pieceId: p.id,
        nome: app?.name ?? p.application_id,
        familia: app?.family,
        papel: p.role,
        medidas: app
          ? `corte ${app.cut_length_cm} x ${app.fabric_width_cm} cm`
          : "corte padrão",
        parametros: app?.params,
        regras: app?.director_rules,
      };
    });

    const asColors = (value: unknown) =>
      Array.isArray(value) ? value.filter((c): c is string => typeof c === "string") : [];

    const userContent: unknown[] = [
      {
        type: "text",
        text: JSON.stringify(
          {
            nomeDaColecao: collection.name,
            ideia: brief["idea"] ?? "",
            estilo: brief["style"] ?? "",
            uso: brief["usage"] ?? "",
            coresObrigatorias: asColors(brief["requiredColors"]),
            coresPreferidas: asColors(brief["preferredColors"]),
            motivosEntendidos:
              ((collection.direction ?? {}) as unknown as DirectionResult).motifs ?? [],
            foraDoTema:
              ((collection.direction ?? {}) as unknown as DirectionResult).avoid ?? [],
            pecas: pieceLines,
            ...(brief["usage"] === "barrado"
              ? {
                  pedidoBarrado:
                    "No barrado múltiplo, a orientação da peça precisa descrever faixa por faixa, de cima para baixo, na ordem e nas alturas dos parâmetros: o tema de cada faixa, o fundo dela e a barrinha decorativa que separa uma da outra. Cada faixa é uma fileira de motivos que se repete da esquerda para a direita. Use a mesma paleta e o mesmo jeito de pintar em todas as faixas e nas outras peças da coleção.",
                }
              : {}),
            ...(data.paletteOnly
              ? { pedido: "Proponha uma paleta diferente da anterior, mantendo a mesma ideia." }
              : {}),

          },
          null,
          2,
        ),
      },
    ];
    if (reference?.startsWith("data:image")) {
      userContent.push({ type: "image_url", image_url: { url: reference } });
      userContent.push({
        type: "text",
        text: "A imagem acima é referência de estilo e leveza. O texto manda na espécie e nos elementos.",
      });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_DIRECTOR,
        // Raciocínio curto: a proposta é sempre a mesma estrutura, e assim ela chega bem mais rápido.
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM_PT },
          { role: "user", content: userContent },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "direcao_criativa", strict: true, schema: DIRECTION_SCHEMA },
        },
      }),
    });

    if (!res.ok) throw new Error(openAiError(res.status));
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const direction = JSON.parse(json.choices[0]!.message.content) as DirectionResult;

    const palette = (direction.suggestedColors ?? [])
      .filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c))
      .slice(0, 5);

    // Na proposta de nova paleta, preserva as orientações já revisadas.
    const previous = (collection.direction ?? null) as unknown as DirectionResult | null;
    const merged: DirectionResult =
      data.paletteOnly && previous
        ? {
            ...previous,
            suggestedColors: direction.suggestedColors,
            paletteReason: direction.paletteReason,
            ...(previous.styleLevels ? { styleLevels: previous.styleLevels } : {}),
          }
        : {
            ...direction,
            // Os motivos entendidos na etapa 1 mandam quando o diretor não repetir a lista.
            motifs:
              direction.motifs && direction.motifs.length > 0
                ? direction.motifs
                : (previous?.motifs ?? []),
            avoid:
              direction.avoid && direction.avoid.length > 0
                ? direction.avoid
                : (previous?.avoid ?? []),
            fillers:
              direction.fillers && direction.fillers.length > 0
                ? direction.fillers
                : (previous?.fillers ?? []),
            category: (direction.category ?? "").trim() || (previous?.category ?? ""),
          };

    await supabase
      .from("collections")
      .update({
        direction: merged as never,
        status: "proposta",
        ...(palette.length > 0 ? { palette } : {}),
      })
      .eq("id", data.collectionId)
      .eq("user_id", userId);

    return merged;
  });

/** Medidas físicas do módulo, usadas para calcular o dpi. */
function moduleCm(app: {
  family: string;
  cut_length_cm: number;
  params: Record<string, unknown>;
}): number {
  if (app.family === "corrida") return Number(app.params["rapportCm"] ?? 30);
  if (app.family === "barrado") return Number(app.cut_length_cm ?? 50);
  const frames = app.params["frames"] as { widthCm?: number } | undefined;
  return Number(frames?.widthCm ?? 50);
}
/** Preparo para impressão com o Real-ESRGAN no Replicate. */
export const upscalePiece = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pieceId: uuid }).parse)
  .handler(async ({ data, context }) => {
    const token = process.env["REPLICATE_API_TOKEN"];
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: piece, error } = await supabase
      .from("pieces")
      .select("*, collections!inner(user_id)")
      .eq("id", data.pieceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!piece) throw new Error("Peça não encontrada.");
    const owner = (piece as unknown as { collections: { user_id: string } }).collections.user_id;
    if (owner !== userId) throw new Error("Peça não encontrada.");
    if (!piece.image_path) return { skipped: true as const, reason: "sem imagem" };

    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("id", piece.application_id)
      .maybeSingle();
    const cm = app
      ? moduleCm({
          family: String(app.family),
          cut_length_cm: Number(app.cut_length_cm),
          params: (app.params ?? {}) as Record<string, unknown>,
        })
      : 30;

    const file = await supabaseAdmin.storage.from("pieces").download(piece.image_path);
    if (file.error || !file.data) return { skipped: true as const, reason: "sem imagem" };
    const buffer = new Uint8Array(await file.data.arrayBuffer());

    // Largura em pixels lida do cabeçalho IHDR do PNG.
    const srcWidth =
      buffer.length > 24 ? new DataView(buffer.buffer, buffer.byteOffset).getUint32(16) : 1024;
    const scale = srcWidth >= 1536 ? 2 : 4;

    if (!token) {
      const dpi = Math.round(srcWidth / (cm / 2.54));
      await supabase.from("pieces").update({ print_dpi: dpi }).eq("id", piece.id);
      return { skipped: true as const, reason: "sem chave", dpi };
    }

    let binary = "";
    for (const byte of buffer) binary += String.fromCharCode(byte);
    const dataUrl = `data:image/png;base64,${btoa(binary)}`;

    const create = await fetch(
      "https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: { image: dataUrl, scale, face_enhance: false } }),
      },
    );
    if (!create.ok) {
      const detail = await create.text();
      throw new Error(`O preparo para impressão falhou (${create.status}): ${detail.slice(0, 180)}`);
    }
    const prediction = (await create.json()) as { id: string };

    let output: string | null = null;
    for (let i = 0; i < 90; i += 1) {
      await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 5000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await poll.json()) as { status: string; output?: string | string[] };
      if (body.status === "succeeded") {
        output = Array.isArray(body.output) ? (body.output[0] ?? null) : (body.output ?? null);
        break;
      }
      if (body.status === "failed" || body.status === "canceled") {
        throw new Error("O preparo para impressão não terminou.");
      }
    }
    if (!output) throw new Error("O preparo para impressão demorou demais.");

    const big = await fetch(output);
    const bigBytes = new Uint8Array(await big.arrayBuffer());
    const printPath = `${userId}/${piece.collection_id}/${piece.id}-print.png`;
    const up = await supabaseAdmin.storage
      .from("pieces")
      .upload(printPath, bigBytes, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error("Não foi possível salvar a versão de impressão.");

    const dpi = Math.round((srcWidth * scale) / (cm / 2.54));
    await supabase
      .from("pieces")
      .update({ image_print_path: printPath, print_dpi: dpi })
      .eq("id", piece.id);

    const signed = await supabase.storage.from("pieces").createSignedUrl(printPath, 60 * 60);
    return {
      skipped: false as const,
      printPath,
      printUrl: signed.data?.signedUrl ?? null,
      dpi,
    };
  });

export interface MotifIndexEntry {
  index: number;
  path: string;
  type: string;
  relSize: number;
  bbox: { x: number; y: number; w: number; h: number };
  /** Mesma caixa em fração de 0 a 1, para valer em qualquer tamanho de prancha. */
  bboxRel?: { x: number; y: number; w: number; h: number };
  /** Nome do motivo, vindo da conferência da prancha. */
  name?: string;
  /** A conferência achou este motivo fora do tema pedido. */
  offTheme?: boolean;
  /** A artesã tirou este motivo da coleção. */
  excluded?: boolean;
}

/** Guarda os motivos recortados no navegador e o índice deles na coleção. */
export const saveMotifs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      collectionId: uuid,
      motifs: z
        .array(
          z.object({
            index: z.number().int().min(0).max(64),
            base64: z.string().min(1).max(4_000_000),
            type: z.string().max(40),
            relSize: z.number(),
            bbox: z.object({
              x: z.number(),
              y: z.number(),
              w: z.number(),
              h: z.number(),
            }),
            bboxRel: z
              .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
              .optional(),
            name: z.string().max(60).optional(),
            offTheme: z.boolean().optional(),
            excluded: z.boolean().optional(),
          }),
        )
        .max(32),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");

    const index: MotifIndexEntry[] = [];
    for (const motif of data.motifs) {
      const path = `${userId}/${collection.id}/motifs/${motif.index}.png`;
      const bytes = Uint8Array.from(atob(motif.base64), (c) => c.charCodeAt(0));
      const up = await supabaseAdmin.storage
        .from("pieces")
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (up.error) continue;
      index.push({
        index: motif.index,
        path,
        type: motif.type,
        relSize: motif.relSize,
        bbox: motif.bbox,
        ...(motif.bboxRel ? { bboxRel: motif.bboxRel } : {}),
        ...(motif.name ? { name: motif.name } : {}),
        ...(motif.offTheme ? { offTheme: true } : {}),
        ...(motif.excluded ? { excluded: true } : {}),
      });
    }

    await supabase
      .from("collections")
      .update({ motifs: index as never })
      .eq("id", collection.id)
      .eq("user_id", userId);

    const paths = index.map((m) => m.path);
    const urls: Record<string, string> = {};
    if (paths.length > 0) {
      const signed = await supabase.storage.from("pieces").createSignedUrls(paths, 60 * 60);
      for (const item of signed.data ?? []) {
        if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
      }
    }
    return { motifs: index, urls };
  });

/**
 * Tira ou devolve um motivo da coleção, sem gerar imagem nenhuma.
 * Monta a prancha filtrada apagando as caixas dos motivos excluídos.
 */
export const setMotifExcluded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      collectionId: uuid,
      index: z.number().int().min(0).max(64),
      excluded: z.boolean(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { eraseRegions } = await import("@/lib/assembly/image.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id, motifs, motif_sheet_path, motif_sheet_filtered_path")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");

    const motifs = (
      Array.isArray(collection.motifs) ? collection.motifs : []
    ) as unknown as MotifIndexEntry[];
    const updated = motifs.map((m) =>
      m.index === data.index ? { ...m, excluded: data.excluded } : m,
    );

    const regions = updated
      .filter((m) => m.excluded && m.bboxRel)
      .map((m) => m.bboxRel!);

    let filteredPath: string | null = null;
    if (regions.length > 0 && collection.motif_sheet_path) {
      const sheet = await supabaseAdmin.storage
        .from("pieces")
        .download(collection.motif_sheet_path);
      if (sheet.error || !sheet.data) throw new Error("A prancha de motivos não foi encontrada.");
      const filtered = eraseRegions(new Uint8Array(await sheet.data.arrayBuffer()), regions);
      filteredPath = `${userId}/${collection.id}/motifs/sheet-filtered.png`;
      const up = await supabaseAdmin.storage
        .from("pieces")
        .upload(filteredPath, filtered, { contentType: "image/png", upsert: true });
      if (up.error) throw new Error("Não foi possível salvar a prancha sem os motivos tirados.");
    }

    await supabase
      .from("collections")
      .update({ motifs: updated as never, motif_sheet_filtered_path: filteredPath })
      .eq("id", collection.id)
      .eq("user_id", userId);

    let sheetUrl: string | null = null;
    const showPath = filteredPath ?? collection.motif_sheet_path;
    if (showPath) {
      const signed = await supabase.storage.from("pieces").createSignedUrl(showPath, 60 * 60);
      sheetUrl = signed.data?.signedUrl ?? null;
    }
    return { motifs: updated, sheetUrl };
  });
