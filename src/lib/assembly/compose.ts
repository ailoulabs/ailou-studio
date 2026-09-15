/**
 * Montagem do corte real a partir da imagem gerada pela IA.
 * Corrida: ladrilha o rapport no corte inteiro.
 * Barrado: repete o módulo quadrado ao longo da largura.
 * Painel: posiciona os quadros com as margens do catálogo.
 */

import { loadImage } from "@/lib/assembly/seam";
import { bandPlan, fmt, type Application } from "@/lib/catalog";

const MAX_WIDTH = 2400;

export interface ComposedCut {
  canvas: HTMLCanvasElement;
  pxPerCm: number;
  widthCm: number;
  heightCm: number;
}

export async function composeCut(imageUrl: string, app: Application): Promise<ComposedCut> {
  const widthCm = app.fabricWidthCm;
  const heightCm = app.cutLengthCm;
  const pxPerCm = Math.min(MAX_WIDTH / widthCm, 24);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthCm * pxPerCm);
  canvas.height = Math.round(heightCm * pxPerCm);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível montar o corte.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = await loadImage(imageUrl);

  if (app.family === "corrida") {
    const tile = Math.max(8, app.params.rapportCm * pxPerCm);
    for (let y = 0; y < canvas.height; y += tile) {
      for (let x = 0; x < canvas.width; x += tile) {
        ctx.drawImage(img, x, y, tile, tile);
      }
    }
  } else if (app.family === "barrado") {
    const tile = heightCm * pxPerCm;
    for (let x = 0; x < canvas.width; x += tile) {
      ctx.drawImage(img, x, 0, tile, tile);
    }
  } else {
    const f = app.params.frames;
    const cell = canvas.width / f.count;
    // A margem entra no corte, não na arte: o quadro sai no tamanho cheio.
    const fw = f.widthCm * pxPerCm;
    const fh = f.heightCm * pxPerCm;
    const y = (canvas.height - fh) / 2;

    for (let i = 0; i < f.count; i += 1) {
      const x = i * cell + (cell - fw) / 2;
      ctx.save();
      ctx.beginPath();
      if (f.shape === "circle") {
        ctx.arc(x + fw / 2, y + fh / 2, Math.min(fw, fh) / 2, 0, Math.PI * 2);
      } else {
        ctx.rect(x, y, fw, fh);
      }
      ctx.clip();
      if (f.renderLandscape) {
        // A arte foi pintada deitada: gira 90 graus para entrar no quadro em pé.
        ctx.translate(x + fw / 2, y + fh / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, -fh / 2, -fw / 2, fh, fw);
      } else {
        ctx.drawImage(img, x, y, fw, fh);
      }
      ctx.restore();

      ctx.strokeStyle = "rgba(45,29,20,0.25)";
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (f.shape === "circle") {
        ctx.arc(x + fw / 2, y + fh / 2, Math.min(fw, fh) / 2, 0, Math.PI * 2);
      } else {
        ctx.rect(x, y, fw, fh);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }


  return { canvas, pxPerCm, widthCm, heightCm };
}

/** Desenha a régua em cm sobre um canvas de exibição. */
/**
 * Marca onde recortar cada faixa do barrado múltiplo,
 * com linha tracejada e a altura em centímetros.
 */
export function drawBandGuides(
  ctx: CanvasRenderingContext2D,
  cut: ComposedCut,
  scale: number,
  app: Application,
  offsetY: number,
) {
  const slots = bandPlan(app);
  if (slots.length === 0) return;
  const px = cut.pxPerCm * scale;
  ctx.save();
  ctx.font = "11px system-ui, sans-serif";
  ctx.lineWidth = 1;
  let acc = 0;
  for (const slot of slots) {
    const top = offsetY + acc * px;
    acc += slot.heightCm;
    const bottom = offsetY + acc * px;
    ctx.strokeStyle = "rgba(45,29,20,0.45)";
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(bottom) + 0.5);
    ctx.lineTo(ctx.canvas.width, Math.round(bottom) + 0.5);
    ctx.stroke();
    if (slot.kind === "faixa") {
      const label = `${fmt(slot.heightCm)} cm`;
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(6, (top + bottom) / 2 - 9, ctx.measureText(label).width + 10, 16);
      ctx.fillStyle = "rgba(45,29,20,0.8)";
      ctx.fillText(label, 11, (top + bottom) / 2 + 3);
    }
  }
  ctx.restore();
}

export function drawRuler(ctx: CanvasRenderingContext2D, cut: ComposedCut, scale: number) {

  const step = 10;
  ctx.save();
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = "rgba(45,29,20,0.6)";
  ctx.strokeStyle = "rgba(45,29,20,0.35)";
  ctx.lineWidth = 1;
  for (let cm = 0; cm <= cut.widthCm; cm += step) {
    const x = Math.round(cm * cut.pxPerCm * scale) + 0.5;
    const big = cm % 50 === 0;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, big ? 10 : 5);
    ctx.stroke();
    if (big) ctx.fillText(`${cm} cm`, Math.min(x + 3, ctx.canvas.width - 34), 12);
  }
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar o arquivo."));
    }, "image/png");
  });
}
