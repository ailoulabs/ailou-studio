import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { FlowPiece, FlowVersion } from "@/lib/flow-types";
import {
  ADJUSTMENT_GROUPS,
  ADJUSTMENTS,
  buildPrincipalPrompt,
  toggleAdjustment,
} from "@/lib/studio-flow";
import { cn } from "@/lib/utils";

interface Props {
  piece: FlowPiece | null;
  summary: string;
  palette: string[];
  masterPrompt: string;
  adjustments: string[];
  working: boolean;
  /** Refaz a principal com os ajustes marcados e, se houver, o pedido em palavras. */
  onRedo: (adjustments: string[], request: string) => void;
  onRetry: () => void;
  onSavePrompt: (text: string) => void;
  onPickVersion: (version: FlowVersion) => void;
  onBack: () => void;
  onApprove: () => void;
}

export function StepPrincipal({
  piece,
  summary,
  palette,
  masterPrompt,
  adjustments,
  working,
  onRedo,
  onRetry,
  onSavePrompt,
  onPickVersion,
  onBack,
  onApprove,
}: Props) {
  const [request, setRequest] = useState("");
  const [pending, setPending] = useState<string[]>(adjustments);
  const [showPrompt, setShowPrompt] = useState(false);
  const [draft, setDraft] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const finalPrompt = buildPrincipalPrompt(masterPrompt, adjustments);
  const generating = working || piece?.status === "gerando";
  const hasImage = Boolean(piece?.imageUrl);

  useEffect(() => {
    setDraft(finalPrompt);
  }, [finalPrompt]);

  // Quando o servidor devolve os ajustes gravados, a seleção local acompanha.
  useEffect(() => {
    setPending(adjustments);
  }, [adjustments]);

  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  const versions = piece?.versions ?? [];
  const dirty = draft.trim() !== finalPrompt.trim();
  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x) => b.includes(x));
  const canRedo = !sameSet(pending, adjustments) || request.trim().length > 1;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">A peça principal</h1>
        <p className="mt-1 text-muted-foreground">
          Ajuste com os botões até gostar. Cada toque pinta uma versão nova.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted">
            {hasImage && (
              <img
                src={piece!.imageUrl!}
                alt="Peça principal"
                className={cn("h-full w-full object-cover transition", generating && "opacity-40")}
              />
            )}
            {generating && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex flex-col items-center gap-2 rounded-xl bg-background/90 px-4 py-3 text-sm shadow">
                  <Spinner />
                  <span>Pintando a peça principal… {elapsed > 0 ? `${elapsed}s` : ""}</span>
                  <span className="text-xs text-muted-foreground">
                    Costuma levar entre 30 e 90 segundos.
                  </span>
                </div>
              </div>
            )}
            {!generating && !hasImage && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
                {piece?.error ? (
                  <span>
                    Não deu certo: {piece.error}
                    <br />
                    <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                      Tentar de novo
                    </Button>
                  </span>
                ) : (
                  "A peça principal ainda não foi pintada."
                )}
              </div>
            )}
          </div>

          {piece?.error && hasImage && !generating && (
            <p className="text-sm text-destructive">
              A última tentativa falhou ({piece.error}). A versão anterior continua valendo.
            </p>
          )}

          {versions.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Versões anteriores (toque para voltar)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {versions.map((v) => {
                  const current = v.path === piece?.imagePath;
                  return (
                    <button
                      key={v.path}
                      type="button"
                      disabled={generating || current}
                      onClick={() => onPickVersion(v)}
                      className={cn(
                        "h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition",
                        current
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/60",
                      )}
                      title={current ? "Versão atual" : "Usar esta versão"}
                    >
                      <img src={v.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {summary && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                O que vai ser pintado
              </p>
              <p>{summary}</p>
              {palette.length > 0 && (
                <div className="mt-3 flex gap-1" aria-label="Paleta">
                  {palette.map((hex) => (
                    <span
                      key={hex}
                      className="h-6 flex-1 rounded border border-border"
                      style={{ background: hex }}
                      title={hex}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ajustes
            </p>
            {ADJUSTMENT_GROUPS.map((group) => (
              <div key={group.id} className="flex flex-wrap items-center gap-2">
                <span className="w-36 shrink-0 text-sm text-muted-foreground">{group.label}</span>
                {ADJUSTMENTS.filter((a) => a.group === group.id).map((a) => {
                  const on = pending.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={generating || !hasImage}
                      onClick={() => setPending((prev) => toggleAdjustment(prev, a.id))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition disabled:opacity-50",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/60",
                      )}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Ou com suas palavras</span>
              <Input
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="Ex.: tirar as bananas e colocar mais hibiscos"
                maxLength={400}
                disabled={generating || !hasImage}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={generating || !masterPrompt}
                onClick={onRetry}
                title="Pinta de novo com o mesmo prompt, sem mudar nada"
              >
                Outra tentativa
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={generating || !hasImage || !canRedo}
                onClick={() => {
                  onRedo(pending, request.trim());
                  setRequest("");
                }}
              >
                Refazer com estes ajustes
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
              onClick={() => setShowPrompt((v) => !v)}
            >
              <span>Ver o prompt (avançado)</span>
              <span className="text-muted-foreground">{showPrompt ? "esconder" : "mostrar"}</span>
            </button>
            {showPrompt && (
              <div className="space-y-2 border-t border-border p-4">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={16}
                  className="font-mono text-xs"
                  disabled={generating}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Em inglês, porque é o que o pintor entende. Editar aqui zera os ajustes por
                    toque.
                  </p>
                  <Button
                    size="sm"
                    disabled={generating || !dirty || draft.trim().length < 40}
                    onClick={() => onSavePrompt(draft)}
                  >
                    Salvar e pintar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={generating}>
          Voltar
        </Button>
        <Button onClick={onApprove} disabled={generating || !hasImage}>
          Gostei, criar minha coleção
        </Button>
      </div>
    </section>
  );
}
