import { useEffect, useRef, useState } from "react";
import { composeCut, drawBandGuides, drawRuler, type ComposedCut } from "@/lib/assembly/compose";
import type { Application } from "@/lib/catalog";

interface Props {
  imageUrl: string;
  app: Application;
  onReady?: (cut: ComposedCut) => void;
}

/** Mostra o corte montado de verdade, com régua em cm. */
export function CutCanvas({ imageUrl, app, onReady }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);

    void composeCut(imageUrl, app)
      .then((cut) => {
        if (!active || !ref.current) return;
        const display = ref.current;
        const width = 1200;
        const scale = width / cut.canvas.width;
        display.width = width;
        display.height = Math.round(cut.canvas.height * scale) + 18;
        const ctx = display.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, display.width, display.height);
        ctx.drawImage(cut.canvas, 0, 18, display.width, display.height - 18);
        drawRuler(ctx, cut, scale);
        if (app.family === "barrado" && app.params.bands > 1) {
          drawBandGuides(ctx, cut, scale, app, 18);
        }
        onReady?.(cut);
      })
      .catch(() => {
        if (active) setError("Não foi possível montar o corte desta peça.");
      });

    return () => {
      active = false;
    };
  }, [imageUrl, app, onReady]);

  if (error) {
    return (
      <div className="grid h-48 place-items-center p-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return <canvas ref={ref} className="block h-auto w-full" />;
}
