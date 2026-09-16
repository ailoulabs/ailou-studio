import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BriefForm } from "@/components/studio/BriefForm";
import { CollectionHeader } from "@/components/studio/CollectionHeader";
import { DirectionPanel } from "@/components/studio/DirectionPanel";
import {
  DirectionChooser,
  type ChosenDirection,
} from "@/components/studio/DirectionChooser";
import { DirectionDetails } from "@/components/studio/DirectionDetails";
import { PatternGrid } from "@/components/studio/PatternGrid";
import { PreviewDialog } from "@/components/studio/PreviewDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useStudio } from "@/hooks/use-studio";
import {
  chooseDirection,
  creativeDirector,
  exploreDirections,
  saveMotifs,
  setMotifExcluded,
  understandIdea,
  upscalePiece,
  type ExploreDirection,
  type ExploreQuestion,
} from "@/lib/api/ai.functions";
import {
  cancelJob,
  enqueueUnit,
  enqueueVariants,
  getJob,
  regenerateSheet,
  retryGenerationJob,
  startGeneration,
  type JobView,
  type JobUnitView,
} from "@/lib/api/jobs.functions";
import { MotifCard } from "@/components/studio/MotifCard";
import { extractMotifs, loadSheet, motifToBase64 } from "@/lib/assembly/motifs";
import {
  getCollection,
  saveCollection,
  signPieceUrls,
  updateCollectionPalette,
  updateDirection,
} from "@/lib/api/collections.functions";
import { downloadCollectionZip } from "@/lib/export/zip";

import {
  pieceName,
  type Brief,
  type CollectionStage,
  type Direction,
  type Piece,
  type PieceStatus,
} from "@/lib/collection";

/** Conferência da prancha, do jeito que fica gravada na coleção. */
type SheetReviewJson = {
  elements?: {
    name: string;
    status: "na-lista" | "fora-da-lista" | "excluido" | "fora-da-categoria";
    bbox: { x: number; y: number; w: number; h: number };
  }[];
} | null;

