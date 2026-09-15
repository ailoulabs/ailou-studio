/**
 * Prévia esquemática de layout desenhada em canvas.
 * Mostra, em escala, o corte 50 cm × largura do tecido (barrado e painel)
 * ou o rapport ladrilhado 3 × 3 (estampa corrida).
 * Os motivos são placeholders suaves ate a geração real das imagens.
 */

import type { Application } from "@/lib/catalog";

export interface PreviewOptions {
  app: Application;
  palette: string[];
  width: number;
  height: number;
  /** 0 pequeno, 1 médio, 2 grande */
  motifScale?: number | undefined;
  /** 0 arejado, 1 equilibrado, 2 cheio */
  density?: number | undefined;
  /** Mostrar a área calma dos painéis (centro do prato). */
  showQuietArea?: boolean | undefined;
}

interface Tones {
  deep: string;
  mid: string;
  light: string;
  leaf: string;
  gold: string;
}

function tones(palette: string[]): Tones {
  return {
    deep: palette[0] ?? "#632B4A",
    mid: palette[1] ?? "#BB577D",
    light: palette[2] ?? "#FFF8EF",
    leaf: palette[3] ?? "#3B594A",
    gold: palette[4] ?? "#C29957",
  };
}

/** Proporção largura / altura da prévia. */
export function previewAspect(app: Application): number {
  if (app.family === "corrida") return 1;
  return app.fabricWidthCm / app.cutLengthCm;
}

function blossom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.62, r * 0.34, r * 0.62, (i * Math.PI * 2) / 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate((Math.PI * 2) / 5);
  }
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Motivos soltos dentro de um retângulo, com semente estável. */
function scatter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: Tones,
  count: number,
  radius: number,
  seed = 1,
) {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const colors = [t.mid, t.deep, t.gold, t.leaf];
  for (let i = 0; i < count; i++) {
    const cx = x + rnd() * w;
    const cy = y + rnd() * h;
    const r = radius * (0.6 + rnd() * 0.7);
    if (i % 3 === 2) leaf(ctx, cx, cy, r, t.leaf, rnd() * Math.PI);
    else blossom(ctx, cx, cy, r, colors[i % colors.length]!);
  }
}

