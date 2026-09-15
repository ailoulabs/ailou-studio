import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Scissors,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LayoutPreview } from "@/components/studio/LayoutPreview";
import { CutCanvas } from "@/components/studio/CutCanvas";
import { canvasToBlob, type ComposedCut } from "@/lib/assembly/compose";
import { blobWithDpi, dpiFor } from "@/lib/export/png-dpi";
import { downloadPieceImage, safeFileName } from "@/lib/export/download";
import { FAMILY_LABEL, getApplication, measureLabel } from "@/lib/catalog";
import { modelLabel, roleLabel, versionSuffix, versionTitle, type Piece } from "@/lib/collection";

interface Props {
  piece: Piece | null;
  palette: string[];
  onOpenChange: (open: boolean) => void;
  onRecreate?: (piece: Piece) => void;
  onFixSeam?: (piece: Piece) => void;
  onNavigate?: (direction: -1 | 1) => void;
}

export function PreviewDialog({
  piece,
  palette,
  onOpenChange,
  onRecreate,
  onFixSeam,
  onNavigate,
}: Props) {
  const [showQuiet, setShowQuiet] = useState(true);
  const [cut, setCut] = useState<ComposedCut | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [picked, setPicked] = useState(-1);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const handleReady = useCallback((composed: ComposedCut) => setCut(composed), []);

  const pieceId = piece?.id;
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setPicked(-1);
  }, [pieceId]);

  useEffect(() => {
    if (!onNavigate) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") onNavigate?.(-1);
      if (event.key === "ArrowRight") onNavigate?.(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNavigate]);

  const app = piece ? getApplication(piece.applicationId) : undefined;
  if (!piece || !app) return null;

  const hasQuiet = app.family === "painel" && !!app.params.frames.quietArea;
  const secondTab = app.family === "corrida" ? "Repetição" : "No corte";
  const versions = piece.versions ?? [];
  const current = picked >= 0 ? versions[picked] : undefined;
  const image = current?.url ?? piece.printUrl ?? piece.imageUrl;
  const suffix = current ? `-${versionSuffix(current)}` : "";
  const seam = current ? (current.seam ?? undefined) : piece.seam;
  const needsFix = app.family !== "painel" && piece.seam && !piece.seam.ok && !!piece.imageUrl;


  function clampZoom(value: number) {
    return Math.min(6, Math.max(0.25, Number(value.toFixed(2))));
  }

  async function downloadModule() {
    if (!image || !app) return;
    try {
      await downloadPieceImage(image, app, `${safeFileName(app.name)}${suffix}.png`);
    } catch {
      toast.error("Não foi possível baixar a imagem.");
    }
  }

  async function downloadCut() {
    if (!cut || !app) return;
    try {
      const blob = await canvasToBlob(cut.canvas);
      const withDpi = await blobWithDpi(blob, dpiFor(cut.canvas.width, cut.widthCm));
      const url = URL.createObjectURL(withDpi);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(app.name)}${suffix}-corte.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível baixar o corte montado.");
    }
  }

  return (
    <Dialog open={!!piece} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <p className="eyebrow">{roleLabel(piece.role)}</p>
          <DialogTitle className="text-2xl">{app.name}</DialogTitle>
          <DialogDescription>
            {FAMILY_LABEL[app.family]} · {measureLabel(app)}
            {piece.dpi ? ` · ${piece.dpi} dpi` : ""}
            {modelLabel(piece.timings) ? ` · ${modelLabel(piece.timings)}` : ""}

          </DialogDescription>
        </DialogHeader>

        {versions.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Versões desta estampa">
            {["Original", ...versions.map((v) => versionTitle(v))].map((title, i) => {
              const value = i - 1;
              return (
                <Button
                  key={title}
                  type="button"
                  size="sm"
                  variant={picked === value ? "default" : "outline"}
                  aria-pressed={picked === value}
                  onClick={() => setPicked(value)}
                >
                  {title}
                </Button>
              );
            })}
          </div>
        )}

        <Tabs defaultValue="estampa">
          <TabsList>
            <TabsTrigger value="estampa">Estampa</TabsTrigger>
            <TabsTrigger value="corte">{secondTab}</TabsTrigger>
            <TabsTrigger value="tecido">No tecido</TabsTrigger>
          </TabsList>

          <TabsContent value="estampa" className="mt-4 space-y-3">
            <div
              className="relative max-h-[65vh] overflow-hidden rounded-lg border border-border bg-secondary/30"
              onWheel={(event) => {
                if (!image) return;
                event.preventDefault();
                setZoom((z) => clampZoom(z * (event.deltaY < 0 ? 1.12 : 0.89)));
              }}
              onPointerDown={(event) => {
                if (zoom <= 1) return;
                dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = dragRef.current;
                if (!start) return;
                setOffset({ x: event.clientX - start.x, y: event.clientY - start.y });
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              style={{ cursor: zoom > 1 ? "grab" : "default" }}
            >
              {image ? (
                <div className="grid max-h-[65vh] min-h-[320px] place-items-center">
                  <img
                    src={image}
                    alt={app.name}
                    draggable={false}
                    className="max-h-[65vh] w-auto max-w-full object-contain"
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                      transformOrigin: "center",
                    }}
                  />
                </div>
              ) : (
                <LayoutPreview
                  app={app}
                  palette={palette}
                  motifScale={piece.overrides.motifScale}
                  density={piece.overrides.density}
                  showQuietArea={showQuiet}
                />
              )}
            </div>

            {image && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setZoom((z) => clampZoom(z * 0.8))} aria-label="Diminuir zoom">
                  <Minus className="size-4" strokeWidth={1.5} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setZoom((z) => clampZoom(z * 1.25))} aria-label="Aumentar zoom">
                  <Plus className="size-4" strokeWidth={1.5} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setZoom(1);
                    setOffset({ x: 0, y: 0 });
                  }}
                >
                  <Maximize2 className="size-4" strokeWidth={1.5} />
                  Ajustar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setZoom(2)}>
                  100%
                </Button>
                <span className="text-xs text-muted-foreground">
                  {Math.round(zoom * 100)}% da tela
                </span>
                {onNavigate && (
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onNavigate(-1)} aria-label="Peça anterior">
                      <ChevronLeft className="size-4" strokeWidth={1.5} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onNavigate(1)} aria-label="Próxima peça">
                      <ChevronRight className="size-4" strokeWidth={1.5} />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {hasQuiet && (
              <div className="flex items-center gap-3">
                <Switch id="prato" checked={showQuiet} onCheckedChange={setShowQuiet} />
                <Label htmlFor="prato" className="text-sm">
                  Mostrar área do prato
                </Label>
              </div>
            )}

            {seam && (
              <p className="text-xs text-muted-foreground">
                Emenda: razão {seam.score} (passa até 4).
              </p>
            )}
          </TabsContent>

          <TabsContent value="corte" className="mt-4 space-y-4">
            <div className="overflow-hidden rounded-lg border border-border">
              {image ? (
                <CutCanvas imageUrl={image} app={app} onReady={handleReady} />
              ) : (
                <LayoutPreview
                  app={app}
                  palette={palette}
                  motifScale={piece.overrides.motifScale}
                  density={piece.overrides.density}
                  showQuietArea={showQuiet}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{measureLabel(app)}</p>
          </TabsContent>

          <TabsContent value="tecido" className="mt-4">
            <div className="grid h-72 place-items-center rounded-lg border border-dashed border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
              A simulação em tecido chega em breve. Aqui você vai ver a estampa aplicada em uma peça
              costurada.
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="outline" disabled={!image} onClick={() => void downloadModule()}>
            <Download className="size-4" strokeWidth={1.5} />
            Baixar imagem original
          </Button>
          <Button variant="outline" disabled={!cut} onClick={() => void downloadCut()}>
            <Scissors className="size-4" strokeWidth={1.5} />
            Baixar o corte montado
          </Button>
          {needsFix && onFixSeam && (
            <Button variant="outline" onClick={() => onFixSeam(piece)}>
              <Wand2 className="size-4" strokeWidth={1.5} />
              Corrigir emenda
            </Button>
          )}
          <Button
            onClick={() => {
              if (onRecreate) onRecreate(piece);
              else toast("Recriar esta estampa fica disponível com a IA conectada.");
            }}
          >
            <RefreshCw className="size-4" strokeWidth={1.5} />
            Recriar esta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
