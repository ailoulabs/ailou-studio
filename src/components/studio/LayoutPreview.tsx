import { useEffect, useRef } from "react";
import { drawLayoutPreview, previewAspect } from "@/lib/assembly/preview";
import type { Application } from "@/lib/catalog";
import { cn } from "@/lib/utils";

interface Props {
  app: Application;
  palette: string[];
  motifScale?: number;
  density?: number;
  className?: string;
  showQuietArea?: boolean;
  /** Força uma proporção diferente da natural do corte. */
  aspect?: number;
}

export function LayoutPreview({ app, palette, motifScale, density, className, aspect, showQuietArea }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ratio = aspect ?? previewAspect(app);
  const paletteKey = palette.join();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    function render() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(w / ratio));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = w * dpr;
      el.height = h * dpr;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawLayoutPreview(ctx, {
        app,
        palette: paletteKey.split(","),
        width: w,
        height: h,
        motifScale,
        density,
        showQuietArea,
      });
    }

    render();
    const obs = new ResizeObserver(render);
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [app, paletteKey, motifScale, density, ratio, showQuietArea]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`Prévia do layout de ${app.name}`}
      className={cn("block w-full", className)}
      style={{ aspectRatio: `${ratio}` }}
    />
  );
}
