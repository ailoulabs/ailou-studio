import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { StepTheme } from "@/components/studio/flow/StepTheme";
import { StepClimate } from "@/components/studio/flow/StepClimate";
import { StepUsage } from "@/components/studio/flow/StepUsage";
import { StepPrincipal } from "@/components/studio/flow/StepPrincipal";
import { StepCollection } from "@/components/studio/flow/StepCollection";
import { getApplication } from "@/lib/catalog";
import { coordinateAppsFor, findTheme, principalAppFor, USAGES } from "@/lib/studio-flow";
import { getCollection, saveCollection, signPieceUrls } from "@/lib/api/collections.functions";
import {
  cancelJob,
  enqueueUnit,
  getJob,
  startCoordinates,
  startPrincipal,
  type JobView,
} from "@/lib/api/jobs.functions";
import {
  choosePrincipalVersion,
  rewriteMasterPrompt,
  saveMasterPrompt,
  setAdjustments,
  writeMasterPrompt,
} from "@/lib/api/studio.functions";
import { downloadFlowZip } from "@/lib/export/zip";
import type { FlowPiece, FlowVersion } from "@/lib/flow-types";

const searchSchema = z.object({ colecao: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/studio")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Studio | AiLou" },
      { name: "description", content: "Crie coleções de estampas coordenadas em cinco passos." },
    ],
  }),
  component: StudioPage,
});

const ACTIVE_JOB = new Set(["fila", "rodando"]);
const STEP_TITLES = ["Tema", "Clima", "Uso", "Peça principal", "Coleção"];

interface FlowState {
  theme: string | null;
  words: string;
  climate: string | null;
  usage: string;
  apps: string[];
}

const defaultUsage = USAGES[0]!;

const initialFlow: FlowState = {
  theme: null,
  words: "",
  climate: null,
  usage: defaultUsage.usage,
  apps: coordinateAppsFor(defaultUsage.applicationIds),
};

function StudioPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const save = useServerFn(saveCollection);
  const fetchCollection = useServerFn(getCollection);
  const signUrls = useServerFn(signPieceUrls);
  const writePrompt = useServerFn(writeMasterPrompt);
  const rewritePrompt = useServerFn(rewriteMasterPrompt);
  const persistPrompt = useServerFn(saveMasterPrompt);
  const persistAdjustments = useServerFn(setAdjustments);
  const pickVersion = useServerFn(choosePrincipalVersion);
  const paintPrincipal = useServerFn(startPrincipal);
  const paintCoordinates = useServerFn(startCoordinates);
  const queueUnit = useServerFn(enqueueUnit);
  const readJob = useServerFn(getJob);
  const stopJob = useServerFn(cancelJob);

  const [step, setStep] = useState(1);
  const [flow, setFlow] = useState<FlowState>(initialFlow);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pieces, setPieces] = useState<FlowPiece[]>([]);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [summary, setSummary] = useState("");
  const [palette, setPalette] = useState<string[]>([]);
  const [adjustments, setAdjustmentsState] = useState<string[]>([]);
  const [job, setJob] = useState<JobView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  const jobActive = job !== null && ACTIVE_JOB.has(job.status);
  const principal = useMemo(() => pieces.find((p) => p.role === "principal") ?? null, [pieces]);
  const coordinates = useMemo(() => pieces.filter((p) => p.role !== "principal"), [pieces]);

  /** Lê a coleção do servidor e coloca tudo na tela. */
  const loadCollection = useCallback(
    async (
      id: string,
    ): Promise<{ hasPrompt: boolean; principalReady: boolean; coordinatesStarted: boolean }> => {
      const row = (await fetchCollection({ data: { id } })) as Record<string, unknown> | null;
      if (!row) throw new Error("Coleção não encontrada.");

      const brief = (row["brief"] ?? {}) as Record<string, unknown>;
      const direction = (row["direction"] ?? {}) as Record<string, unknown>;
      const rows = ((row["pieces"] ?? []) as Record<string, unknown>[])
        .slice()
        .sort((a, b) => Number(a["position"]) - Number(b["position"]));
      const versionRows = ((row["piece_versions"] ?? []) as Record<string, unknown>[]).filter(
        (v) => typeof v["image_path"] === "string",
      );

      const paths = [
        ...rows.map((p) => p["image_path"]),
        ...versionRows.map((v) => v["image_path"]),
      ].filter((p): p is string => typeof p === "string" && p.length > 0);
      const signed = paths.length > 0 ? (await signUrls({ data: { paths } })).urls : {};

      const list: FlowPiece[] = rows.map((p) => {
        const path = typeof p["image_path"] === "string" ? (p["image_path"] as string) : null;
        const versions: FlowVersion[] = versionRows
          .filter((v) => String(v["piece_id"]) === String(p["id"]))
          .map((v) => ({
            label: String(v["label"] ?? ""),
            path: String(v["image_path"]),
            url: signed[String(v["image_path"])] ?? "",
            createdAt: String(v["created_at"] ?? ""),
          }))
          .filter((v) => v.url.length > 0)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return {
          id: String(p["id"]),
          applicationId: String(p["application_id"]),
          role: String(p["role"] ?? "coordenado"),
          position: Number(p["position"] ?? 0),
          status: String(p["status"] ?? "pendente") as FlowPiece["status"],
          imagePath: path,
          imageUrl: path ? (signed[path] ?? null) : null,
          error: typeof p["error"] === "string" ? (p["error"] as string) : null,
          versions,
        };
      });

      setCollectionId(String(row["id"]));
      setName(String(row["name"] ?? ""));
      setPieces(list);
      setMasterPrompt(String(direction["masterPrompt"] ?? ""));
      setSummary(String(direction["masterSummary"] ?? ""));
      setPalette(((row["palette"] as string[]) ?? []).filter(Boolean));
      const adj = Array.isArray(brief["adjustments"]) ? (brief["adjustments"] as string[]) : [];
      setAdjustmentsState(adj);

      const usage = String(brief["usage"] ?? defaultUsage.usage);
      setFlow({
        theme: typeof brief["theme"] === "string" ? (brief["theme"] as string) : null,
        words: String(brief["words"] ?? ""),
        climate: typeof brief["climate"] === "string" ? (brief["climate"] as string) : null,
        usage,
        apps: list.filter((p) => p.role !== "principal").map((p) => p.applicationId),
      });

      const main = list.find((p) => p.role === "principal");
      const coords = list.filter((p) => p.role !== "principal");
      return {
        hasPrompt: String(direction["masterPrompt"] ?? "").trim().length > 0,
        principalReady: Boolean(main?.imageUrl),
        coordinatesStarted: coords.some((p) => p.imageUrl || p.status === "gerando"),
      };
    },
    [fetchCollection, signUrls],
  );

  /** Situação do trabalho em andamento. */
  const refreshJob = useCallback(async () => {
    if (!collectionId) return;
    try {
      const view = await readJob({ data: { collectionId } });
      setJob(view);
      if (view && !ACTIVE_JOB.has(view.status)) {
        await loadCollection(collectionId);
      } else if (view) {
        // Peças em andamento aparecem como "gerando" mesmo antes de o banco marcar.
        const running = new Set(
          view.units.filter((u) => ACTIVE_JOB.has(u.status)).map((u) => u.pieceId),
        );
        if (running.size > 0) {
          setPieces((prev) =>
            prev.map((p) => (running.has(p.id) ? { ...p, status: "gerando" } : p)),
          );
        }
      }
    } catch {
      // A próxima batida tenta de novo.
    }
  }, [collectionId, readJob, loadCollection]);

  useEffect(() => {
    if (!jobActive) return;
    const timer = setInterval(() => void refreshJob(), 3000);
    return () => clearInterval(timer);
  }, [jobActive, refreshJob]);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "visible") void refreshJob();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [refreshJob]);

  // Abre a coleção da URL no passo certo.
  useEffect(() => {
    const id = search.colecao;
    if (!id) {
      setLoaded(true);
      return;
    }
    if (loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    void (async () => {
      try {
        const state = await loadCollection(id);
        const view = await readJob({ data: { collectionId: id } });
        setJob(view);
        if (!state.hasPrompt) setStep(1);
        else if (state.coordinatesStarted) setStep(5);
        else setStep(4);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível abrir a coleção.");
      } finally {
        setLoaded(true);
      }
    })();
  }, [search.colecao, loadCollection, readJob]);

  useEffect(() => {
    const total = pieces.length;
    const ready = pieces.filter((p) => p.status === "pronta").length;
    document.title = jobActive ? `(${ready}/${total}) Studio | AiLou` : "Studio | AiLou";
  }, [pieces, jobActive]);

  const fail = (err: unknown, fallback: string) => {
    toast.error(err instanceof Error ? err.message : fallback);
  };

  /** Passo 3 → 4: salva a coleção, escreve o prompt e pinta a principal. */
  const handleCreatePrincipal = async () => {
    const theme = findTheme(flow.theme);
    const collectionName = theme?.name ?? (flow.words.trim().slice(0, 60) || "Minha coleção");
    if (!flow.climate) {
      toast.error("Escolha um clima.");
      return;
    }
    setBusy("Salvando a coleção…");
    try {
      const principalApp = principalAppFor(
        USAGES.find((u) => u.usage === flow.usage)?.applicationIds ?? [],
      );
      const existing = new Map(pieces.map((p) => [p.applicationId, p.id]));
      const pieceInputs = [
        {
          ...(existing.get(principalApp) ? { id: existing.get(principalApp)! } : {}),
          applicationId: principalApp,
          role: "principal",
          position: 0,
          overrides: {},
        },
        ...flow.apps.map((appId, i) => ({
          ...(existing.get(appId) ? { id: existing.get(appId)! } : {}),
          applicationId: appId,
          role: getApplication(appId)?.suggestedRole === "apoio" ? "apoio" : "coordenado",
          position: i + 1,
          overrides: {},
        })),
      ];
      const saved = await save({
        data: {
          ...(collectionId ? { id: collectionId } : {}),
          name: collectionName,
          status: "rascunho",
          brief: {
            flow: "v7",
            theme: flow.theme,
            themeName: theme?.name ?? "",
            themeDesc: theme?.desc ?? "",
            words: flow.words.trim(),
            climate: flow.climate,
            usage: flow.usage,
            adjustments: [],
          },
          palette: [],
          pieces: pieceInputs,
        },
      });
      const id = saved.collectionId;
      setCollectionId(id);
      setName(collectionName);
      if (search.colecao !== id) {
        loadedIdRef.current = id;
        void navigate({ to: "/studio", search: { colecao: id }, replace: true });
      }
      setStep(4);
      setBusy("Escrevendo o prompt da peça principal…");
      const written = await writePrompt({ data: { collectionId: id } });
      setMasterPrompt(written.prompt);
      setSummary(written.summary);
      setPalette(written.palette);
      setAdjustmentsState([]);
      setBusy("Pintando a peça principal…");
      await repaintPrincipal(id);
    } catch (err) {
      fail(err, "Não foi possível criar a peça principal.");
    } finally {
      setBusy(null);
    }
  };

  const repaintPrincipal = async (id: string) => {
    await paintPrincipal({ data: { collectionId: id } });
    await loadCollection(id);
    // A fila demora uns segundos para marcar a peça; a tela já mostra "pintando".
    setPieces((prev) =>
      prev.map((p) => (p.role === "principal" ? { ...p, status: "gerando" } : p)),
    );
    setJob(await readJob({ data: { collectionId: id } }));
  };

  /** Refaz a principal com os ajustes marcados e, se houver, o pedido em palavras. */
  const handleRedoPrincipal = async (next: string[], request: string) => {
    if (!collectionId) return;
    try {
      if (request) {
        // O pedido reescreve o prompt já com os ajustes antigos embutidos.
        setBusy("Reescrevendo o prompt com o seu pedido…");
        const written = await rewritePrompt({ data: { collectionId, request } });
        setMasterPrompt(written.prompt);
        setSummary(written.summary);
        setPalette(written.palette);
      }
      setBusy("Aplicando os ajustes…");
      await persistAdjustments({ data: { collectionId, adjustments: next } });
      setAdjustmentsState(next);
      setBusy("Pintando a peça principal…");
      await repaintPrincipal(collectionId);
    } catch (err) {
      fail(err, "Não foi possível refazer a peça principal.");
    } finally {
      setBusy(null);
    }
  };

  const handleRetryPrincipal = async () => {
    if (!collectionId) return;
    setBusy("Pintando outra tentativa…");
    try {
      await repaintPrincipal(collectionId);
    } catch (err) {
      fail(err, "Não foi possível pintar de novo.");
    } finally {
      setBusy(null);
    }
  };

  const handleSavePrompt = async (text: string) => {
    if (!collectionId) return;
    setBusy("Salvando o prompt…");
    try {
      await persistPrompt({ data: { collectionId, prompt: text } });
      setMasterPrompt(text.trim());
      setAdjustmentsState([]);
      setBusy("Pintando a peça principal…");
      await repaintPrincipal(collectionId);
    } catch (err) {
      fail(err, "Não foi possível salvar o prompt.");
    } finally {
      setBusy(null);
    }
  };

  const handlePickVersion = async (version: FlowVersion) => {
    if (!principal || !collectionId) return;
    try {
      await pickVersion({ data: { pieceId: principal.id, imagePath: version.path } });
      await loadCollection(collectionId);
      toast.success("Versão escolhida.");
    } catch (err) {
      fail(err, "Não foi possível escolher esta versão.");
    }
  };

  const handleApprove = async () => {
    if (!collectionId) return;
    setStep(5);
    if (coordinates.length > 0 && coordinates.every((p) => p.imageUrl)) return;
    setBusy("Enfileirando os coordenados…");
    try {
      await paintCoordinates({ data: { collectionId } });
      await loadCollection(collectionId);
      setJob(await readJob({ data: { collectionId } }));
    } catch (err) {
      fail(err, "Não foi possível iniciar os coordenados.");
    } finally {
      setBusy(null);
    }
  };

  const handleRedo = async (piece: FlowPiece) => {
    if (!collectionId) return;
    try {
      await queueUnit({
        data: { pieceId: piece.id, kind: piece.role === "principal" ? "principal" : "coordenado" },
      });
      setPieces((prev) => prev.map((p) => (p.id === piece.id ? { ...p, status: "gerando" } : p)));
      setJob(await readJob({ data: { collectionId } }));
    } catch (err) {
      fail(err, "Não foi possível refazer a peça.");
    }
  };

  const handleRedoAll = async () => {
    if (!collectionId) return;
    setBusy("Refazendo os coordenados…");
    try {
      await paintCoordinates({ data: { collectionId, recreateAll: true } });
      await loadCollection(collectionId);
      setJob(await readJob({ data: { collectionId } }));
    } catch (err) {
      fail(err, "Não foi possível refazer os coordenados.");
    } finally {
      setBusy(null);
    }
  };

  const handleStop = async () => {
    if (!job) return;
    try {
      await stopJob({ data: { jobId: job.id } });
      toast.info("Vai parar depois das peças que já começaram.");
      await refreshJob();
    } catch (err) {
      fail(err, "Não foi possível parar agora.");
    }
  };

  const handleDownload = async () => {
    setBusy("Preparando o arquivo…");
    try {
      await downloadFlowZip({ name, pieces, prompt: masterPrompt });
    } catch (err) {
      fail(err, "Não foi possível baixar a coleção.");
    } finally {
      setBusy(null);
    }
  };

  const handleNew = () => {
    setStep(1);
    setFlow(initialFlow);
    setCollectionId(null);
    setName("");
    setPieces([]);
    setMasterPrompt("");
    setSummary("");
    setPalette([]);
    setAdjustmentsState([]);
    setJob(null);
    loadedIdRef.current = null;
    void navigate({ to: "/studio", search: {}, replace: true });
  };

  if (!loaded) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Spinner /> Abrindo a coleção…
        </span>
      </div>
    );
  }

  const stepTitle = STEP_TITLES[step - 1] ?? "";
  const readyCount = pieces.filter((p) => p.status === "pronta").length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Passo {step} de 5 · {stepTitle}
          </p>
          {name && step >= 4 && <h1 className="truncate font-display text-2xl">{name}</h1>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" aria-hidden>
            {STEP_TITLES.map((title, i) => (
              <span
                key={title}
                className={
                  "h-1.5 w-7 rounded-full " +
                  (i + 1 < step ? "bg-primary/50" : i + 1 === step ? "bg-primary" : "bg-border")
                }
              />
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="mr-1 h-4 w-4" /> Nova coleção
          </Button>
        </div>
      </div>

      {busy && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <Spinner /> {busy}
        </div>
      )}

      {step === 1 && (
        <StepTheme
          theme={flow.theme}
          words={flow.words}
          onTheme={(id) => setFlow((f) => ({ ...f, theme: f.theme === id ? null : id }))}
          onWords={(w) => setFlow((f) => ({ ...f, words: w }))}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepClimate
          themeName={findTheme(flow.theme)?.name ?? (flow.words.trim() || "o tema")}
          climate={flow.climate}
          onClimate={(id) => setFlow((f) => ({ ...f, climate: id }))}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepUsage
          usage={flow.usage}
          apps={flow.apps}
          onUsage={(usage) => {
            const kit = USAGES.find((u) => u.usage === usage);
            setFlow((f) => ({
              ...f,
              usage,
              apps: kit ? coordinateAppsFor(kit.applicationIds) : f.apps,
            }));
          }}
          onApps={(apps) => setFlow((f) => ({ ...f, apps }))}
          onBack={() => setStep(2)}
          onNext={() => void handleCreatePrincipal()}
          disabled={busy !== null}
        />
      )}

      {step === 4 && (
        <StepPrincipal
          piece={principal}
          summary={summary}
          palette={palette}
          masterPrompt={masterPrompt}
          adjustments={adjustments}
          working={busy !== null || (jobActive && principal?.status === "gerando")}
          onRedo={(adj, text) => void handleRedoPrincipal(adj, text)}
          onRetry={() => void handleRetryPrincipal()}
          onSavePrompt={(text) => void handleSavePrompt(text)}
          onPickVersion={(v) => void handlePickVersion(v)}
          onBack={() => setStep(3)}
          onApprove={() => void handleApprove()}
        />
      )}

      {step === 5 && (
        <>
          {jobActive && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Pintando {Math.min(readyCount + 1, pieces.length)} de {pieces.length}
                </span>
                <Button variant="ghost" size="sm" onClick={() => void handleStop()}>
                  Parar
                </Button>
              </div>
              <Progress value={pieces.length === 0 ? 0 : (100 * readyCount) / pieces.length} />
            </div>
          )}
          <StepCollection
            pieces={pieces}
            working={busy !== null || jobActive}
            onRedo={(p) => void handleRedo(p)}
            onRedoAll={() => void handleRedoAll()}
            onDownload={() => void handleDownload()}
            onBack={() => setStep(4)}
          />
        </>
      )}
    </div>
  );
}
