import { useState } from "react";
import { Download, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { LayoutPreview } from "@/components/studio/LayoutPreview";
import { Spinner } from "@/components/ui/spinner";
import { measureLabel, type Application } from "@/lib/catalog";
import { modelLabel, roleLabel, versionSuffix, versionTitle, type Piece } from "@/lib/collection";
import { downloadPieceImage, safeFileName } from "@/lib/export/download";
import { cn } from "@/lib/utils";

interface Props {
  piece: Piece;
  app: Application;
  palette: string[];
  index: number;
  onOpen: () => void;
  onRecreate?: () => void;
  onHiFi?: () => void;
  onFixSeam?: () => void;
}

/** Proporção da miniatura, fiel ao formato da peça. */
export function thumbRatio(app: Application): number {
  if (app.family === "painel") {
    const f = app.params.frames;
    return f.widthCm / f.heightCm;
  }
  return 1;
}

function StatusLine({ piece, app }: { piece: Piece; app: Application }) {
  const parts: string[] = [];
  if (piece.dpi) {
    parts.push(piece.dpi >= 150 ? `Pronta para impressão (${piece.dpi} dpi)` : `Resolução de tela (${piece.dpi} dpi)`);
  }
  if (piece.preparing) parts.push("Preparando para impressão");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {app.family === "painel" ? (
        piece.composition ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5",
              piece.composition.ok
                ? "bg-success text-success-foreground"
                : "bg-warning text-warning-foreground",
            )}
          >
            {piece.composition.ok ? "Composição conferida" : "Composição fora do esperado, recrie"}
          </span>
        ) : (
          <span>Arte posicionada no corte</span>
        )
      ) : piece.seam ? (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5",
            piece.seam.ok ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground",
          )}
        >
          {piece.seam.ok ? "Emenda verificada" : "Emenda precisa de ajuste"}
        </span>
      ) : (
        <span>Emenda ainda não conferida</span>
      )}

      {parts.map((p) => (
        <span key={p}>{p}</span>
      ))}
    </div>
  );
}

export function PatternCard({
  piece,
  app,
  palette,
  index,
  onOpen,
  onRecreate,
  onHiFi,
  onFixSeam,
}: Props) {
  const versions = piece.versions ?? [];
  const [picked, setPicked] = useState(-1);
  const current = picked >= 0 ? versions[picked] : undefined;
  const shownUrl = current?.url ?? piece.imageUrl;
  const suffix = current ? `-${versionSuffix(current)}` : "";

  async function handleDownload() {
    const source = current?.url ?? piece.printUrl ?? piece.imageUrl;
    if (!source) {
      toast.message("Gere a estampa antes de baixar.");
      return;
    }
    try {
      await downloadPieceImage(source, app, `${safeFileName(app.name)}${suffix}.png`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível baixar a imagem.");
    }
  }

  const needsFix = app.family !== "painel" && piece.seam && !piece.seam.ok && !!piece.imageUrl;

  return (
    <article className="surface-card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full overflow-hidden bg-secondary"
        aria-label={`Abrir prévia de ${app.name}`}
      >
        {shownUrl ? (
          <div
            className="mx-auto flex max-h-[220px] w-full items-center justify-center"
            style={{ aspectRatio: String(thumbRatio(app)) }}
          >
            <img
              src={shownUrl}
              alt={`Estampa ${app.name}`}
              className="block max-h-[220px] w-full object-contain"
              loading="lazy"
            />
          </div>
        ) : (
          <LayoutPreview
            app={app}
            palette={palette}
            motifScale={piece.overrides.motifScale}
            density={piece.overrides.density}
          />
        )}
        <span className="absolute left-3 top-3 rounded-md bg-card/90 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {String(index).padStart(2, "0")}
        </span>
        {piece.status === "gerando" && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/80 text-sm text-primary">
            <Spinner className="size-5" />
            {piece.stage || "Pintando…"}
          </span>
        )}
        {piece.status !== "gerando" && piece.preparing && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-card/90 px-2 py-1 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            Preparando para impressão…
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="eyebrow">{roleLabel(piece.role)}</p>
        <h3 className="text-base leading-tight">{app.name}</h3>
        <p className="text-xs text-muted-foreground">
          {measureLabel(app)}
          {modelLabel(piece.timings) ? ` · ${modelLabel(piece.timings)}` : ""}
        </p>

        {versions.length > 0 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Versões desta estampa">
            {["Original", ...versions.map((v) => versionTitle(v))].map((title, i) => {
              const value = i - 1;
              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => setPicked(value)}
                  aria-pressed={picked === value}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    picked === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-primary",
                  )}
                >
                  {title}
                </button>
              );
            })}
          </div>
        )}
        {piece.status === "erro" && (
          <p className="text-xs text-destructive">Não deu certo desta vez. Tente recriar.</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <StatusLine piece={piece} app={app} />
          <div className="flex shrink-0 items-center gap-1">
            {needsFix && onFixSeam && (
              <button
                type="button"
                onClick={onFixSeam}
                disabled={piece.status === "gerando"}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary disabled:opacity-40"
                aria-label={`Corrigir emenda de ${app.name}`}
                title="Corrigir emenda"
              >
                <Wand2 className="size-4" strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              aria-label={`Baixar ${app.name}`}
            >
              <Download className="size-4" strokeWidth={1.5} />
            </button>
            {onHiFi && piece.imageUrl && (
              <button
                type="button"
                onClick={onHiFi}
                disabled={piece.status === "gerando"}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary disabled:opacity-40"
                aria-label={`Recriar ${app.name} em alta resolução`}
                title="Recriar em alta resolução"

              >
                <Sparkles className="size-4" strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              disabled={!onRecreate || piece.status === "gerando"}
              onClick={() =>
                onRecreate
                  ? onRecreate()
                  : toast.message("Aprove a proposta para gerar as estampas.")
              }
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary disabled:opacity-40"
              aria-label={`Recriar ${app.name}`}
            >
              <RefreshCw className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
