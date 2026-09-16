import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UnitKind = "prancha" | "peca" | "emenda" | "variante" | "principal" | "coordenado";

export interface JobUnitView {
  id: string;
  kind: UnitKind;
  pieceId: string | null;
  status: "fila" | "rodando" | "ok" | "erro" | "cancelada";
  error: string | null;
}

export interface JobView {
  id: string;
  status: string;
  step: string;
  cancelRequested: boolean;
  error: string | null;
  units: JobUnitView[];
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  createdAt: string;
}

const uuid = z.string().uuid();

async function currentBaseUrl(): Promise<string> {
  const { getRequestUrl } = await import("@tanstack/react-start/server");
  const { workerBaseUrl } = await import("./worker-base-url");
  return workerBaseUrl(getRequestUrl());
}

/** Acorda o processador e liga a verificação periódica enquanto houver fila. */
async function kickWorker(jobId: string, baseUrl: string): Promise<void> {
  const secret = process.env["GENERATION_WORKER_SECRET"];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!secret) {
    console.error("[generation] GENERATION_WORKER_SECRET está vazio; o trabalho não pode iniciar.");
    await supabaseAdmin
      .from("generation_jobs")
      .update({ error: "worker não respondeu" })
      .eq("id", jobId);
    return;
  }

  const { error: syncError } = await supabaseAdmin.rpc("sync_generation_worker_config", {
    _secret: secret,
    _base_url: baseUrl,
  });
  if (syncError) {
    console.error("[generation] Falha ao sincronizar o processador.", syncError);
  }
  await supabaseAdmin
    .from("generation_jobs")
    .update({ base_url: baseUrl, error: null })
    .eq("id", jobId);
  await supabaseAdmin.rpc("arm_generation_sweeper");

  // O processador continua trabalhando depois que desistimos de esperar.
  // Nunca cancelamos a chamada: cancelar derruba a unidade já iniciada.
  const call = fetch(`${baseUrl}/api/public/generation-worker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": secret,
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ jobId, workerSecret: secret }),
  }).then(
    async (response) => {
      console.info(`[generation] Chamada direta do worker: HTTP ${response.status}.`);
      if ([401, 403, 404].includes(response.status)) {
        await supabaseAdmin
          .from("generation_jobs")
          .update({ error: "worker não respondeu" })
          .eq("id", jobId)
          .in("status", ["fila", "rodando"]);
      }
      return "respondeu" as const;
    },
    async (error) => {
      console.error("[generation] Chamada direta do worker falhou.", error);
      await supabaseAdmin
        .from("generation_jobs")
        .update({ error: "worker não respondeu" })
        .eq("id", jobId)
        .in("status", ["fila", "rodando"]);
      return "falhou" as const;
    },
  );

  const waited = await Promise.race([
    call,
    new Promise<"seguindo">((resolve) => setTimeout(() => resolve("seguindo"), 4000)),
  ]);
  if (waited === "seguindo") {
    console.info("[generation] Chamada direta do worker segue em andamento no servidor.");
  }
}


interface PendingUnit {
  kind: UnitKind;
  pieceId?: string;
  options?: Record<string, unknown>;
  dedupeKey: string;
}


/** Cria (ou reaproveita) o job da coleção e enfileira as unidades pedidas. */
async function enqueue(input: {
  collectionId: string;
  userId: string;
  units: PendingUnit[];
  baseUrl: string;
}): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: open } = await supabaseAdmin
    .from("generation_jobs")
    .select("id")
    .eq("collection_id", input.collectionId)
    .in("status", ["fila", "rodando"])
    .eq("cancel_requested", false)
    .order("created_at", { ascending: false })
    .limit(1);

  let jobId = open?.[0]?.id ?? "";

  if (!jobId) {
    const { data, error } = await supabaseAdmin
      .from("generation_jobs")
      .insert({
        collection_id: input.collectionId,
        user_id: input.userId,
        base_url: input.baseUrl,
        status: "fila",
        step: input.units.some((u) => u.kind === "prancha") ? "prancha" : "pecas",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Não foi possível iniciar a geração.");
    jobId = data.id;
  }

  for (const unit of input.units) {
    // Idempotência: o índice único parcial impede duplicar a mesma unidade ativa.
    const { error } = await supabaseAdmin.from("generation_units").insert({
      job_id: jobId,
      collection_id: input.collectionId,
      piece_id: unit.pieceId ?? null,
      kind: unit.kind,
      options: (unit.options ?? {}) as never,
      dedupe_key: unit.dedupeKey,
      status: "fila",
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error("Não foi possível enfileirar a geração.");
    }
  }

  await kickWorker(jobId, input.baseUrl);
  return jobId;
}

/** Gera as estampas a partir da prancha que já existe. */
export const startGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid, recreateAll: z.boolean().optional() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { reconcileStuckPieces } = await import("@/lib/jobs/engine.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id, motif_sheet_path, pieces(id, position, status, image_path)")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");
    if (!collection.motif_sheet_path) {
      throw new Error("Gere os motivos da coleção antes de pedir as estampas.");
    }

    await reconcileStuckPieces(collection.id);

    const pieces = [
      ...((collection.pieces ?? []) as { id: string; position: number; image_path: string | null }[]),
    ].sort((a, b) => a.position - b.position);
    if (pieces.length === 0) throw new Error("Adicione pelo menos uma peça antes de gerar.");

    const units: PendingUnit[] = [];
    for (const piece of pieces) {
      // Peças que já têm arte só são refeitas quando a artesã pede.
      if (piece.image_path && data.recreateAll !== true) continue;
      units.push({
        kind: "peca",
        pieceId: piece.id,
        ...(data.recreateAll === true ? { options: { force: true } } : {}),
        dedupeKey: `peca:${piece.id}`,
      });
    }
    if (units.length === 0) throw new Error("Todas as estampas já estão prontas.");

    await supabase.from("collections").update({ status: "montagem" }).eq("id", collection.id);

    const jobId = await enqueue({
      collectionId: collection.id,
      userId,
      units,
      baseUrl: await currentBaseUrl(),
    });
    return { jobId };
  });


/** Gera outra prancha de motivos, substituindo a atual. */
export const regenerateSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { data: collection } = await context.supabase
      .from("collections")
      .select("id")
      .eq("id", data.collectionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!collection) throw new Error("Coleção não encontrada.");

    const jobId = await enqueue({
      collectionId: collection.id,
      userId: context.userId,
      units: [
        {
          kind: "prancha",
          options: { force: true },
          dedupeKey: `prancha:${collection.id}:force`,
        },
      ],
      baseUrl: await currentBaseUrl(),
    });
    return { jobId };
  });

/** Enfileira uma unidade avulsa: recriar peça, alta resolução ou conserto de emenda. */
export const enqueueUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pieceId: uuid,
      kind: z.enum(["peca", "emenda", "principal", "coordenado"]),
      hiFi: z.boolean().optional(),
      reinforce: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: piece, error } = await supabase
      .from("pieces")
      .select("id, collection_id, collections!inner(user_id)")
      .eq("id", data.pieceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!piece) throw new Error("Peça não encontrada.");
    const owner = (piece as unknown as { collections: { user_id: string } }).collections.user_id;
    if (owner !== userId) throw new Error("Peça não encontrada.");

    const options: Record<string, boolean> = {};
    if (data.hiFi) options["hiFi"] = true;
    if (data.reinforce) options["reinforce"] = true;

    const jobId = await enqueue({
      collectionId: String(piece.collection_id),
      userId,
      units: [
        {
          kind: data.kind,
          pieceId: piece.id,
          options,
          dedupeKey: `${data.kind}:${piece.id}${data.hiFi ? ":hifi" : ""}${data.reinforce ? ":ref" : ""}`,
        },
      ],
      baseUrl: await currentBaseUrl(),
    });
    return { jobId };
  });

/** Enfileira as versões em xadrez ou listras das peças da coleção. */
export const enqueueVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ collectionId: uuid, label: z.enum(["xadrez", "listras", "outra-cor"]) }).parse,
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: collection } = await supabase
      .from("collections")
      .select("id, pieces(id, role, image_path, applications(family))")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!collection) throw new Error("Coleção não encontrada.");

    const pieces = (collection.pieces ?? []) as unknown as {
      id: string;
      role: string;
      image_path: string | null;
      applications: { family: string } | null;
    }[];
    const alvos = pieces.filter(
      (p) =>
        p.image_path &&
        (p.role !== "principal" ||
          p.applications?.family === "painel" ||
          p.applications?.family === "barrado"),
    );

    if (alvos.length === 0) throw new Error("Nenhuma peça pronta para receber esta versão.");

    const jobId = await enqueue({
      collectionId: collection.id,
      userId,
      units: alvos.map((p) => ({
        kind: "variante" as const,
        pieceId: p.id,
        options: { label: data.label },
        dedupeKey: `variante:${p.id}:${data.label}`,
      })),
      baseUrl: await currentBaseUrl(),
    });
    return { jobId, total: alvos.length };
  });


// ------------------------------------------------------------------
// Fluxo prompt-first (v0.7)
// ------------------------------------------------------------------

/** Pinta (ou repinta) a peça principal a partir do prompt salvo na coleção. */
export const startPrincipal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { reconcileStuckPieces } = await import("@/lib/jobs/engine.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id, direction, pieces(id, role)")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");
    const direction = (collection.direction ?? {}) as { masterPrompt?: string };
    if (!String(direction.masterPrompt ?? "").trim()) {
      throw new Error("Escreva o prompt da peça principal antes de pintar.");
    }
    const principal = ((collection.pieces ?? []) as { id: string; role: string }[]).find(
      (p) => p.role === "principal",
    );
    if (!principal) throw new Error("Esta coleção não tem peça principal.");

    await reconcileStuckPieces(collection.id);
    await supabase.from("collections").update({ status: "montagem" }).eq("id", collection.id);

    const jobId = await enqueue({
      collectionId: collection.id,
      userId,
      units: [
        {
          kind: "principal",
          pieceId: principal.id,
          dedupeKey: `principal:${principal.id}`,
        },
      ],
      baseUrl: await currentBaseUrl(),
    });
    return { jobId, pieceId: principal.id };
  });

/** Pinta os coordenados usando a peça principal aprovada como referência. */
export const startCoordinates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid, recreateAll: z.boolean().optional() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { reconcileStuckPieces } = await import("@/lib/jobs/engine.server");

    const { data: collection, error } = await supabase
      .from("collections")
      .select("id, pieces(id, role, position, image_path)")
      .eq("id", data.collectionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!collection) throw new Error("Coleção não encontrada.");

    const pieces = [
      ...((collection.pieces ?? []) as {
        id: string;
        role: string;
        position: number;
        image_path: string | null;
      }[]),
    ].sort((a, b) => a.position - b.position);
    const principal = pieces.find((p) => p.role === "principal");
    if (!principal?.image_path) throw new Error("Aprove a peça principal antes dos coordenados.");

    await reconcileStuckPieces(collection.id);

    const units: PendingUnit[] = [];
    for (const piece of pieces) {
      if (piece.role === "principal") continue;
      if (piece.image_path && data.recreateAll !== true) continue;
      units.push({ kind: "coordenado", pieceId: piece.id, dedupeKey: `coordenado:${piece.id}` });
    }
    if (units.length === 0) throw new Error("Todas as peças já estão prontas.");

    await supabase.from("collections").update({ status: "montagem" }).eq("id", collection.id);

    const jobId = await enqueue({
      collectionId: collection.id,
      userId,
      units,
      baseUrl: await currentBaseUrl(),
    });
    return { jobId, total: units.length };
  });

/** Pede para parar depois das peças que já começaram. */
export const cancelJob = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await context.supabase.rpc("cancel_generation_job", {
      _job_id: data.jobId,
    });
    if (error) throw new Error("Não foi possível parar agora.");
    if (ok !== true) throw new Error("Esta geração não pode mais ser parada.");
    return { ok: true };
  });

/** Tenta acordar novamente um trabalho que ainda está na fila. */
export const retryGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("generation_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!job || !["fila", "rodando"].includes(job.status)) {
      throw new Error("Esta geração não pode mais ser reiniciada.");
    }

    const baseUrl = await currentBaseUrl();
    await kickWorker(job.id, baseUrl);
    return { ok: true };
  });

/** Situação atual da geração desta coleção. */
export const getJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid }).parse)
  .handler(async ({ data, context }): Promise<JobView | null> => {
    const { data: job } = await context.supabase
      .from("generation_jobs")
      .select("*")
      .eq("collection_id", data.collectionId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!job) return null;

    const { data: units } = await context.supabase
      .from("generation_units")
      .select("id, kind, piece_id, status, error")
      .eq("job_id", job.id)
      .order("created_at", { ascending: true });

    return {
      id: job.id,
      status: job.status,
      step: job.step,
      cancelRequested: job.cancel_requested,
      error: job.error,
      units: (units ?? []).map((u) => ({
        id: u.id,
        kind: u.kind as UnitKind,
        pieceId: u.piece_id,
        status: u.status as JobUnitView["status"],
        error: u.error,
      })),
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      heartbeatAt: job.heartbeat_at,
      createdAt: job.created_at,
    };
  });