function drawCorrida(ctx: CanvasRenderingContext2D, o: PreviewOptions, t: Tones) {
  const { width: W, height: H } = o;
  const app = o.app;
  if (app.family !== "corrida") return;
  const layout = app.params.layout;
  ctx.fillStyle = t.light;
  ctx.fillRect(0, 0, W, H);

  const cell = W / 3;
  const lv = (v: number | undefined) => Math.min(4, Math.max(0, Math.round(v ?? 0) + 2));
  const scale = [0.55, 0.72, 1, 1.35, 1.8][lv(o.motifScale)] ?? 1;
  const dens = [2, 3, 5, 8, 11][lv(o.density)] ?? 5;

  if (layout === "stripe") {
    const step = W / 9;
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = i % 3 === 0 ? 0.7 : 0.32;
      ctx.fillStyle = i % 2 === 0 ? t.mid : t.leaf;
      ctx.fillRect(i * step, 0, step * (i % 3 === 0 ? 0.5 : 0.22), H);
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (layout === "plaid") {
    const step = W / 6;
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? t.mid : t.leaf;
      ctx.fillRect(i * step, 0, step * 0.45, H);
      ctx.fillRect(0, i * step, W, step * 0.45);
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (layout === "dots") {
    const step = W / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = (r + c) % 2 === 0 ? t.mid : t.deep;
        ctx.beginPath();
        ctx.arc(c * step + step / 2 + (r % 2 ? step / 2 : 0), r * step + step / 2, step * 0.14 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (layout === "texture") {
    for (let i = 0; i < 160; i++) {
      const s = (i * 97) % 211;
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = i % 2 ? t.mid : t.gold;
      ctx.beginPath();
      ctx.ellipse(((s * 13) % W), ((s * 29) % H), W * 0.02, W * 0.009, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  // tossed / half-drop / brick / grid
  for (let row = -1; row < 4; row++) {
    for (let col = -1; col < 4; col++) {
      let ox = col * cell;
      let oy = row * cell;
      if (layout === "half-drop" && ((col % 2) + 2) % 2 === 1) oy += cell / 2;
      if (layout === "brick" && ((row % 2) + 2) % 2 === 1) ox += cell / 2;
      if (layout === "grid") {
        blossom(ctx, ox + cell / 2, oy + cell / 2, cell * 0.18 * scale, t.mid);
      } else {
        scatter(ctx, ox, oy, cell, cell, t, dens, cell * 0.16 * scale, 7);
      }
    }
  }

  // linhas de rapport discretas
  ctx.strokeStyle = "rgba(45,29,20,0.14)";
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, H);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(W, i * cell);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawCutBase(ctx: CanvasRenderingContext2D, W: number, H: number, t: Tones) {
  ctx.fillStyle = t.light;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(45,29,20,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

function drawBarrado(ctx: CanvasRenderingContext2D, o: PreviewOptions, t: Tones) {
  const app = o.app;
  if (app.family !== "barrado") return;
  const { width: W, height: H } = o;
  drawCutBase(ctx, W, H, t);
  const { bands, bandHeightCm, borderPosition } = app.params;
  const px = H / app.cutLengthCm;
  const bandH = bandHeightCm * px;

  for (let i = 0; i < bands; i++) {
    const top = H - (i + 1) * bandH;
    ctx.strokeStyle = "rgba(45,29,20,0.16)";
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(W, top);
    ctx.stroke();
    ctx.setLineDash([]);

    const stripH = Math.min(bandH * 0.42, H * 0.3);
    const drawStrip = (y: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, W, stripH);
      ctx.clip();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = t.mid;
      ctx.fillRect(0, y, W, stripH);
      ctx.globalAlpha = 1;
      scatter(ctx, 0, y, W, stripH, t, Math.round(W / 34), stripH * 0.3, i + 3);
      ctx.restore();
    };
    drawStrip(top + bandH - stripH);
    if (borderPosition === "both") drawStrip(top);
  }
}

function drawPainel(ctx: CanvasRenderingContext2D, o: PreviewOptions, t: Tones) {
  const app = o.app;
  if (app.family !== "painel") return;
  const { width: W, height: H } = o;
  drawCutBase(ctx, W, H, t);
  const f = app.params.frames;
  const px = W / app.fabricWidthCm;
  const margin = f.marginCm * px;
  const cell = W / f.count;
  // encolhe os quadros quando as margens não cabem no corte
  const shrink = Math.min(1, (cell - margin * 2) / (f.widthCm * px));
  const fw = f.widthCm * px * shrink;
  const fh = Math.min(f.heightCm * px * shrink, H - margin * 2);
  const y = (H - fh) / 2;

  for (let i = 0; i < f.count; i++) {
    const x = i * cell + (cell - fw) / 2;
    ctx.save();
    ctx.beginPath();
    if (f.shape === "circle") ctx.arc(x + fw / 2, y + fh / 2, Math.min(fw, fh) / 2, 0, Math.PI * 2);
    else ctx.rect(x, y, fw, fh);
    ctx.clip();

    ctx.fillStyle = f.backgroundStyle === "coordinate" ? t.light : "#ffffff";
    ctx.fillRect(x, y, fw, fh);
    if (f.backgroundStyle === "coordinate") {
      ctx.globalAlpha = 0.25;
      scatter(ctx, x, y, fw, fh, t, 10, fw * 0.07, i + 5);
      ctx.globalAlpha = 1;
    }
    // moldura decorada
    const inset = Math.max(fw * 0.07, 4);
    ctx.globalAlpha = 0.9;
    scatter(ctx, x, y, fw, inset, t, 5, inset * 0.42, i + 11);
    scatter(ctx, x, y + fh - inset, fw, inset, t, 5, inset * 0.42, i + 13);
    scatter(ctx, x, y + inset, inset, fh - inset * 2, t, 4, inset * 0.42, i + 17);
    scatter(ctx, x + fw - inset, y + inset, inset, fh - inset * 2, t, 4, inset * 0.42, i + 19);
    ctx.globalAlpha = 1;
    ctx.restore();

    // contorno do quadro
    ctx.strokeStyle = "rgba(45,29,20,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (f.shape === "circle") ctx.arc(x + fw / 2, y + fh / 2, Math.min(fw, fh) / 2, 0, Math.PI * 2);
    else ctx.rect(x, y, fw, fh);
    ctx.stroke();

    // área calma
    if (f.quietArea && o.showQuietArea !== false) {
      const qw = f.quietArea.widthCm * px * shrink;
      const qh = f.quietArea.heightCm * px * shrink;
      ctx.strokeStyle = "rgba(111,27,44,0.5)";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (f.quietArea.shape === "circle") {
        ctx.arc(x + fw / 2, y + fh / 2, Math.min(qw, qh) / 2, 0, Math.PI * 2);
      } else {
        ctx.rect(x + (fw - qw) / 2, y + (fh - qh) / 2, qw, qh);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

export function drawLayoutPreview(ctx: CanvasRenderingContext2D, o: PreviewOptions) {
  const t = tones(o.palette);
  ctx.clearRect(0, 0, o.width, o.height);
  if (o.app.family === "corrida") drawCorrida(ctx, o, t);
  else if (o.app.family === "barrado") drawBarrado(ctx, o, t);
  else drawPainel(ctx, o, t);
}