/** Acha na conferência o elemento que cai no lugar do motivo recortado. */
function matchReview(
  box: { x: number; y: number; w: number; h: number },
  review?: SheetReviewJson,
) {
  const elements = review?.elements ?? [];
  if (elements.length === 0) return null;
  const cx = (box.x + box.w / 2) * 100;
  const cy = (box.y + box.h / 2) * 100;
  let best: (typeof elements)[number] | null = null;
  let bestDist = Infinity;
  for (const el of elements) {
    const ex = el.bbox.x + el.bbox.w / 2;
    const ey = el.bbox.y + el.bbox.h / 2;
    const dist = Math.hypot(ex - cx, ey - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }
  return bestDist <= 20 ? best : null;
}

export const Route = createFileRoute("/_authenticated/studio")({
  validateSearch: (search: Record<string, unknown>): { colecao?: string } =>
    typeof search["colecao"] === "string" ? { colecao: search["colecao"] } : {},
  head: () => ({
    meta: [
      { title: "AiLou Studio: crie coleções de estampas" },
      {
        name: "description",
        content:
          "Do primeiro traço à coleção: estampas coordenadas para costura criativa, mesa posta e enxoval.",
      },
      { property: "og:title", content: "AiLou Studio: crie coleções de estampas" },
      {
        property: "og:description",
        content: "Uma ideia, várias peças coordenadas para a sua próxima coleção de tecidos.",
      },
    ],
  }),
  component: StudioPage,
});

const ACTIVE_JOB = new Set(["fila", "rodando"]);

function pendingJob(id: string, step: string): JobView {
  return {
    id,
    status: "fila",
    step,
    cancelRequested: false,
    error: null,
    units: [],
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    createdAt: new Date().toISOString(),
  };
}

/** Identifica a paleta e as orientações que deram origem à prancha. */
function flowSignature(palette: string[], shared: string, guidances: string[]): string {
  return JSON.stringify([palette, shared, guidances]);
}

function StudioPage() {
  const { state, dispatch } = useStudio();
  const { colecao } = Route.useSearch();
  const navigate = useNavigate();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<JobView | null>(null);
  // Etapa 1.5: perguntas geradas e três direções para escolher.
  const [exploreQuestions, setExploreQuestions] = useState<ExploreQuestion[]>([]);
  const [exploreDirs, setExploreDirs] = useState<ExploreDirection[]>([]);
  const [exploring, setExploring] = useState(false);
  const [chosenDir, setChosenDir] = useState<ChosenDirection | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /** O job terminou e o resultado ainda está sendo lido. */
  const [loadingResult, setLoadingResult] = useState(false);
  /** A leitura do resultado falhou mesmo depois das tentativas. */
  const [loadFailed, setLoadFailed] = useState(false);
  /** O recorte dos motivos da prancha falhou. */
  const [motifsFailed, setMotifsFailed] = useState(false);
  /** Assinatura da paleta e das orientações usadas na prancha atual. */
  const [sheetSig, setSheetSig] = useState<string | null>(null);
  const jobRef = useRef<string | null>(null);
  const sheetKey = useRef<string | null>(null);
  const settledJob = useRef<string | null>(null);
  const printed = useRef<Set<string>>(new Set());


  const save = useServerFn(saveCollection);
  const director = useServerFn(creativeDirector);
  const understand = useServerFn(understandIdea);
  const explore = useServerFn(exploreDirections);
  const pickDirection = useServerFn(chooseDirection);
  const persistDirection = useServerFn(updateDirection);
  const persistPalette = useServerFn(updateCollectionPalette);
  const fetchCollection = useServerFn(getCollection);
  const signUrls = useServerFn(signPieceUrls);
  const prepareForPrint = useServerFn(upscalePiece);
  const makeSheet = useServerFn(regenerateSheet);
  const persistMotifs = useServerFn(saveMotifs);
  const toggleMotif = useServerFn(setMotifExcluded);
  const beginGeneration = useServerFn(startGeneration);
  const queueUnit = useServerFn(enqueueUnit);
  const queueVariants = useServerFn(enqueueVariants);
  const stopJob = useServerFn(cancelJob);
  const retryJob = useServerFn(retryGenerationJob);
  const readJob = useServerFn(getJob);

  const generating = job !== null && ACTIVE_JOB.has(job.status);
  const stalled =
    job?.status === "fila" &&
    !job.heartbeatAt &&
    Date.now() - new Date(job.createdAt).getTime() > 90_000;
  const needsWorkerRetry = generating && (stalled || Boolean(job?.error));
  const currentSig = flowSignature(
    state.brief.palette,
    state.shared,
    state.direction?.guidances ?? [],
  );

  // Cronômetro da geração, para a artesã ver que o trabalho está andando.
  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  /** Lê a coleção do servidor e coloca tudo na tela. */
  const loadCollection = useCallback(
    async (id: string) => {
      const row = (await fetchCollection({ data: { id } })) as Record<string, unknown> | null;
      if (!row) return;

      const briefJson = (row["brief"] ?? {}) as Record<string, unknown>;
      const rows = ((row["pieces"] ?? []) as Record<string, unknown>[])
        .slice()
        .sort((a, b) => Number(a["position"]) - Number(b["position"]));

      const savedMotifs = ((row["motifs"] ?? []) as Record<string, unknown>[]).map((m) => ({
        index: Number(m["index"] ?? 0),
        type: String(m["type"] ?? "motivo"),
        relSize: Number(m["relSize"] ?? 0.1),
        path: String(m["path"] ?? ""),
        name: typeof m["name"] === "string" ? (m["name"] as string) : undefined,
        offTheme: m["offTheme"] === true,
        excluded: m["excluded"] === true,
      }));
      const sheetPath =
        typeof row["motif_sheet_filtered_path"] === "string"
          ? (row["motif_sheet_filtered_path"] as string)
          : typeof row["motif_sheet_path"] === "string"
            ? (row["motif_sheet_path"] as string)
            : null;

      const versionRows = ((row["piece_versions"] ?? []) as Record<string, unknown>[]).filter(
        (v) => typeof v["image_path"] === "string" && String(v["kind"]) !== "original",
      );

      const paths = [
        ...rows.flatMap((p) => [p["image_path"], p["image_print_path"]]),
        ...versionRows.map((v) => v["image_path"]),
        ...savedMotifs.map((m) => m.path),
        sheetPath,
      ].filter((p): p is string => typeof p === "string" && p.length > 0);
      const signed = paths.length > 0 ? (await signUrls({ data: { paths } })).urls : {};
      const sheetSigned = sheetPath ? (signed[sheetPath] ?? null) : null;
      const motifEntries = savedMotifs
        .filter((m) => signed[m.path])
        .map((m) => ({
          index: m.index,
          type: m.type,
          relSize: m.relSize,
          url: signed[m.path]!,
          ...(m.name ? { name: m.name } : {}),
          ...(m.offTheme ? { offTheme: true } : {}),
          ...(m.excluded ? { excluded: true } : {}),
        }));

      const pieces: Piece[] = rows.map((p) => {
        const path = typeof p["image_path"] === "string" ? (p["image_path"] as string) : null;
        const printPath =
          typeof p["image_print_path"] === "string" ? (p["image_print_path"] as string) : null;
        const url = path ? signed[path] : undefined;
        const printUrl = printPath ? signed[printPath] : undefined;
        return {
          id: String(p["id"]),
          applicationId: String(p["application_id"]),
          role: (p["role"] ?? "coordenado") as Piece["role"],
          overrides: (p["overrides"] ?? {
            motifScale: 1,
            density: 1,
            contrast: 1,
            background: "claro",
          }) as Piece["overrides"],
          status: (p["status"] ?? "pendente") as PieceStatus,
          ...(url ? { imageUrl: url } : {}),
          ...(printUrl ? { printUrl } : {}),
          ...(typeof p["print_dpi"] === "number" ? { dpi: p["print_dpi"] as number } : {}),
          ...(p["made_by"] ? { madeBy: p["made_by"] as "ia" | "app" } : {}),
          ...(p["composition"]
            ? { composition: p["composition"] as { ok: boolean; reason?: string } }
            : {}),
          ...(p["seam"] ? { seam: p["seam"] as { ok: boolean; score: number } } : {}),
          ...(p["timings"] ? { timings: p["timings"] as Record<string, unknown> } : {}),
          versions: versionRows
            .filter((v) => String(v["piece_id"]) === String(p["id"]))
            .map((v) => ({
              kind: String(v["kind"]),
              label: String(v["label"] ?? v["kind"]),
              url: signed[String(v["image_path"])] ?? "",
              seam: (v["seam"] ?? null) as { ok: boolean; score: number } | null,
            }))
            .filter((v) => v.url.length > 0),
        } as Piece;
      });

      const directionJson = row["direction"] as
        | {
            summaryBullets?: string[];
            shared?: string;
            pieces?: { guidance: string }[];
            suggestedColors?: string[];
            paletteReason?: string;
            motifs?: { name: string; en: string }[];
            avoid?: string[];
            sheetReview?: SheetReviewJson;
            chosenDirection?: { name: string; pitch: string; mood: string };
            secondaryLanguage?: { name: string; en: string; note: string };
            look?: { technique?: string; ground?: string };
            styleLevels?: {
              size?: number;
              density?: number;
              contrast?: number;
              sizeReason?: string;
              densityReason?: string;
              contrastReason?: string;
            };
          }
        | null;

      const brief: Brief = {
        name: String(row["name"] ?? "Coleção sem nome"),
        idea: String(briefJson["idea"] ?? ""),
        referenceImage:
          typeof briefJson["reference"] === "string" ? (briefJson["reference"] as string) : null,
        style: (briefJson["style"] ?? "aquarela-delicada") as Brief["style"],
        usage: (briefJson["usage"] ?? "mesa-posta") as Brief["usage"],
        palette: ((row["palette"] as string[]) ?? []).slice(0, 5),
        requiredColors: Array.isArray(briefJson["requiredColors"])
          ? (briefJson["requiredColors"] as string[])
          : [],
        preferredColors: Array.isArray(briefJson["preferredColors"])
          ? (briefJson["preferredColors"] as string[])
          : [],
      };

      const status = String(row["status"] ?? "rascunho");
      const stage: CollectionStage =
        status === "pronta"
          ? "pronta"
          : status === "rascunho"
            ? "rascunho"
            : status === "montagem" || status === "gerando"
              ? "montagem"
              : "proposta";

      // Reabriu a coleção: traz de volta a direção já escolhida, se houver.
      setChosenDir(
        directionJson?.chosenDirection && directionJson?.secondaryLanguage
          ? {
              name: directionJson.chosenDirection.name,
              pitch: directionJson.chosenDirection.pitch ?? "",
              mood: directionJson.chosenDirection.mood ?? "",
              technique: directionJson.look?.technique ?? "",
              ground: directionJson.look?.ground ?? "",
              secondaryLanguage: directionJson.secondaryLanguage,
            }
          : null,
      );
      setExploreQuestions([]);
      setExploreDirs([]);

      dispatch({
        type: "loadState",
        value: {
          collectionId: String(row["id"]),
          brief,
          pieces,
          direction: directionJson
            ? {
                highlights: directionJson.summaryBullets ?? [],
                size: directionJson.styleLevels?.size ?? 0,
                density: directionJson.styleLevels?.density ?? 0,
                contrast: directionJson.styleLevels?.contrast ?? 0,
                sizeReason: directionJson.styleLevels?.sizeReason ?? "",
                densityReason: directionJson.styleLevels?.densityReason ?? "",
                contrastReason: directionJson.styleLevels?.contrastReason ?? "",
                suggestedPalette: (directionJson.suggestedColors ?? []).slice(0, 5),
                paletteReason: directionJson.paletteReason ?? "",
                guidances: (directionJson.pieces ?? []).map((g) => g.guidance),
                motifs: directionJson.motifs ?? [],
                avoid: directionJson.avoid ?? [],
              }
            : null,
          shared: directionJson?.shared ?? "",
          stage,
          sheetUrl: sheetSigned,
          motifs: motifEntries,
        },
      });

      // Prancha nova: passa a valer a paleta e as orientações gravadas com ela.
      if (sheetPath && sheetKey.current !== sheetPath) {
        sheetKey.current = sheetPath;
        setSheetSig(
          flowSignature(
            brief.palette,
            directionJson?.shared ?? "",
            (directionJson?.pieces ?? []).map((g) => g.guidance),
          ),
        );
      }
      if (!sheetPath) {
        sheetKey.current = null;
        setSheetSig(null);
      }

      const review = (directionJson?.sheetReview ?? null) as SheetReviewJson;
      return { sheetUrl: sheetSigned, motifCount: motifEntries.length, review };
    },
    [dispatch, fetchCollection, signUrls],
  );


  /**
   * Recorta os motivos da prancha só para mostrar na tela.
   * Nunca pede outra prancha.
   */
  const showMotifs = useCallback(
    async (collectionId: string, sheetUrl: string, review?: SheetReviewJson) => {
      setMotifsFailed(false);
      try {

        const canvas = await loadSheet(sheetUrl);
        const extracted = extractMotifs(canvas);
        if (extracted.length === 0) return;
        const saved = await persistMotifs({
          data: {
            collectionId,
            motifs: extracted.map((m) => {
              const seen = matchReview(m.bboxRel, review);
              return {
                index: m.index,
                base64: motifToBase64(m.canvas),
                type: m.type,
                relSize: m.relSize,
                bbox: m.bbox,
                bboxRel: m.bboxRel,
                ...(seen?.name ? { name: seen.name } : {}),
                ...(seen?.status === "excluido" || seen?.status === "fora-da-categoria"
                  ? { offTheme: true, excluded: true }
                  : {}),
              };
            }),
          },
        });
        dispatch({
          type: "setMotifs",
          motifs: saved.motifs
            .filter((m) => saved.urls[m.path])
            .map((m) => ({
              index: m.index,
              type: m.type,
              relSize: m.relSize,
              url: saved.urls[m.path]!,
              ...(m.name ? { name: m.name } : {}),
              ...(m.offTheme ? { offTheme: true } : {}),
              ...(m.excluded ? { excluded: true } : {}),
            })),
        });
      } catch {
        // A artesã precisa saber: o recorte falhou e pode ser repetido sem gerar nada.
        setMotifsFailed(true);
      }
    },
    [dispatch, persistMotifs],
  );

  /** Repete só o recorte dos motivos da prancha que já existe. */
  const retryMotifs = useCallback(async () => {
    if (!colecao && !state.collectionId) return;
    const id = state.collectionId ?? colecao!;
    try {
      const out = await loadCollection(id);
      if (out?.sheetUrl) await showMotifs(id, out.sheetUrl, out.review);
    } catch {
      setMotifsFailed(true);
    }
  }, [colecao, state.collectionId, loadCollection, showMotifs]);


  // Abre a coleção pedida na barra de endereço.
  useEffect(() => {
    if (!colecao) return;
    let active = true;
    void (async () => {
      try {
        const out = await loadCollection(colecao);
        if (!active) return;
        const current = await readJob({ data: { collectionId: colecao } });
        if (current) {
          setJob(current);
          if (ACTIVE_JOB.has(current.status)) jobRef.current = current.id;
        }
        if (out?.sheetUrl && out.motifCount === 0)
          void showMotifs(colecao, out.sheetUrl, out.review);
      } catch {
        toast.error("Não foi possível abrir esta coleção.");
      }
    })();
    return () => {
      active = false;
    };
  }, [colecao, loadCollection, readJob, showMotifs]);

  // Acompanha a geração que roda no servidor, a cada 3 segundos.
  // As dependências são estáveis, então a batida não se reinicia a cada leitura.
  const jobId = job?.id ?? null;
  const jobActive = job !== null && ACTIVE_JOB.has(job.status);
  const collectionId = state.collectionId;

  /**
   * Lê o resultado depois que o job termina.
   * Tenta cinco vezes com intervalo crescente antes de admitir a falha.
   */
  const settleResult = useCallback(
    async (finished: JobView, id: string) => {
      setLoadingResult(true);
      setLoadFailed(false);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const out = await loadCollection(id);
          if (out?.sheetUrl && out.motifCount === 0) void showMotifs(id, out.sheetUrl, out.review);
          settledJob.current = finished.id;
          setLoadingResult(false);
          const failed = finished.units.filter((u) => u.status === "erro").length;
          if (finished.status === "erro") {
            toast.error(finished.error ?? "A geração não terminou.");
          } else if (finished.status === "cancelado") {
            toast.message("Geração interrompida. As estampas prontas continuam salvas.");
          } else if (failed > 0) {
            toast.error(
              `${failed} ${failed === 1 ? "estampa precisa" : "estampas precisam"} de nova tentativa.`,
            );
          } else {
            toast.success("Coleção pronta.");
          }
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      setLoadingResult(false);
      setLoadFailed(true);
    },
    [loadCollection, showMotifs],
  );

  /** Uma leitura do job e da coleção, usada pela batida e pelos retornos de foco. */
  const refreshNow = useCallback(async () => {
    if (!collectionId) return;
    const current = await readJob({ data: { collectionId } });
    if (!current) return;
    setJob(current);
    if (ACTIVE_JOB.has(current.status)) {
      await loadCollection(collectionId);
      return;
    }
    if (settledJob.current !== current.id) await settleResult(current, collectionId);
  }, [collectionId, readJob, loadCollection, settleResult]);

  useEffect(() => {
    if (!jobId || !jobActive || !collectionId) return;

    let active = true;
    let running = false;
    const tick = async () => {
      if (running || !active) return;
      running = true;
      try {
        await refreshNow();
      } catch {
        // Sem rede agora: a próxima batida tenta de novo.
      } finally {
        running = false;
      }
    };

    const timer = setInterval(() => void tick(), 3000);
    void tick();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [jobId, jobActive, collectionId, refreshNow]);

  // Voltou o foco da aba ou a conexão: lê job e coleção na hora.
  useEffect(() => {
    if (!collectionId) return;
    const onWake = () => {
      if (document.visibilityState === "hidden") return;
      void refreshNow().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [collectionId, refreshNow]);


  async function persist(status: string) {
    const result = await save({
      data: {
        ...(state.collectionId ? { id: state.collectionId } : {}),
        name: state.brief.name.trim() || "Coleção sem nome",
        status,
        brief: {
          idea: state.brief.idea,
          style: state.brief.style,
          usage: state.brief.usage,
          reference: state.brief.referenceImage,
          requiredColors: state.brief.requiredColors ?? [],
          preferredColors: state.brief.preferredColors ?? [],
        },
        palette: state.brief.palette,
        pieces: state.pieces.map((p, i) => ({
          ...(p.id.includes("-") && p.id.length === 36 ? { id: p.id } : {}),
          applicationId: p.applicationId,
          role: p.role,
          position: i,
          overrides: p.overrides as unknown as Record<string, unknown>,
        })),
      },
    });
    dispatch({ type: "setCollectionId", value: result.collectionId ?? null });
    dispatch({ type: "syncPieceIds", idByPosition: result.pieceIdByPosition });
    return result;
  }

  /** Tira ou devolve um motivo, sem pedir imagem nova. */
  async function handleToggleMotif(index: number, excluded: boolean) {
    if (!state.collectionId) return;
    dispatch({ type: "excludeMotif", index, excluded });
    try {
      const out = await toggleMotif({
        data: { collectionId: state.collectionId, index, excluded },
      });
      if (out?.sheetUrl) dispatch({ type: "setSheet", url: out.sheetUrl });
    } catch (err) {
      dispatch({ type: "excludeMotif", index, excluded: !excluded });
      toast.error(err instanceof Error ? err.message : "Não consegui mudar este motivo.");
    }
  }

  /** Etapa 1: só o entendimento do pedido, em texto. */
  async function handleElaborate() {
    if (state.pieces.length === 0) {
      toast.error("Adicione ao menos uma peça à coleção.");
      return;
    }
    setBusy(true);
    try {
      const saved = await persist("proposta");
      const result = await understand({ data: { collectionId: saved.collectionId! } });
      const direction: Direction = {
        highlights: result.summaryBullets,
        size: state.direction?.size ?? 0,
        density: state.direction?.density ?? 0,
        contrast: state.direction?.contrast ?? 0,
        sizeReason: "",
        densityReason: "",
        contrastReason: "",
        suggestedPalette: [],
        paletteReason: "",
        guidances: state.pieces.map(() => ""),
        motifs: result.motifs,
        avoid: result.avoid,
      };
      dispatch({ type: "setDirection", direction, shared: result.shared });
      toast.success("Veja o que entendi da sua ideia.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível elaborar a proposta.");
    } finally {
      setBusy(false);
    }
  }

  /** Comeca uma colecao do zero, sem arrastar nada da anterior. */
  function handleNewCollection() {
    dispatch({ type: "reset" });
    setJob(null);
    setChosenDir(null);
    setExploreQuestions([]);
    setExploreDirs([]);
    setMotifsFailed(false);
    jobRef.current = null;
    void navigate({ to: "/studio", search: {} });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Etapa 1.5: até duas perguntas sobre o que ficou em aberto e três direções. */
  async function handleExplore(answers?: { question: string; answer: string }[]) {
    if (!state.collectionId) {
      toast.error("Elabore a ideia antes de explorar direções.");
      return;
    }
    setExploring(true);
    setChosenDir(null);
    try {
      const out = await explore({
        data: { collectionId: state.collectionId, ...(answers ? { answers } : {}) },
      });
      setExploreQuestions(out.questions ?? []);
      setExploreDirs(out.directions ?? []);
      if ((out.directions ?? []).length === 0) {
        toast.error("Não consegui propor direções agora. Tente de novo.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível explorar direções.");
    } finally {
      setExploring(false);
    }
  }

  /** Guarda a direção escolhida para a etapa 2 seguir. */
  async function handleChooseDirection(chosen: ExploreDirection) {
    if (!state.collectionId) return;
    setBusy(true);
    try {
      await pickDirection({
        data: {
          collectionId: state.collectionId,
          name: chosen.name,
          pitch: chosen.pitch,
          mood: chosen.mood,
          technique: chosen.technique,
          ground: chosen.ground,
          secondaryLanguage: chosen.secondaryLanguage,
        },
      });
      setChosenDir(chosen);
      setExploreQuestions([]);
      setExploreDirs([]);
      toast.success(`Direção escolhida: ${chosen.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui guardar a direção.");
    } finally {
      setBusy(false);
    }
  }

  /** Etapa 2, primeira parte: paleta, ajustes e orientações de cada peça. */
  async function runDirector(collectionId: string) {
    const result = await director({ data: { collectionId } });
    const direction: Direction = {
      highlights: state.direction?.highlights ?? result.summaryBullets,
      size: result.styleLevels?.size ?? 0,
      density: result.styleLevels?.density ?? 0,
      contrast: result.styleLevels?.contrast ?? 0,
      sizeReason: result.styleLevels?.sizeReason ?? "",
      densityReason: result.styleLevels?.densityReason ?? "",
      contrastReason: result.styleLevels?.contrastReason ?? "",
      suggestedPalette: result.suggestedColors.slice(0, 5),
      paletteReason: result.paletteReason ?? "",
      guidances: state.pieces.map((_, i) => result.pieces[i]?.guidance ?? ""),
      motifs: result.motifs ?? state.direction?.motifs ?? [],
      avoid: result.avoid ?? state.direction?.avoid ?? [],
    };
    dispatch({ type: "setDirection", direction, shared: state.shared || result.shared });
    dispatch({ type: "setPalette", value: result.suggestedColors.slice(0, 5) });
    return direction;
  }

  /** Pede ao diretor criativo outra paleta, sem gerar imagens. */
  async function handleProposePalette() {
    if (!state.collectionId || !state.direction) return;
    setBusy(true);
    try {
      const result = await director({
        data: { collectionId: state.collectionId, paletteOnly: true },
      });
      const colors = result.suggestedColors.slice(0, 5);
      dispatch({
        type: "setDirection",
        direction: {
          ...state.direction,
          suggestedPalette: colors,
          paletteReason: result.paletteReason ?? "",
        },
        shared: state.shared,
      });
      dispatch({ type: "setPalette", value: colors });
      toast.success("Nova paleta proposta.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível propor outra paleta.");
    } finally {
      setBusy(false);
    }
  }

  /** Grava na hora a paleta editada pela artesã. */
  async function handlePaletteEdited() {
    if (!state.collectionId || state.brief.palette.length === 0) return;
    try {
      await persistPalette({
        data: { collectionId: state.collectionId, palette: state.brief.palette },
      });
    } catch {
      toast.error("Não foi possível salvar a cor. Tente de novo.");
    }
  }

  /** Prepara a peça para impressão em segundo plano, sem travar a fila. */
  async function preparePrint(pieceId: string) {
    dispatch({ type: "setPieceResult", id: pieceId, preparing: true });
    try {
      const out = await prepareForPrint({ data: { pieceId } });
      dispatch({
        type: "setPieceResult",
        id: pieceId,
        preparing: false,
        ...(out.dpi ? { dpi: out.dpi } : {}),
        ...("printUrl" in out && out.printUrl ? { printUrl: out.printUrl } : {}),
      });
    } catch {
      dispatch({ type: "setPieceResult", id: pieceId, preparing: false });
    }
  }

  /** Grava a coleção e as orientações antes de qualquer geração. */
  async function persistAll(status: string) {
    const saved = await persist(status);
    if (state.direction) {
      await persistDirection({
        data: {
          collectionId: saved.collectionId!,
          direction: {
            summaryBullets: state.direction.highlights,
            shared: state.shared,
            pieces: state.pieces.map((p, i) => ({
              pieceId: saved.pieceIdByPosition[i] ?? p.id,
              guidance: state.direction?.guidances[i] ?? "",
            })),
            suggestedColors: state.direction.suggestedPalette,
            paletteReason: state.direction.paletteReason,
            motifs: state.direction.motifs ?? [],
            avoid: state.direction.avoid ?? [],
            styleLevels: {
              size: state.direction.size,
              density: state.direction.density,
              contrast: state.direction.contrast,
              sizeReason: state.direction.sizeReason ?? "",
              densityReason: state.direction.densityReason ?? "",
              contrastReason: state.direction.contrastReason ?? "",
            },
          },
        },
      });
    }
    return saved;
  }

  /** Passo 3: pinta as estampas a partir da prancha que já existe. */
  async function handleGenerate(recreateAll = false) {
    setBusy(true);
    try {
      const saved = await persistAll("montagem");
      dispatch({ type: "generate" });

      const started = await beginGeneration({
        data: { collectionId: saved.collectionId!, ...(recreateAll ? { recreateAll } : {}) },
      });
      jobRef.current = started.jobId;
      setJob(pendingJob(started.jobId, "pecas"));
      toast.message("A geração começou. Você pode fechar o app que ela continua.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar a coleção.");
    } finally {
      setBusy(false);
    }
  }

  /** Passo 2: pinta só a prancha de motivos, sem tocar nas estampas. */
  async function handleNewSheet() {
    setBusy(true);
    try {
      const saved = await persistAll("proposta");
      // Na primeira vez, as cores e as orientações são propostas junto com os motivos.
      const fresh =
        state.brief.palette.length === 0 ? await runDirector(saved.collectionId!) : null;
      const started = await makeSheet({ data: { collectionId: saved.collectionId! } });
      jobRef.current = started.jobId;
      setJob(pendingJob(started.jobId, "prancha"));
      setSheetSig(
        fresh
          ? flowSignature(fresh.suggestedPalette, state.shared, fresh.guidances)
          : currentSig,
      );
      toast.message("Escolhendo as cores e pintando os motivos da coleção.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar os motivos.");
    } finally {
      setBusy(false);
    }

  }

  async function handleRecreate(piece: Piece, options: { hiFi?: boolean } = {}) {
    try {
      dispatch({ type: "setPieceResult", id: piece.id, status: "gerando", stage: "Pintando…" });
      const started = await queueUnit({
        data: { pieceId: piece.id, kind: "peca", ...(options.hiFi ? { hiFi: true } : {}) },
      });
      jobRef.current = started.jobId;
      setJob(pendingJob(started.jobId, "pecas"));
    } catch (err) {
      dispatch({ type: "setPieceResult", id: piece.id, status: "erro", stage: null });
      toast.error(err instanceof Error ? err.message : "Falha ao recriar a estampa.");
    }
  }

  /** Conserta a emenda com uma edição de imagem. */
  async function handleFixSeam(piece: Piece) {
    if (!piece.imageUrl) return;
    try {
      dispatch({
        type: "setPieceResult",
        id: piece.id,
        status: "gerando",
        stage: "Corrigindo a emenda…",
      });
      const started = await queueUnit({ data: { pieceId: piece.id, kind: "emenda" } });
      jobRef.current = started.jobId;
      setJob(pendingJob(started.jobId, "pecas"));
    } catch (err) {
      dispatch({ type: "setPieceResult", id: piece.id, status: "pronta", stage: null });
      toast.error(err instanceof Error ? err.message : "Não foi possível corrigir a emenda.");
    }
  }

  async function handleStop() {
    if (!job) return;
    try {
      await stopJob({ data: { jobId: job.id } });
      toast.message("Vamos parar depois das peças que já começaram.");
    } catch {
      toast.error("Não foi possível parar agora. Tente de novo.");
    }
  }

  /** Lê o resultado de novo, sem gerar nada. */
  async function handleReloadResult() {
    if (!collectionId || !job) return;
    await settleResult(job, collectionId);
  }

  async function handleRetryWorker() {

    if (!job) return;
    setBusy(true);
    try {
      await retryJob({ data: { jobId: job.id } });
      const current = collectionId
        ? await readJob({ data: { collectionId } })
        : null;
      if (current) setJob(current);
      toast.message("Tentando iniciar a geração novamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível tentar de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVariants(label: "xadrez" | "listras" | "outra-cor") {
    const nome = label === "outra-cor" ? "outra cor" : label;
    try {
      const res = await queueVariants({ data: { collectionId: collectionId ?? "", label } });
      toast.success(
        `Pedimos ${res.total} ${res.total === 1 ? "versão" : "versões"} em ${nome}. Já começou.`,
      );

      const current = await readJob({ data: { collectionId: collectionId ?? "" } });
      if (current) setJob(current);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível pedir estas versões.");
    }
  }



  // Peças prontas ainda sem dpi: prepara para impressão em segundo plano.
  useEffect(() => {
    if (generating) return;
    for (const piece of state.pieces) {
      if (piece.status === "pronta" && piece.imageUrl && !piece.dpi && !printed.current.has(piece.id)) {
        printed.current.add(piece.id);
        void preparePrint(piece.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, state.pieces]);

  const units: JobUnitView[] = job?.units ?? [];
  const pieceUnits = units.filter((u) => u.kind !== "prancha");
  const doneUnits = pieceUnits.filter((u) => u.status === "ok" || u.status === "erro").length;
  const runningUnits = pieceUnits.filter((u) => u.status === "rodando").length;
  const sheetPending = units.some((u) => u.kind === "prancha" && u.status !== "ok");
  const started = Boolean(job?.startedAt);
  const sheetPainting =
    generating && started && (units.length === 0 ? job?.step === "prancha" : sheetPending);
  const motifsStale = Boolean(state.sheetUrl) && sheetSig !== null && sheetSig !== currentSig;
  const canGenerate = Boolean(state.sheetUrl) && !motifsStale && !sheetPainting;
  const progressValue =
    pieceUnits.length === 0
      ? 8
      : sheetPending
        ? 15
        : 20 + (doneUnits / pieceUnits.length) * 80;

  /** Unidade que estourou as tentativas e foi encerrada pelo servidor. */
  const interrupted = units.some(
    (u) => u.status === "erro" && (u.error ?? "").includes("interrompida no servidor"),
  );
  const waitingStart = generating && !started && !needsWorkerRetry;
  const phaseLabel = needsWorkerRetry
    ? "A geração não começou"
    : waitingStart
      ? "Aguardando início"
      : sheetPainting || pieceUnits.length === 0
        ? "Pintando os motivos"
        : `Gerando ${Math.min(doneUnits + 1, pieceUnits.length)} de ${pieceUnits.length} estampas`;


  const progressBlock = generating ? (
    <div className="space-y-3 text-sm">
      {needsWorkerRetry ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium text-foreground">
            {job.error || "A geração não começou. Tentar de novo."}
          </p>
          <Button size="sm" onClick={() => void handleRetryWorker()} disabled={busy}>
            Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="text-primary" />
              {phaseLabel}
              {runningUnits > 0 && !waitingStart ? ` (${runningUnits} ao mesmo tempo)` : ""}
            </span>
            <Button variant="outline" size="sm" onClick={() => void handleStop()}>
              Parar após estas
            </Button>
          </div>
          <Progress value={progressValue} />
          <p className="text-xs text-muted-foreground">
            {pieceUnits.length > 0
              ? `${doneUnits} de ${pieceUnits.length} peças prontas, ${elapsed}s`
              : `${elapsed}s`}
          </p>
          <p className="text-xs text-muted-foreground">
            A geração roda no servidor. Você pode fechar o app e voltar depois.
          </p>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">Do primeiro traço à coleção</p>
          <h1 className="mt-3">Estampas que combinam.</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Uma ideia, várias peças para criar juntos.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={handleNewCollection}
          disabled={busy || generating}
        >
          <Plus className="size-4" strokeWidth={1.5} />
          Nova coleção
        </Button>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <BriefForm
          state={state}
          dispatch={dispatch}
          onElaborate={() => void handleElaborate()}
          busy={busy}
        />

        <div className="space-y-8">
          {state.direction && (
            <DirectionPanel direction={state.direction} shared={state.shared} />
          )}

          {state.direction && (
            <DirectionChooser
              questions={exploreQuestions}
              directions={exploreDirs}
              chosen={chosenDir}
              loading={exploring}
              busy={busy || generating}
              onExplore={() => void handleExplore()}
              onAnswer={(a) => void handleExplore(a)}
              onChoose={(d) => void handleChooseDirection(d)}
            />
          )}

          {(state.direction || state.sheetUrl) && (
            <MotifCard
              sheetUrl={state.sheetUrl}
              motifs={state.motifs}
              painting={sheetPainting}
              elapsed={elapsed}
              stale={motifsStale}
              hasArt={state.pieces.some((p) => p.imageUrl)}
              busy={busy || generating}
              startCollapsed={state.stage === "pronta"}
              onGenerate={() => void handleNewSheet()}
              onRegenerate={() => void handleNewSheet()}
              onRecreatePieces={() => void handleGenerate(true)}
              onToggleMotif={(index, excluded) => void handleToggleMotif(index, excluded)}
              motifsFailed={motifsFailed}
              onRetryMotifs={() => void retryMotifs()}
              progress={progressBlock}
            >
              {state.direction && (
                <DirectionDetails
                  direction={state.direction}
                  pieceNames={state.pieces.map((p) => pieceName(p))}
                  paletteInUse={state.brief.palette}
                  dispatch={dispatch}
                  onProposePalette={() => void handleProposePalette()}
                  onPaletteEdited={() => void handlePaletteEdited()}
                  busy={busy}
                />
              )}
            </MotifCard>
          )}

          {state.direction && !generating && (
            <div>
              <Button
                size="lg"
                onClick={() => void handleGenerate()}
                disabled={busy || !canGenerate}
              >
                {`3. Aprovar e gerar ${state.pieces.length} ${state.pieces.length === 1 ? "estampa" : "estampas"}`}
              </Button>
              {!canGenerate && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Gere os motivos da coleção acima para liberar este passo.
                </p>
              )}
            </div>
          )}




          <section className="space-y-6">
            <CollectionHeader
              name={state.brief.name.trim() || "Coleção sem nome"}
              stage={state.stage}
              style={state.brief.style}
              palette={state.brief.palette}
              pieceCount={state.pieces.length}
              onDownload={() =>
                void downloadCollectionZip({
                  name: state.brief.name.trim() || "Coleção sem nome",
                  brief: state.brief,
                  direction: state.direction,
                  pieces: state.pieces,
                  sheetUrl: state.sheetUrl,
                }).catch(() => toast.error("Não foi possível montar o arquivo da coleção."))
              }
            />
            {!generating && loadingResult && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <Spinner className="text-primary" />
                Carregando resultado…
              </div>
            )}
            {!generating && loadFailed && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <p className="font-medium text-foreground">Não foi possível carregar o resultado</p>
                <Button size="sm" variant="outline" onClick={() => void handleReloadResult()}>
                  Tentar de novo
                </Button>
              </div>
            )}
            {!generating && interrupted && (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
                Interrompida no servidor. Peça a estampa de novo quando quiser.
              </div>
            )}
            {!generating && !interrupted && job?.error && (
              <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
                {job.error}
              </div>
            )}

            {!generating && state.pieces.some((p) => p.status === "pronta") && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Quer as mesmas peças em outro acabamento?
                </p>
                <Button variant="outline" size="sm" onClick={() => void handleVariants("xadrez")}>
                  Versão em xadrez
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleVariants("listras")}>
                  Versão em listras
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleVariants("outra-cor")}
                >
                  Outra cor
                </Button>

              </div>
            )}
            <PatternGrid

              pieces={state.pieces}
              palette={state.brief.palette}
              onOpen={(piece) => setPreviewId(piece.id)}
              onRecreate={(piece) => void handleRecreate(piece)}
              onHiFi={(piece) => void handleRecreate(piece, { hiFi: true })}
              onFixSeam={(piece) => void handleFixSeam(piece)}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              As imagens são propostas criativas. Antes de produzir o tecido, revise escala e cores
              com a estamparia.
            </p>
          </section>
        </div>
      </div>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
        <span className="font-serif text-base">AiLou Studio</span>
        <span className="eyebrow">Um produto AiLou</span>
      </footer>

      <PreviewDialog
        piece={state.pieces.find((p) => p.id === previewId) ?? null}
        palette={state.brief.palette}
        onOpenChange={(open) => !open && setPreviewId(null)}
        onRecreate={(piece) => {
          setPreviewId(null);
          void handleRecreate(piece);
        }}
        onFixSeam={(piece) => void handleFixSeam(piece)}
        onNavigate={(direction) => {
          const list = state.pieces;
          const current = list.findIndex((p) => p.id === previewId);
          if (current < 0 || list.length === 0) return;
          const next = (current + direction + list.length) % list.length;
          setPreviewId(list[next]?.id ?? null);
        }}
      />
    </div>
  );
}

