/**
 * Processador de geração no servidor.
 * Roda independente do navegador: a artesã pode fechar o app que o trabalho segue.
 *
 * Cada trabalho é uma linha em generation_units, com posse por token e prazo.
 * Só quem tem o token publica o resultado, então dois processadores nunca
 * escrevem por cima um do outro nem perdem unidades enfileiradas no meio.
 */

import { base64FromBytes, openAiKey } from "@/lib/ai/openai.server";
import {
  fixSeamImage,
  generateFromSheet,
  generateSheet,
  generateSolid,
  type ImageOut,
  type ProviderAttempt,
} from "@/lib/ai/images.server";
import { BUILD_STAMP } from "@/lib/build-stamp";

import {
  checkBands,
  checkComposition,
  checkSeamFromPng,
  mergeSeamFix,
  prepareSeamFix,
  seamAxisForFamily,
  type BandSpec,
  type FrameSpec,
} from "@/lib/assembly/image.server";



export type UnitKind = "prancha" | "peca" | "emenda" | "variante";
export type UnitStatus = "fila" | "rodando" | "ok" | "erro" | "cancelada";

export type VariantLabel = "xadrez" | "listras" | "outra-cor";

export interface UnitOptions {
  hiFi?: boolean;
  reinforce?: boolean;
  force?: boolean;
  label?: VariantLabel;

}

export interface UnitRow {
  id: string;
  job_id: string;
  collection_id: string;
  piece_id: string | null;
  kind: string;
  options: unknown;
  status: string;
  attempt: number;
  error: string | null;
}

const CONCURRENCY = 3;
/** Prazo esperado da geração principal de uma peça. */
const GEN_SOFT_MS = 120_000;
/** Limite duro: passou disso, a arte não é mais aproveitada. */
const GEN_HARD_MS = 150_000;
/** Orçamento separado para conferências e conserto de emenda. */
const CHECK_BUDGET_MS = 60_000;
/** Abaixo disto não vale começar um conserto de emenda. */
const FIX_MIN_MS = 20_000;
const UNIT_TIMEOUT_MS = GEN_HARD_MS + CHECK_BUDGET_MS;
const MAX_ATTEMPTS = 2;
/** Peso máximo de um lote: no máximo uma unidade pesada junto com uma leve. */
// Medido em 14/09: três peças pesadas juntas estouram a memória do servidor
// ("Worker exceeded memory limit"). Com orçamento 2, uma pesada roda sozinha.
const WEIGHT_BUDGET = 2;

/** Prazo de posse de uma unidade, renovado a cada batida. */
const LEASE_SECONDS = 180;
const HEARTBEAT_MS = 20_000;
/** Orçamento de tempo de cada chamada ao processador. */
const SLICE_BUDGET_MS = 100_000;
/** Não começa um lote novo se sobrar menos que isto. */
const RESERVE_MS = 60_000;

/** Registro por etapa, sem valores sensíveis. */
function logStep(
  info: { jobId: string; unitId?: string; kind?: string; step: string; ms?: number },
  extra?: Record<string, unknown>,
): void {
  const memory =
    typeof process !== "undefined" && typeof process.memoryUsage === "function"
      ? Math.round(process.memoryUsage().rss / (1024 * 1024))
      : undefined;
  console.info(
    "[fila]",
    JSON.stringify({
      build: BUILD_STAMP,
      ...info,
      ...(memory !== undefined ? { rssMb: memory } : {}),
      ...(extra ?? {}),
    }),
  );
}


type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

function optionsOf(unit: UnitRow): UnitOptions {
  return (unit.options ?? {}) as UnitOptions;
}

/** Toda gravação é conferida: falha de banco vira erro da unidade, nunca "ok". */
function assertWrite(error: { message?: string } | null, label: string): void {
  if (error) throw new Error(`${label} (${error.message ?? "erro no banco"})`);
}

