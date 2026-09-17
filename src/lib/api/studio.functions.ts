/**
 * Server functions do fluxo prompt-first (v0.7): escrever, refinar e salvar o
 * prompt da peça principal, guardar os ajustes por clique e escolher versões.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { findClimate, findTheme } from "@/lib/studio-flow";

const uuid = z.string().uuid();
const MODEL_WRITER = "gpt-5-mini";

export interface MasterPromptResult {
  prompt: string;
  summary: string;
  palette: string[];
}

function cleanPalette(list: unknown): string[] {
  return (Array.isArray(list) ? list : [])
    .map((c) => String(c).trim().toUpperCase())
    .filter((c) => /^#[0-9A-F]{6}$/.test(c))
    .slice(0, 5);
}

async function callWriter(
  system: string,
  user: Record<string, unknown>,
): Promise<MasterPromptResult> {
  const { openAiKey, openAiError } = await import("@/lib/ai/openai.server");
  const { WRITER_SCHEMA } = await import("@/lib/ai/master-prompt.server");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_WRITER,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "prompt_principal", strict: true, schema: WRITER_SCHEMA },
      },
    }),
  });
  if (!res.ok) throw new Error(openAiError(res.status));
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(json.choices[0]!.message.content) as {
    prompt?: string;
    resumo?: string;
    paleta?: unknown;
  };
  const prompt = String(parsed.prompt ?? "").trim();
  if (!prompt) throw new Error("O escritor não devolveu o prompt. Tente de novo.");
  return {
    prompt,
    summary: String(parsed.resumo ?? "").trim(),
    palette: cleanPalette(parsed.paleta),
  };
}

type Db = SupabaseClient<Database>;

async function persistPrompt(
  supabase: Db,
  collectionId: string,
  userId: string,
  result: MasterPromptResult,
  extraBrief: Record<string, unknown>,
): Promise<void> {
  const { data: current } = await supabase
    .from("collections")
    .select("direction, brief")
    .eq("id", collectionId)
    .eq("user_id", userId)
    .maybeSingle();
  const row = (current ?? {}) as { direction?: unknown; brief?: unknown };
  const direction = (row.direction ?? {}) as Record<string, unknown>;
  const brief = (row.brief ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("collections")
    .update({
      direction: {
        ...direction,
        masterPrompt: result.prompt,
        masterSummary: result.summary,
      } as never,
      brief: { ...brief, ...extraBrief } as never,
      ...(result.palette.length > 0 ? { palette: result.palette } : {}),
    })
    .eq("id", collectionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Escreve o prompt da peça principal a partir de tema, clima e palavras da artesã. */
export const writeMasterPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid }).parse)
  .handler(async ({ data, context }): Promise<MasterPromptResult> => {
    const { supabase, userId } = context;
    const { WRITER_SYSTEM } = await import("@/lib/ai/master-prompt.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id, name, brief")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");

    const brief = (collection.brief ?? {}) as {
      theme?: string;
      themeName?: string;
      themeDesc?: string;
      words?: string;
      climate?: string;
      usage?: string;
    };
    const theme = findTheme(brief.theme);
    const climate = findClimate(brief.climate);
    if (!climate) throw new Error("Escolha o clima visual antes de escrever o prompt.");

    const result = await callWriter(WRITER_SYSTEM, {
      tema: theme?.name ?? brief.themeName ?? collection.name,
      descricaoDoTema: theme?.desc ?? brief.themeDesc ?? "",
      palavrasDaArtesa: brief.words ?? "",
      tecnica: { nome: climate.name, en: climate.en },
      uso: brief.usage ?? "",
    });

    await persistPrompt(supabase, collection.id, userId, result, { adjustments: [] });
    return result;
  });

/** Reescreve o prompt aplicando um pedido em português da artesã. */
export const rewriteMasterPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid, request: z.string().min(2).max(400) }).parse)
  .handler(async ({ data, context }): Promise<MasterPromptResult> => {
    const { supabase, userId } = context;
    const { REWRITER_SYSTEM, buildPrincipalPrompt } = await import("@/lib/ai/master-prompt.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id, direction, brief")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");
    const direction = (collection.direction ?? {}) as { masterPrompt?: string };
    const brief = (collection.brief ?? {}) as { adjustments?: string[] };
    const master = String(direction.masterPrompt ?? "").trim();
    if (!master) throw new Error("Escreva o prompt antes de pedir mudanças.");

    // Os ajustes por clique entram no texto: o pedido vale sobre o que a artesã vê.
    const result = await callWriter(REWRITER_SYSTEM, {
      prompt: buildPrincipalPrompt(master, brief.adjustments ?? []),
      pedido: data.request,
    });

    await persistPrompt(supabase, collection.id, userId, result, { adjustments: [] });
    return result;
  });

