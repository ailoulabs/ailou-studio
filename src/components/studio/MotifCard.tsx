import { useState } from "react";
import { AlertTriangle, Flower2, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { MotifEntry } from "@/hooks/use-studio";

interface Props {
  sheetUrl: string | null;
  motifs: MotifEntry[];
  /** A prancha está sendo pintada agora. */
  painting: boolean;
  /** Segundos desde o início da pintura. */
  elapsed: number;
  /** A paleta ou as orientações mudaram depois da prancha. */
  stale: boolean;
  /** A coleção já tem estampas pintadas. */
  hasArt: boolean;
  busy: boolean;
  startCollapsed: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onRecreatePieces: () => void;
  /** Tira ou devolve um motivo da coleção. */
  onToggleMotif?: (index: number, excluded: boolean) => void;
  /** O recorte dos motivos da prancha falhou. */
  motifsFailed?: boolean;
  /** Repete só o recorte, sem gerar imagem nova. */
  onRetryMotifs?: () => void;
  /** Paleta, ajustes e orientações desta etapa. */
  children?: React.ReactNode;
}


function Tile({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div
      className="flex aspect-square h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary p-1"
      {...(title ? { title } : {})}
    >
      {children}
    </div>
  );
}

export function MotifCard({
  sheetUrl,
  motifs,
  painting,
  elapsed,
  stale,
  hasArt,
  busy,
  startCollapsed,
  onGenerate,
  onRegenerate,
  onRecreatePieces,
  onToggleMotif,
  motifsFailed,
  onRetryMotifs,

  children,
}: Props) {
  const [open, setOpen] = useState(!startCollapsed);
  const ready = Boolean(sheetUrl) && !painting;

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
            <Flower2 className="size-4" strokeWidth={1.5} />
          </span>
          <div>
            <p className="eyebrow">Motivos da coleção</p>
            <h3 className="mt-1 text-lg leading-tight">Paleta e motivos da coleção</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {painting
                ? "Escolhendo as cores e pintando os motivos…"
                : stale
                  ? "Motivos desatualizados: a paleta ou as orientações mudaram."
                  : motifs.length > 0
                    ? `${motifs.filter((m) => !m.excluded).length} de ${motifs.length} motivos em uso.`
                    : sheetUrl
                      ? "Prancha criada, recortando os motivos."
                      : "Todas as estampas nascem desta mesma pintura."}
            </p>
          </div>
        </div>
        {ready && startCollapsed && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Recolher" : "Mostrar opções"}
          </Button>
        )}
      </div>

      {stale && !painting && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-accent bg-secondary px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-primary" strokeWidth={1.5} />
          Motivos desatualizados
        </p>
      )}

      {motifsFailed && !painting && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent bg-secondary px-3 py-2 text-sm text-foreground">
          <span>Não foi possível carregar os motivos</span>
          <Button variant="outline" size="sm" onClick={onRetryMotifs} disabled={busy}>
            Tentar de novo
          </Button>
        </div>
      )}


      <div className="mt-4 flex flex-wrap items-center gap-3">
        {painting &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <Tile key={i}>
              <span className="block h-full w-full animate-pulse rounded bg-muted" />
            </Tile>
          ))}
        {!painting && sheetUrl && (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary p-1">
            <img
              src={sheetUrl}
              alt="Prancha de motivos da coleção"
              className="block h-full w-full object-contain"
            />
          </div>
        )}
        {!painting &&
          motifs.map((motif) => (
            <div key={motif.index} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <div className="relative">
                <Tile title={motif.name ?? motif.type}>
                  <img
                    src={motif.url}
                    alt={`Motivo ${motif.index + 1}: ${motif.name ?? motif.type}`}
                    className={`block h-full w-full object-contain ${motif.excluded ? "opacity-25" : ""}`}
                  />
                </Tile>
                {onToggleMotif && !motif.excluded && (
                  <button
                    type="button"
                    aria-label={`Tirar o motivo ${motif.name ?? motif.index + 1} da coleção`}
                    onClick={() => onToggleMotif(motif.index, true)}
                    className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-primary"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
              {motif.excluded ? (
                <button
                  type="button"
                  onClick={() => onToggleMotif?.(motif.index, false)}
                  className="text-[10px] font-medium text-primary underline underline-offset-2"
                >
                  Desfazer
                </button>
              ) : (
                <span className="line-clamp-1 text-center text-[12.5px] leading-tight text-muted-foreground">
                  {motif.name ?? ""}
                </span>
              )}
              {motif.offTheme && !motif.excluded && (
                <span className="text-[10px] text-primary">fora do tema</span>
              )}
            </div>
          ))}
      </div>

      {painting && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5 text-primary" />
          Pintando os motivos da coleção… {elapsed}s
        </p>
      )}

      {!painting && open && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!sheetUrl && (
            <Button size="lg" onClick={onGenerate} disabled={busy}>
              {busy ? <Spinner /> : <Sparkles className="size-4" strokeWidth={1.5} />}
              2. Gerar paleta e motivos
            </Button>
          )}
          {sheetUrl && stale && (
            <Button size="lg" onClick={onRegenerate} disabled={busy}>
              {busy ? <Spinner /> : <RefreshCw className="size-4" strokeWidth={1.5} />}
              Atualizar motivos
            </Button>
          )}
          {sheetUrl && !stale && (
            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={busy}>
              {busy ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" strokeWidth={1.5} />}
              Gerar outros motivos
            </Button>
          )}
          {sheetUrl && hasArt && (
            <Button variant="outline" size="sm" onClick={onRecreatePieces} disabled={busy}>
              <Wand2 className="size-3.5" strokeWidth={1.5} />
              Recriar as estampas com estes motivos
            </Button>
          )}
        </div>
      )}

      {!painting && open && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {sheetUrl
            ? "Você pode gerar outros motivos quantas vezes quiser. As estampas só mudam quando você pedir."
            : "Aqui a ferramenta propõe as cinco cores e pinta os motivos. Leva cerca de 30 segundos."}
        </p>
      )}

      {!painting && open && children}
    </section>
  );
}