/** Timeout de verdade: aborta a chamada em voo em vez de só desistir dela. */
async function withDeadline<T>(
  ms: number,
  label: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`${label} demorou demais e foi interrompida.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Mantém a posse da unidade viva enquanto a imagem é gerada. */
function keepLease(db: Admin, jobId: string, unitId: string, token: string): () => void {
  const timer = setInterval(() => {
    void db
      .rpc("touch_generation_unit", {
        _id: unitId,
        _token: token,
        _lease_seconds: LEASE_SECONDS,
      })
      .then(({ data, error }) => {
        if (error) {
          logStep({ jobId, unitId, step: "batida_falhou" }, { motivo: error.message });
        } else if (data === false) {
          logStep({ jobId, unitId, step: "posse_perdida" });
        }
      });
  }, HEARTBEAT_MS);
  return () => clearInterval(timer);
}


function lightestColor(palette: string[]): string {
  const valid = palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  if (valid.length === 0) return "#FFF8EF";
  const lum = (hex: string) =>
    0.299 * parseInt(hex.slice(1, 3), 16) +
    0.587 * parseInt(hex.slice(3, 5), 16) +
    0.114 * parseInt(hex.slice(5, 7), 16);
  return [...valid].sort((a, b) => lum(b) - lum(a))[0]!;
}

/** Guarda uma versão da arte ao lado da peça, sem apagar nada. */
export async function saveVersion(
  db: Admin,
  input: {
    pieceId: string;
    collectionId: string;
    kind: "original" | "conserto" | "alta_fidelidade" | "ampliacao" | "variante";
    label: string;
    imagePath: string;
    seam?: { ok: boolean; score: number } | null;
  },
): Promise<void> {
  await db.from("piece_versions").upsert(
    {
      piece_id: input.pieceId,
      collection_id: input.collectionId,
      kind: input.kind,
      label: input.label,
      image_path: input.imagePath,
      seam: (input.seam ?? null) as never,
    },
    { onConflict: "piece_id,kind,label" },
  );
}


// ------------------------------------------------------------------
// Prancha de motivos
// ------------------------------------------------------------------

export async function runSheetUnit(input: {
  collectionId: string;
  userId: string;
  force?: boolean;
  signal: AbortSignal;
}): Promise<void> {
  const db = await admin();
  const { buildMotifSheetPrompt, SHEET_SIZE } = await import("@/lib/ai/prompt.server");

  const { data: collection, error } = await db
    .from("collections")
    .select("*")
    .eq("id", input.collectionId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler a coleção.");
  if (!collection) throw new Error("Coleção não encontrada.");
  // Já existe prancha: não refaz sem pedido explícito.
  if (collection.motif_sheet_path && input.force !== true) return;

  const { styleDescription } = await import("@/lib/ai/prompt.server");
  const { reviewSheet } = await import("@/lib/ai/review.server");

  const brief = (collection.brief ?? {}) as Record<string, unknown>;
  const direction = (collection.direction ?? {}) as {
    shared?: string;
    motifs?: { name: string; en: string }[];
    avoid?: string[];
    fillers?: string[];
    category?: string;
    secondaryLanguage?: { name?: string; en?: string; note?: string } | null;
  };
  const palette = ((collection.palette as string[]) ?? []).filter(Boolean);
  const motifsEn = (direction.motifs ?? []).map((m) => m.en).filter(Boolean);
  const motifNames = (direction.motifs ?? []).map((m) => m.name).filter(Boolean);
  if (motifsEn.length === 0) {
    throw new Error("Ainda não sei quais motivos desenhar. Elabore a ideia de novo.");
  }
  const base = {
    motifs: motifsEn,
    fillers: direction.fillers ?? [],
    styleDescription: styleDescription(String(brief["style"] ?? "")),
    style: String(brief["style"] ?? ""),
    sharedDirection: direction.shared ?? "",
    palette,
  };

  const timings: Record<string, number> = {};
  const timed = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try {
      return await run();
    } finally {
      timings[label] = Math.round((Date.now() - t0) / 100) / 10;
    }
  };

  // Fundo liso claro: o recorte de motivos usa a distância até esse tom.
  const SHEET_BACKGROUND = "#F7F3EE";
  const paint = async (strict: boolean, quality?: "medium") => {
    const out = await generateSheet({
      promptTransparent: buildMotifSheetPrompt({ ...base, strict }),
      promptPlain: buildMotifSheetPrompt({
        ...base,
        strict,
        plainBackgroundHex: SHEET_BACKGROUND,
      }),
      size: SHEET_SIZE,
      ...(quality ? { quality } : {}),
      signal: input.signal,
    });
    return { ...out, b64: base64FromBytes(out.bytes) };
  };

  const path = `${input.userId}/${input.collectionId}/motifs/sheet.png`;
  const upload = async (bytes: Uint8Array) => {
    const up = await db.storage
      .from("pieces")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error("Não foi possível salvar a prancha de motivos.");
  };

  let sheet = await timed("prancha", () => paint(false));
  const confer = (b64: string) =>
    reviewSheet({
      key: openAiKey(),
      base64Png: b64,
      motifs: motifNames,
      avoid: direction.avoid ?? [],
      category: direction.category ?? "",
      signal: input.signal,
    });

  // Conferência e envio da prancha correm juntos: um não depende do outro.
  let [review] = await timed("conferencia_e_envio", () =>
    Promise.all([confer(sheet.b64), upload(sheet.bytes)]),
  );


  // Só refaz quando o intruso é motivo grande ou médio. Enfeite pequeno é só excluído.
  const intruder = review.elements.some(
    (e) =>
      (e.status === "excluido" || e.status === "fora-da-categoria") &&
      Math.max(e.bbox.w, e.bbox.h) >= 12,
  );
  if (intruder) {
    sheet = await timed("refazer", () => paint(true, "medium"));
    [review] = await timed("refazer_conferencia_e_envio", () =>
      Promise.all([confer(sheet.b64), upload(sheet.bytes)]),
    );
  }
  console.log("[prancha] tempos", input.collectionId, JSON.stringify(timings));

  const saved = await db
    .from("collections")
    .update({
      motif_sheet_path: path,
      motif_sheet_filtered_path: null,
      motifs: [] as never,
      direction: {
        ...direction,
        sheetReview: review,
        sheetTimings: timings,
        sheetModel: { provider: sheet.provider, model: sheet.model, size: sheet.size },
      } as never,

    })
    .eq("id", input.collectionId);
  assertWrite(saved.error, "Não foi possível registrar a prancha de motivos.");
}

// ------------------------------------------------------------------
// Peça
// ------------------------------------------------------------------

/** Motivos que continuam valendo: os do diretor, menos os que a artesã tirou. */
/**
 * Linguagem grafica secundaria da colecao, em ingles, para os prompts das pecas.
 * Quando a pessoa restringiu a colecao a uma categoria ("somente frutas"), a lista de
 * elementos permitidos nao inclui o ornamento, entao nao pedimos ele nas pecas para
 * nao mandar desenhar e proibir ao mesmo tempo.
 */
function secondaryOf(direction: {
  secondaryLanguage?: { en?: string } | null;
  category?: string;
}): string | undefined {
  if (String(direction.category ?? "").trim() !== "") return undefined;
  const en = String(direction.secondaryLanguage?.en ?? "").trim();
  return en === "" ? undefined : en;
}

function allowedMotifsOf(
  direction: { motifs?: { name: string; en: string }[] },
  motifIndex: unknown,
): string[] {
  const out = Array.isArray(motifIndex)
    ? (motifIndex as { name?: string; excluded?: boolean }[])
        .filter((m) => m?.excluded)
        .map((m) => String(m.name ?? "").toLowerCase())
        .filter(Boolean)
    : [];
  return (direction.motifs ?? [])
    .filter((m) => {
      const name = m.name.toLowerCase();
      return !out.some((n) => n.includes(name) || name.includes(n));
    })
    .map((m) => m.en)
    .filter(Boolean);
}

/** A prancha em uso: a filtrada quando existe, senão a original. */
function sheetPathOf(collection: {
  motif_sheet_path?: string | null;
  motif_sheet_filtered_path?: string | null;
}): string | null {
  return collection.motif_sheet_filtered_path || collection.motif_sheet_path || null;
}

/** Plano de faixas do barrado múltiplo, usado na conferência da composição. */
function bandSpecOf(spec: {
  family: string;
  cut_length_cm: number;
  params: Record<string, unknown>;
}): BandSpec | null {
  if (spec.family !== "barrado") return null;
  const p = spec.params ?? {};
  const bands = Number(p["bands"] ?? 1);
  if (bands < 2) return null;
  const bandHeight = Number(p["bandHeightCm"] ?? 9);
  const raw = Array.isArray(p["bandHeightsCm"]) ? (p["bandHeightsCm"] as number[]) : [];
  const heights = raw.length === bands ? raw : Array.from({ length: bands }, () => bandHeight);
  const trim = Number(p["trimCm"] ?? 0);
  const margin = Number(p["marginCm"] ?? 0);
  const slots: BandSpec["slots"] = [];
  if (margin > 0) slots.push({ kind: "margem", heightCm: margin });
  heights.forEach((h, i) => {
    if (i > 0 && trim > 0) slots.push({ kind: "barrinha", heightCm: trim });
    slots.push({ kind: "faixa", heightCm: h });
  });
  if (margin > 0) slots.push({ kind: "margem", heightCm: margin });
  return { slots, cutCm: Number(spec.cut_length_cm ?? 50) };
}

function frameSpecOf(params: Record<string, unknown>): FrameSpec | null {

  const frames = params["frames"] as
    | {
        widthCm?: number;
        heightCm?: number;
        accent?: string;
        renderLandscape?: boolean;
        quietArea?: { widthCm?: number; heightCm?: number };
      }
    | undefined;
  if (!frames) return null;
  const w = Number(frames.widthCm ?? 50);
  const h = Number(frames.heightCm ?? 50);
  // Quadro deitado: a arte sai virada, então as medidas conferidas viram junto.
  const landscape = frames.renderLandscape === true;
  return {
    widthCm: landscape ? Math.max(w, h) : w,
    heightCm: landscape ? Math.min(w, h) : h,
    ...(frames.accent ? { accent: String(frames.accent) } : {}),
    ...(frames.quietArea
      ? {
          quietArea: {
            widthCm: Number(frames.quietArea.widthCm ?? 20),
            heightCm: Number(frames.quietArea.heightCm ?? 20),
          },
        }
      : {}),
  };
}


export async function runPieceUnit(input: {
  pieceId: string;
  userId: string;
  hiFi?: boolean;
  reinforce?: boolean;
  signal: AbortSignal;
}): Promise<void> {
  const db = await admin();
  const { buildFromSheetPrompt, imageSizeFor, blenderKindOf, isSolidDotApp } = await import(
    "@/lib/ai/prompt.server"
  );

  const { data: piece, error } = await db
    .from("pieces")
    .select("*, collections!inner(*)")
    .eq("id", input.pieceId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler a peça.");
  if (!piece) throw new Error("Peça não encontrada.");
  const collection = (piece as unknown as { collections: Record<string, unknown> }).collections;
  if (collection["user_id"] !== input.userId) throw new Error("Peça não encontrada.");

  const { data: app } = await db
    .from("applications")
    .select("*")
    .eq("id", piece.application_id)
    .maybeSingle();
  if (!app) throw new Error("Aplicação não encontrada no catálogo.");

  const previousStatus = String(piece.status ?? "pendente");
  const previousImage = piece.image_path;

  const marked = await db
    .from("pieces")
    .update({
      status: "gerando",
      error: null,
      seam: null,
      composition: null,
      // Controle técnico: um conserto automático de emenda por geração.
      seam_fix_free_used: false,
    })
    .eq("id", piece.id);
  assertWrite(marked.error, "Não foi possível marcar a peça como em geração.");

  const direction = (collection["direction"] ?? {}) as {
    shared?: string;
    pieces?: { pieceId: string; guidance: string }[];
    motifs?: { name: string; en: string }[];
    category?: string;
    secondaryLanguage?: { name?: string; en?: string; note?: string } | null;
  };
  const allowedMotifs = allowedMotifsOf(direction, collection["motifs"]);
  const guidance =
    direction.pieces?.find((p) => p.pieceId === piece.id)?.guidance ?? app.director_rules;
  const spec = {
    family: app.family as "corrida" | "barrado" | "painel",
    fabric_width_cm: Number(app.fabric_width_cm),
    cut_length_cm: Number(app.cut_length_cm),
    params: (app.params ?? {}) as Record<string, unknown>,
    slug: app.slug,
  };
  const palette = ((collection["palette"] as string[]) ?? []).filter(Boolean);
  const prompt = buildFromSheetPrompt({
    app: spec,
    sharedDirection: direction.shared ?? "",
    pieceGuidance: guidance,
    overrides: (piece.overrides ?? {}) as Record<string, number | string>,
    palette,
    style: String((collection["brief"] as Record<string, unknown> | null)?.["style"] ?? ""),
    ...(secondaryOf(direction) ? { secondary: secondaryOf(direction)! } : {}),
    ...(allowedMotifs.length > 0 ? { allowedMotifs } : {}),
    ...(input.reinforce ? { reinforce: true } : {}),
  });

  const startedAt = Date.now();
  try {
    const size = imageSizeFor(spec);
    const quality = blenderKindOf(spec) ? "medium" : "high";

    const attempts: ProviderAttempt[] = [];

    const generateBytes = async (signal: AbortSignal): Promise<ImageOut> => {
      if (isSolidDotApp(spec)) {
        // Poá liso e sólido não usa a prancha.
        return generateSolid({ prompt, size, quality, signal, attempts });
      }
      const sheetPath = sheetPathOf(
        collection as { motif_sheet_path?: string | null; motif_sheet_filtered_path?: string | null },
      );
      if (typeof sheetPath !== "string" || !sheetPath) {
        throw new Error("Esta coleção ainda não tem prancha de motivos.");
      }
      const sheet = await db.storage.from("pieces").download(sheetPath);
      if (sheet.error || !sheet.data) throw new Error("A prancha de motivos não foi encontrada.");
      return generateFromSheet({
        prompt,
        sheet: new Uint8Array(await sheet.data.arrayBuffer()),
        size,
        quality,
        signal,
        attempts,
        ...(input.hiFi ? { hiFi: true } : {}),
      });
    };

    // Limite duro da geração principal. Conferência e conserto têm orçamento próprio.
    const generateWithDeadline = () =>
      withDeadline(GEN_HARD_MS, "A geração", (signal) => generateBytes(signal));

    let first = await generateWithDeadline();
    if (Date.now() - startedAt > GEN_SOFT_MS) {
      console.info(
        "[peca] geração passou do prazo esperado",
        JSON.stringify({ pieceId: piece.id, ms: Date.now() - startedAt, build: BUILD_STAMP }),
      );
    }
    let bytes = first.bytes;
    let usedModel = first.model;
    let usedSize = first.size;
    let usedProvider = first.provider;
    let usedWidth = first.width;
    let usedHeight = first.height;


    const generateMs = Date.now() - startedAt;
    const path = `${input.userId}/${piece.collection_id}/${piece.id}.png`;

    // Conferência no servidor: emenda nas repetições, composição nas posicionadas.
    let seam: { ok: boolean; score: number } | null = null;
    let composition: Record<string, unknown> | null = null;
    let fixMs = 0;
    const checkStart = Date.now();
    const axis = seamAxisForFamily(spec.family);
    const bandSpec = bandSpecOf(spec);

    if (spec.family === "painel") {
      const frame = frameSpecOf(spec.params);
      if (frame) composition = checkComposition(bytes, frame) as unknown as Record<string, unknown>;
    } else if (bandSpec) {
      let result = checkBands(bytes, bandSpec);
      if (!result.ok) {
        // Uma retentativa automática antes de aceitar as faixas fora do combinado.
        try {
          const left = CHECK_BUDGET_MS - (Date.now() - checkStart);
          if (left < FIX_MIN_MS) throw new Error("Sem tempo para refazer as faixas.");
          const retry = await withDeadline(left, "A geração", (signal) => generateBytes(signal));
          const retryResult = checkBands(retry.bytes, bandSpec);
          if (retryResult.ok || (retryResult.crossShare ?? 1) < (result.crossShare ?? 1)) {
            first = retry;
            bytes = retry.bytes;
            usedModel = retry.model;
            usedSize = retry.size;
            usedProvider = retry.provider;
            usedWidth = retry.width;
            usedHeight = retry.height;
            result = retryResult;

          }
        } catch {
          // Se a retentativa falhar, segue com a primeira arte.
        }
      }
      composition = result as unknown as Record<string, unknown>;
      seam = checkSeamFromPng(bytes, axis);
    } else {

      seam = checkSeamFromPng(bytes, axis);
      const fixBudget = CHECK_BUDGET_MS - (Date.now() - checkStart);
      // O conserto é um extra: só roda se sobrar tempo e nunca derruba a peça pronta.
      if (!seam.ok && fixBudget >= FIX_MIN_MS) {
        const fixStart = Date.now();
        const originalBytes = bytes;
        try {
          const { buildSeamFixPrompt } = await import("@/lib/ai/prompt.server");
          const prepared = prepareSeamFix(originalBytes);
          const fixed = await withDeadline(fixBudget, "O conserto da emenda", (signal) =>
            fixSeamImage({
              image: prepared.image,
              mask: prepared.mask,
              prompt: buildSeamFixPrompt({
                app: spec,
                style: String((collection["brief"] as Record<string, unknown>)?.["style"] ?? ""),
              }),
              signal,
              attempts,
            }),
          );
          const restored = mergeSeamFix(originalBytes, fixed.bytes);

          const after = checkSeamFromPng(restored, axis);
          await db.from("pieces").update({ seam_fix_free_used: true }).eq("id", piece.id);
          // Só aceita o conserto quando a medida melhora de verdade.
          if (after.score < seam.score) {
            // A arte original nunca se perde: fica guardada como versão.
            const originalPath = `${input.userId}/${piece.collection_id}/${piece.id}-original.png`;
            const keep = await db.storage
              .from("pieces")
              .upload(originalPath, originalBytes, { contentType: "image/png", upsert: true });
            if (!keep.error) {
              await saveVersion(db, {
                pieceId: piece.id,
                collectionId: String(piece.collection_id),
                kind: "original",
                label: "sem conserto",
                imagePath: originalPath,
                seam,
              });
            }
            bytes = restored;
            seam = after;
          }
        } catch {
          // O conserto é um extra: se falhar, a peça segue com o aviso de emenda.
        }
        fixMs = Date.now() - fixStart;
      }
    }

    const checkMs = Date.now() - checkStart - fixMs;

    const up = await db.storage
      .from("pieces")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error("Não foi possível salvar a imagem gerada.");

    const timings = {
      generateMs,
      checkMs,
      fixMs,
      totalMs: Date.now() - startedAt,
      provider: usedProvider,
      model: usedModel,
      quality: input.hiFi ? "high" : quality,
      size: usedSize,
      build: BUILD_STAMP,
      attempts,
      ...(usedWidth && usedHeight ? { pixels: `${usedWidth}x${usedHeight}` } : {}),
    };


    const saved = await db
      .from("pieces")
      .update({
        status: "pronta",
        image_path: path,
        prompt,
        error: null,
        made_by: "ia",
        image_print_path: null,
        print_dpi: null,
        composition: composition as never,
        seam: seam as never,
        timings: timings as never,
      })
      .eq("id", piece.id);
    assertWrite(saved.error, "Não foi possível registrar a peça pronta.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar a estampa.";
    // Recriação que falhou: a arte anterior continua valendo.
    await db
      .from("pieces")
      .update(
        previousImage
          ? { status: previousStatus === "pronta" ? "pronta" : "erro", error: message }
          : { status: "erro", error: message },
      )
      .eq("id", piece.id);
    throw new Error(message);
  }
}

/** Conserto de emenda pedido pela artesã. Nunca sobrescreve a arte original. */
export async function runSeamFixUnit(input: {
  pieceId: string;
  userId: string;
  signal: AbortSignal;
}): Promise<void> {
  const db = await admin();
  const { buildSeamFixPrompt } = await import("@/lib/ai/prompt.server");
  const { data: piece, error } = await db
    .from("pieces")
    .select("*, collections!inner(user_id, brief)")
    .eq("id", input.pieceId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler a peça.");
  if (!piece) throw new Error("Peça não encontrada.");
  const parent = (piece as unknown as {
    collections: { user_id: string; brief: Record<string, unknown> | null };
  }).collections;
  if (parent.user_id !== input.userId) throw new Error("Peça não encontrada.");
  if (!piece.image_path) throw new Error("Esta peça ainda não tem imagem.");

  const { data: app } = await db
    .from("applications")
    .select("family, fabric_width_cm, cut_length_cm, params, slug")
    .eq("id", piece.application_id)
    .maybeSingle();
  const spec = {
    family: (app?.family ?? "corrida") as "corrida" | "barrado" | "painel",
    fabric_width_cm: Number(app?.fabric_width_cm ?? 150),
    cut_length_cm: Number(app?.cut_length_cm ?? 50),
    params: (app?.params ?? {}) as Record<string, unknown>,
    slug: app?.slug ?? "",
  };
  const axis = seamAxisForFamily(spec.family);
  if (axis === "none") throw new Error("Esta peça não tem emenda para consertar.");

  const file = await db.storage.from("pieces").download(piece.image_path);
  if (file.error || !file.data) throw new Error("A imagem da peça não foi encontrada.");
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  const before = checkSeamFromPng(bytes, axis);

  const prepared = prepareSeamFix(bytes);
  const fixed = await fixSeamImage({
    image: prepared.image,
    mask: prepared.mask,
    prompt: buildSeamFixPrompt({
      app: spec,
      style: String(parent.brief?.["style"] ?? ""),
    }),
    signal: input.signal,
  });
  const restored = mergeSeamFix(bytes, fixed.bytes);

  const seam = checkSeamFromPng(restored, axis);
  if (seam.score >= before.score) {
    throw new Error("O conserto não melhorou a emenda. A arte atual foi mantida.");
  }

  // A arte anterior vira versão antes de a nova entrar no lugar.
  const originalPath = `${input.userId}/${piece.collection_id}/${piece.id}-original.png`;
  const keep = await db.storage
    .from("pieces")
    .upload(originalPath, bytes, { contentType: "image/png", upsert: true });
  if (!keep.error) {
    await saveVersion(db, {
      pieceId: piece.id,
      collectionId: String(piece.collection_id),
      kind: "original",
      label: "sem conserto",
      imagePath: originalPath,
      seam: before,
    });
  }

  const up = await db.storage
    .from("pieces")
    .upload(piece.image_path, restored, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error("Não foi possível salvar a imagem corrigida.");

  await saveVersion(db, {
    pieceId: piece.id,
    collectionId: String(piece.collection_id),
    kind: "conserto",
    label: "emenda consertada",
    imagePath: piece.image_path,
    seam,
  });

  const saved = await db
    .from("pieces")
    .update({ seam: seam as never, image_print_path: null, error: null })
    .eq("id", piece.id);
  assertWrite(saved.error, "Não foi possível registrar a emenda corrigida.");
}

// ------------------------------------------------------------------
// Versões em xadrez e listras
// ------------------------------------------------------------------

/** Aplicação do catálogo que empresta os parâmetros de cada variante. */
const VARIANT_SOURCE: Record<VariantLabel, string | null> = {
  xadrez: "xadrez-coordenado",
  listras: "listrado-coordenado",
  "outra-cor": null,
};


/** Cor mais escura da paleta, usada como marca das variantes. */
function strongestColor(palette: string[]): string {
  const valid = palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  if (valid.length === 0) return "#6F1B2C";
  const lum = (hex: string) =>
    0.299 * parseInt(hex.slice(1, 3), 16) +
    0.587 * parseInt(hex.slice(3, 5), 16) +
    0.114 * parseInt(hex.slice(5, 7), 16);
  return [...valid].sort((a, b) => lum(a) - lum(b))[0]!;
}

/**
 * Gera a versão em xadrez ou listras de uma peça, sem tocar na original.
 * Coordenados e barrados viram o desenho chapado inteiro; painéis mantêm a
 * composição de cantos e trocam só o fundo.
 */
export async function runVariantUnit(input: {
  pieceId: string;
  userId: string;
  label: VariantLabel;
  signal: AbortSignal;
}): Promise<void> {
  const db = await admin();
  const { buildSolidDotPrompt, buildFromSheetPrompt, imageSizeFor } = await import(
    "@/lib/ai/prompt.server"
  );

  const { data: piece, error } = await db
    .from("pieces")
    .select(
      "*, collections!inner(user_id, palette, direction, motifs, brief, motif_sheet_path, motif_sheet_filtered_path)",
    )
    .eq("id", input.pieceId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler a peça.");
  if (!piece) throw new Error("Peça não encontrada.");
  const parent = (piece as unknown as {
    collections: {
      user_id: string;
      palette: string[] | null;
      direction: Record<string, unknown> | null;
      motifs: unknown;
      brief: Record<string, unknown> | null;
      motif_sheet_path: string | null;
      motif_sheet_filtered_path: string | null;
    };
  }).collections;
  if (parent.user_id !== input.userId) throw new Error("Peça não encontrada.");

  const palette = (parent.palette ?? []).filter(Boolean);
  const background = lightestColor(palette);
  const mark = strongestColor(palette);
  // "Outra cor" promove a segunda cor dominante da paleta.
  const second = palette[1] ?? mark;
  const variantPalette =
    input.label === "outra-cor" && palette.length > 1
      ? [second, palette[0]!, ...palette.slice(2)]
      : palette;
  const colorLine =
    input.label === "outra-cor"
      ? `keep the same drawing and change the dominant color to ${second}, background color: ${background}`
      : `background color: ${background} ${input.label === "listras" ? "stripe" : "check"} color: ${mark}`;

  const { data: app } = await db
    .from("applications")
    .select("family, fabric_width_cm, cut_length_cm, params, slug")
    .eq("id", piece.application_id)
    .maybeSingle();
  if (!app) throw new Error("Aplicação não encontrada no catálogo.");

  const sourceId = VARIANT_SOURCE[input.label];
  let source: { params: unknown; slug: string } | null = null;
  if (sourceId) {
    const found = await db
      .from("applications")
      .select("params, slug")
      .eq("id", sourceId)
      .maybeSingle();
    if (!found.data) throw new Error("Modelo da variante não encontrado no catálogo.");
    source = found.data as { params: unknown; slug: string };
  }

  const family = app.family as "corrida" | "barrado" | "painel";
  let bytes: Uint8Array;

  if (family === "painel" || family === "barrado") {
    const spec = {
      family,
      fabric_width_cm: Number(app.fabric_width_cm),
      cut_length_cm: Number(app.cut_length_cm),
      params: (app.params ?? {}) as Record<string, unknown>,
      slug: app.slug,
    };
    const sheetPath = sheetPathOf(parent);
    if (!sheetPath) throw new Error("Esta coleção ainda não tem prancha de motivos.");
    const sheet = await db.storage.from("pieces").download(sheetPath);
    if (sheet.error || !sheet.data) throw new Error("A prancha de motivos não foi encontrada.");
    const direction = (parent.direction ?? {}) as {
      shared?: string;
      pieces?: { pieceId: string; guidance: string }[];
      motifs?: { name: string; en: string }[];
      category?: string;
      secondaryLanguage?: { name?: string; en?: string; note?: string } | null;
    };
    const allowedMotifs = allowedMotifsOf(direction, parent.motifs);
    const guidance = direction.pieces?.find((p) => p.pieceId === piece.id)?.guidance ?? "";
    const fill =
      input.label === "xadrez"
        ? `a flat gingham check in ${mark} on ${background}, small 8 mm squares, crisp edges`
        : input.label === "listras"
          ? `flat vertical stripes in ${mark} on ${background}, thin stripes every 10 mm, crisp edges`
          : `flat plain grounds in ${second} and its lighter tints`;
    const ground =
      family === "barrado"
        ? `Keep exactly the same bands, the same band heights, the same trim strips and the same motifs; replace only the plain grounds of the bands with ${fill}.`
        : `Fill the whole background with ${fill}. Keep exactly the same corner composition, the same border line and the same empty plate area as a normal panel of this collection.`;
    const run = await generateFromSheet({
      prompt: buildFromSheetPrompt({
        app: spec,
        sharedDirection: direction.shared ?? "",
        pieceGuidance: `${guidance} ${ground}`,
        overrides: (piece.overrides ?? {}) as Record<string, number | string>,
        palette: variantPalette,
        style: String(parent.brief?.["style"] ?? ""),
        ...(secondaryOf(direction) ? { secondary: secondaryOf(direction)! } : {}),
        ...(allowedMotifs.length > 0 ? { allowedMotifs } : {}),
      }),
      sheet: new Uint8Array(await sheet.data.arrayBuffer()),
      size: imageSizeFor(spec),
      quality: "high",
      signal: input.signal,
    });
    bytes = run.bytes;
  } else {
    const spec = {
      family: "corrida" as const,
      fabric_width_cm: Number(app.fabric_width_cm),
      cut_length_cm: Number(app.cut_length_cm),
      params: ((source?.params ?? app.params) ?? {}) as Record<string, unknown>,
      slug: source?.slug ?? app.slug,
    };
    const run = await generateSolid({
      prompt: buildSolidDotPrompt({
        app: spec,
        pieceGuidance: colorLine,
        palette: variantPalette,
        overrides: (piece.overrides ?? {}) as Record<string, number>,
      }),
      size: imageSizeFor(spec),
      quality: "medium",
      signal: input.signal,
    });
    bytes = run.bytes;
  }


  const path = `${input.userId}/${piece.collection_id}/${piece.id}-${input.label}.png`;

  const up = await db.storage
    .from("pieces")
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error("Não foi possível salvar a versão gerada.");

  const axis = seamAxisForFamily(family);
  await saveVersion(db, {
    pieceId: piece.id,
    collectionId: String(piece.collection_id),
    kind: "variante",
    label: input.label,
    imagePath: path,
    seam: axis === "none" ? null : checkSeamFromPng(bytes, axis),
  });
}


// ------------------------------------------------------------------
// Reconciliação de peças travadas
// ------------------------------------------------------------------

/**
 * Peça parada em "gerando" há mais de 10 minutos.
 * Com imagem antiga volta para pronta, sem imagem vira erro.
 */
export async function reconcileStuckPieces(collectionId?: string): Promise<number> {
  const db = await admin();
  const limit = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let query = db
    .from("pieces")
    .select("id, collection_id, image_path, updated_at")
    .eq("status", "gerando")
    .lt("updated_at", limit);
  if (collectionId) query = query.eq("collection_id", collectionId);
  const { data: stuck } = await query;

  let count = 0;
  for (const piece of stuck ?? []) {
    await db
      .from("pieces")
      .update(
        piece.image_path
          ? { status: "pronta", error: "A recriação foi interrompida." }
          : { status: "erro", error: "A geração foi interrompida. Tente de novo." },
      )
      .eq("id", piece.id);
    count += 1;
  }
  return count;
}

// ------------------------------------------------------------------
// Laço do job
// ------------------------------------------------------------------

async function runUnit(unit: UnitRow, userId: string, signal: AbortSignal): Promise<void> {
  const options = optionsOf(unit);
  if (unit.kind === "prancha") {
    await runSheetUnit({
      collectionId: unit.collection_id,
      userId,
      signal,
      ...(options.force ? { force: true } : {}),
    });
    return;
  }
  if (!unit.piece_id) throw new Error("Unidade sem peça.");
  if (unit.kind === "emenda") {
    await runSeamFixUnit({ pieceId: unit.piece_id, userId, signal });
    return;
  }
  if (unit.kind === "variante") {
    await runVariantUnit({
      pieceId: unit.piece_id,
      userId,
      label: options.label ?? "xadrez",
      signal,
    });
    return;
  }

  await runPieceUnit({
    pieceId: unit.piece_id,
    userId,
    signal,
    ...(options.hiFi ? { hiFi: true } : {}),
    ...(options.reinforce ? { reinforce: true } : {}),
  });
}

/** Processa uma unidade inteira e publica o resultado com o token de posse. */
async function processUnit(db: Admin, unit: UnitRow, token: string, userId: string): Promise<void> {
  const stopLease = keepLease(db, unit.job_id, unit.id, token);
  const startedAt = Date.now();
  const base = { jobId: unit.job_id, unitId: unit.id, kind: unit.kind };
  logStep({ ...base, step: "claim" }, { tentativa: unit.attempt });
  try {
    await withDeadline(UNIT_TIMEOUT_MS, "A geração", (signal) => runUnit(unit, userId, signal));
    logStep({ ...base, step: "gerado", ms: Date.now() - startedAt });
    const { error } = await db.rpc("finish_generation_unit", {
      _id: unit.id,
      _token: token,
      _status: "ok",
      _error: "",
      _result: { ms: Date.now() - startedAt } as never,
    });
    if (error) {
      logStep({ ...base, step: "falha_ao_finalizar" }, { motivo: error.message });
      throw new Error(`Não foi possível registrar o resultado (${error.message})`);
    }
    logStep({ ...base, step: "finalizado", ms: Date.now() - startedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar.";
    const retry = unit.attempt < MAX_ATTEMPTS;
    logStep({ ...base, step: "erro", ms: Date.now() - startedAt }, { retry, motivo: message });
    const { error } = await db.rpc("finish_generation_unit", {
      _id: unit.id,
      _token: token,
      _status: retry ? "fila" : "erro",
      _error: message,
      _result: { ms: Date.now() - startedAt } as never,
    });
    if (error) logStep({ ...base, step: "falha_ao_finalizar" }, { motivo: error.message });
  } finally {
    stopLease();
  }
}

async function claim(
  db: Admin,
  jobId: string,
  limit: number,
  token: string,
  kind?: UnitKind,
): Promise<UnitRow[]> {
  const { data, error } = await db.rpc("claim_generation_units", {
    _job_id: jobId,
    _limit: limit,
    _token: token,
    _lease_seconds: LEASE_SECONDS,
    _max_attempts: MAX_ATTEMPTS,
    ...(kind ? { _kind: kind } : {}),
  } as never);
  if (error) {
    logStep({ jobId, step: "falha_ao_pegar_unidades" }, { motivo: error.message });
    throw new Error(`Não foi possível pegar as próximas unidades (${error.message})`);
  }
  return (data ?? []) as unknown as UnitRow[];
}

/** Unidades que virão a seguir, na mesma ordem em que serão tomadas. */
async function peekQueue(
  db: Admin,
  jobId: string,
): Promise<{ id: string; kind: string; piece_id: string | null }[]> {
  const { data, error } = await db
    .from("generation_units")
    .select("id, kind, piece_id, status, attempt, lease_until")
    .eq("job_id", jobId)
    .in("status", ["fila", "rodando"])
    .order("created_at", { ascending: true })
    .limit(8);
  if (error) throw new Error(`Não foi possível ler a fila (${error.message})`);
  const now = Date.now();
  return (data ?? [])
    .filter(
      (u) =>
        u.status === "fila" ||
        ((!u.lease_until || new Date(u.lease_until).getTime() < now) && u.attempt < MAX_ATTEMPTS),
    )
    .map((u) => ({ id: u.id, kind: u.kind, piece_id: u.piece_id }));
}

/**
 * Peso de cada unidade: arte grande em alta qualidade pesa 2, coordenado leve pesa 1.
 * O lote nunca junta três unidades pesadas, que era o que derrubava o processo.
 */
async function weightsFor(
  db: Admin,
  units: { id: string; kind: string; piece_id: string | null }[],
): Promise<number[]> {
  const { blenderKindOf } = await import("@/lib/ai/prompt.server");
  const pieceIds = units.map((u) => u.piece_id).filter((id): id is string => Boolean(id));
  const lightPieces = new Set<string>();
  if (pieceIds.length > 0) {
    const { data: pieces } = await db
      .from("pieces")
      .select("id, application_id, applications(family, params)")
      .in("id", pieceIds);
    for (const row of (pieces ?? []) as unknown as {
      id: string;
      applications: { family: string; params: Record<string, unknown> } | null;
    }[]) {
      const app = row.applications;
      if (!app) continue;
      const light = blenderKindOf({
        family: app.family as "corrida" | "barrado" | "painel",
        params: (app.params ?? {}) as Record<string, unknown>,
        fabric_width_cm: 150,
        cut_length_cm: 50,
        slug: "",
      });
      if (light) lightPieces.add(row.id);
    }
  }
  return units.map((u) => {
    if (u.kind === "peca" || u.kind === "variante") {
      return u.piece_id && lightPieces.has(u.piece_id) ? 1 : 2;
    }
    return 2;
  });
}

/** Quantas unidades cabem no lote, respeitando o peso máximo. */
async function batchSizeFor(db: Admin, jobId: string): Promise<number> {
  const next = await peekQueue(db, jobId);
  if (next.length === 0) return 0;
  const weights = await weightsFor(db, next);
  let total = 0;
  let count = 0;
  for (const weight of weights) {
    if (count > 0 && total + weight > WEIGHT_BUDGET) break;
    total += weight;
    count += 1;
    if (count >= CONCURRENCY) break;
  }
  return count;
}


async function countByStatus(db: Admin, jobId: string): Promise<Record<string, number>> {
  const { data } = await db.from("generation_units").select("status").eq("job_id", jobId);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

/** Fecha o job com um estado honesto e ajusta o status da coleção. */
async function finalizeJob(
  db: Admin,
  job: { id: string; collection_id: string; cancel_requested: boolean },
  touchesCollection: boolean,
): Promise<void> {
  const counts = await countByStatus(db, job.id);
  const failed = counts["erro"] ?? 0;
  const cancelled = counts["cancelada"] ?? 0;
  const status = job.cancel_requested
    ? "cancelado"
    : failed > 0
      ? "concluido_com_falhas"
      : cancelled > 0
        ? "cancelado"
        : "concluido";

  await db
    .from("generation_jobs")
    .update({
      status,
      step: "finalizando",
      error: failed > 0 ? `${failed} unidade(s) não ficaram prontas.` : null,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (!touchesCollection) return;

  const { data: pieces } = await db
    .from("pieces")
    .select("status")
    .eq("collection_id", job.collection_id);
  const total = (pieces ?? []).length;
  const ready = (pieces ?? []).filter((p) => p.status === "pronta").length;
  if (total === 0) return;
  await db
    .from("collections")
    .update({ status: ready === total ? "pronta" : "pronta_com_falhas" })
    .eq("id", job.collection_id);
}

/**
 * Processa um pedaço do job.
 * pending diz se ainda há trabalho; resume diz se este processador deve continuar.
 */
export async function processJobSlice(
  jobId: string,
): Promise<{ pending: boolean; resume: boolean }> {
  const db = await admin();
  const sliceStart = Date.now();
  const token = crypto.randomUUID();

  const { data: job } = await db.from("generation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return { pending: false, resume: false };
  if (["concluido", "concluido_com_falhas", "erro", "cancelado"].includes(job.status)) {
    return { pending: false, resume: false };
  }

  // Só um processador por vez: quem tem batimento recente segue sozinho.
  const beat = job.heartbeat_at ? new Date(job.heartbeat_at).getTime() : 0;
  if (job.status === "rodando" && Date.now() - beat < 90_000) {
    return { pending: true, resume: false };
  }

  const claimJob = await db
    .from("generation_jobs")
    .update({
      status: "rodando",
      heartbeat_at: new Date().toISOString(),
      error: null,
      ...(job.started_at ? {} : { started_at: new Date().toISOString() }),
    })
    .eq("id", jobId)
    .eq("status", job.status)
    .select("id");
  if (!claimJob.data || claimJob.data.length === 0) return { pending: true, resume: false };

  await reconcileStuckPieces(job.collection_id);

  const { data: kinds } = await db
    .from("generation_units")
    .select("kind")
    .eq("job_id", jobId)
    .in("kind", ["prancha", "peca"])
    .limit(1);
  const touchesCollection = (kinds ?? []).length > 0;

  const cancelRequested = async () => {
    const { data } = await db
      .from("generation_jobs")
      .select("cancel_requested")
      .eq("id", jobId)
      .maybeSingle();
    return data?.cancel_requested === true;
  };

  let ranOut = false;

  // A prancha vem primeiro e sozinha: as peças dependem dela.
  const sheets = await claim(db, jobId, 1, token, "prancha");
  if (sheets.length > 0) {
    await db.from("generation_jobs").update({ step: "prancha" }).eq("id", jobId);
    await processUnit(db, sheets[0]!, token, job.user_id);
    const { data: after } = await db
      .from("generation_units")
      .select("status, error")
      .eq("id", sheets[0]!.id)
      .maybeSingle();
    if (after?.status === "erro") {
      // Sem prancha as peças não saem: cancela o resto da fila deste job.
      await db
        .from("generation_units")
        .update({ status: "cancelada", finished_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("status", "fila");
      await db
        .from("generation_jobs")
        .update({
          status: "erro",
          error: after.error ?? "Falha na prancha de motivos.",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return { pending: false, resume: false };
    }
  }

  await db.from("generation_jobs").update({ step: "pecas" }).eq("id", jobId);

  while (true) {
    if (Date.now() - sliceStart > SLICE_BUDGET_MS - RESERVE_MS) {
      ranOut = true;
      break;
    }
    if (await cancelRequested()) {
      await db
        .from("generation_units")
        .update({ status: "cancelada", finished_at: new Date().toISOString() })
        .eq("job_id", jobId)
        .eq("status", "fila");
      break;
    }
    const size = await batchSizeFor(db, jobId);
    if (size === 0) break;
    const batch = await claim(db, jobId, size, token);
    if (batch.length === 0) break;


    await db
      .from("generation_jobs")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", jobId);
    await Promise.all(batch.map((unit) => processUnit(db, unit, token, job.user_id)));
  }

  const counts = await countByStatus(db, jobId);
  const pending = (counts["fila"] ?? 0) + (counts["rodando"] ?? 0) > 0;

  if (!pending) {
    await finalizeJob(
      db,
      {
        id: jobId,
        collection_id: job.collection_id,
        cancel_requested: (await cancelRequested()) && (counts["cancelada"] ?? 0) > 0,
      },
      touchesCollection,
    );
    return { pending: false, resume: false };
  }

  await db
    .from("generation_jobs")
    .update({ status: "fila", heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);
  return { pending: true, resume: ranOut };
}