/** Salva o prompt editado à mão. Os ajustes por clique são zerados: o texto manda. */
export const saveMasterPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid, prompt: z.string().min(40).max(8000) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: current } = await supabase
      .from("collections")
      .select("direction, brief")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!current) throw new Error("Coleção não encontrada.");
    const direction = (current.direction ?? {}) as Record<string, unknown>;
    const brief = (current.brief ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from("collections")
      .update({
        direction: { ...direction, masterPrompt: data.prompt.trim() } as never,
        brief: { ...brief, adjustments: [] } as never,
      })
      .eq("id", data.collectionId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Guarda os ajustes por clique da peça principal. */
export const setAdjustments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ collectionId: uuid, adjustments: z.array(z.string().max(40)).max(12) }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: current } = await supabase
      .from("collections")
      .select("brief")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!current) throw new Error("Coleção não encontrada.");
    const brief = (current.brief ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from("collections")
      .update({ brief: { ...brief, adjustments: data.adjustments } as never })
      .eq("id", data.collectionId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Volta a peça principal para uma versão anterior. */
export const choosePrincipalVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ pieceId: uuid, imagePath: z.string().min(1).max(400) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: piece } = await supabase
      .from("pieces")
      .select("id, collection_id, collections!inner(user_id)")
      .eq("id", data.pieceId)
      .maybeSingle();
    if (!piece) throw new Error("Peça não encontrada.");
    const owner = (piece as unknown as { collections: { user_id: string } }).collections.user_id;
    if (owner !== userId) throw new Error("Peça não encontrada.");

    const { data: version } = await supabase
      .from("piece_versions")
      .select("id")
      .eq("piece_id", piece.id)
      .eq("image_path", data.imagePath)
      .maybeSingle();
    if (!version) throw new Error("Versão não encontrada.");

    const { error } = await supabase
      .from("pieces")
      .update({ image_path: data.imagePath, status: "pronta", error: null })
      .eq("id", piece.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------
// Miniaturas dos temas (passo 1). Geradas uma vez pelo administrador,
// guardadas no bucket público "temas" e servidas direto pela URL.
// ------------------------------------------------------------------

const THUMB_STYLE =
  "A square swatch of a finished commercial textile print, seen straight from above, edge to edge. Delicate gouache illustration with soft outlines, on a warm cream ground, dense tossed all-over layout with motifs at three sizes, natural overlaps, elements running off the edges. No text, no letters, no border, no mockup, no product photo, no shadows.";

export const generateThemeThumbnails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      /** Temas específicos para (re)gerar; sem isso, gera os que faltam. */
      ids: z.array(z.string().max(60)).max(6).optional(),
      limit: z.number().int().min(1).max(6).optional(),
    }).parse,
  )
  .handler(async ({ data, context }): Promise<{ done: string[]; remaining: number }> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (isAdmin !== true) throw new Error("Somente administradores podem gerar as miniaturas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateImage } = await import("@/lib/ai/gemini.server");
    const { ALL_THEMES } = await import("@/lib/studio-flow");

    const { data: existing } = await supabaseAdmin.storage.from("temas").list("", { limit: 200 });
    const have = new Set((existing ?? []).map((f) => f.name));
    const wanted = data.ids ? new Set(data.ids) : null;
    const pending = ALL_THEMES.filter((t) =>
      wanted ? wanted.has(t.id) : !have.has(`${t.id}.png`),
    );
    const batch = pending.slice(0, data.limit ?? 3);

    const done: string[] = [];
    for (const theme of batch) {
      const out = await generateImage({
        prompt: `${THUMB_STYLE}\n\nTHEME "${theme.name}": ${theme.desc}.`,
        aspectRatio: "1:1",
        imageSize: "512px",
        thinkingLevel: "minimal",
      });
      const up = await supabaseAdmin.storage
        .from("temas")
        .upload(`${theme.id}.png`, out.bytes, { contentType: "image/png", upsert: true });
      if (up.error) throw new Error(`Não foi possível salvar a miniatura de ${theme.name}.`);
      done.push(theme.id);
    }
    return { done, remaining: pending.length - done.length };
  });
