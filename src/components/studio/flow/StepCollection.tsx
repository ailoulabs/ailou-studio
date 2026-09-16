import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getApplication, measureLabel, type Application } from "@/lib/catalog";
import type { FlowPiece } from "@/lib/flow-types";
import { cn } from "@/lib/utils";

interface Props {
  pieces: FlowPiece[];
  working: boolean;
  onRedo: (piece: FlowPiece) => void;
  onRedoAll: () => void;
  onDownload: () => void;
  onBack: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  principal: "Principal",
  coordenado: "Coordenado",
  apoio: "Apoio",
};

function ratioOf(app: Application): number {
  if (app.family === "painel") {
    const f = app.params.frames;
    return f.renderLandscape
      ? Math.max(f.widthCm, f.heightCm) / Math.min(f.widthCm, f.heightCm)
      : f.widthCm / f.heightCm;
  }
  return 1;
}

export function StepCollection({ pieces, working, onRedo, onRedoAll, onDownload, onBack }: Props) {
  const ready = pieces.filter((p) => p.status === "pronta" && p.imageUrl).length;
  const anyRunning = pieces.some((p) => p.status === "gerando");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Sua coleção</h1>
        <p className="mt-1 text-muted-foreground">
          As outras peças seguem a principal: mesmos desenhos, mesmas cores, mesma mão.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pieces.map((piece) => {
          const app = getApplication(piece.applicationId);
          if (!app) return null;
          const isPrincipal = piece.role === "principal";
          const generating = piece.status === "gerando";
          return (
            <div
              key={piece.id}
              className={cn(
                "overflow-hidden rounded-2xl border bg-card",
                isPrincipal ? "border-primary/60" : "border-border",
              )}
            >
              <div
                className="relative w-full bg-muted"
                style={{ aspectRatio: String(ratioOf(app)) }}
              >
                {piece.imageUrl && (
                  <img
                    src={piece.imageUrl}
                    alt={app.name}
                    className={cn("h-full w-full object-cover", generating && "opacity-40")}
                  />
                )}
                {generating && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 text-xs shadow">
                      <Spinner /> Pintando…
                    </div>
                  </div>
                )}
                {!generating && !piece.imageUrl && (
                  <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground">
                    {piece.status === "erro" ? `Não deu certo: ${piece.error ?? ""}` : "Na fila"}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {ROLE_LABEL[piece.role] ?? piece.role}
                  </div>
                  <div className="truncate text-sm font-semibold">{app.name}</div>
                  <div className="text-xs text-muted-foreground">{measureLabel(app)}</div>
                </div>
                {!isPrincipal && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={working || generating}
                    onClick={() => onRedo(piece)}
                    title="Refazer esta peça usando a principal como referência"
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refazer
                  </Button>
                )}
              </div>
              {piece.error && piece.imageUrl && !generating && (
                <p className="px-3 pb-2 text-xs text-destructive">
                  Última tentativa falhou; a arte anterior continua valendo.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        O corte, a emenda e a prova no tecido ficam para uma próxima etapa. Aqui o foco é acertar as
        estampas.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack} disabled={anyRunning}>
          Voltar à principal
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRedoAll} disabled={working || anyRunning}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refazer coordenados
          </Button>
          <Button onClick={onDownload} disabled={working || ready === 0}>
            <Download className="mr-1 h-4 w-4" /> Baixar coleção ({ready})
          </Button>
        </div>
      </div>
    </section>
  );
}
