/**
 * Extração dos motivos da prancha, feita no navegador.
 * Encontra os desenhos isolados por componentes conexos sobre o alfa
 * (ou sobre a distância da cor de fundo) e recorta cada um com transparência.
 */

export type MotifType = "grande" | "médio" | "pequeno" | "preenchimento";

export interface ExtractedMotif {
  index: number;
  canvas: HTMLCanvasElement;
  bbox: { x: number; y: number; w: number; h: number };
  /** Maior lado do motivo em relação à largura da prancha. */
  relSize: number;
  type: MotifType;
  /** Mesma caixa em fração de 0 a 1 da prancha. */
  bboxRel: { x: number; y: number; w: number; h: number };
}

export interface MotifRef {
  index: number;
  type: string;
  relSize: number;
  image: CanvasImageSource;
  width: number;
  height: number;
}

const MAX_SHEET = 1536;

export async function loadSheet(url: string): Promise<HTMLCanvasElement> {
  const res = await fetch(url);
  const bitmap = await createImageBitmap(await res.blob());
  const scale = Math.min(1, MAX_SHEET / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível ler a prancha de motivos.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

function medianCornerColor(data: Uint8ClampedArray, w: number, h: number) {
  const spots: number[] = [];
  const pick = (x: number, y: number) => ((y * w + x) << 2);
  const s = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      spots.push(pick(x, y), pick(w - 1 - x, y), pick(x, h - 1 - y), pick(w - 1 - x, h - 1 - y));
    }
  }
  let r = 0;
  let g = 0;
  let b = 0;
  for (const i of spots) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  const n = spots.length;
  return { r: r / n, g: g / n, b: b / n };
}

/** Dilata a máscara binária, para juntar flor e caule em um motivo só. */
function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  let src = mask;
  for (let pass = 0; pass < 2; pass += 1) {
    const out = new Uint8Array(w * h);
    const horizontal = pass === 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let on = 0;
        for (let d = -radius; d <= radius && !on; d += 1) {
          const nx = horizontal ? x + d : x;
          const ny = horizontal ? y : y + d;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (src[ny * w + nx]) on = 1;
        }
        out[y * w + x] = on;
      }
    }
    src = out;
  }
  return src;
}

/**
 * Recorta os motivos isolados da prancha.
 * Devolve no máximo `limit` motivos, dos maiores para os menores.
 */
export function extractMotifs(sheet: HTMLCanvasElement, limit = 12): ExtractedMotif[] {
  const w = sheet.width;
  const h = sheet.height;
  const ctx = sheet.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;

  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 200) opaque += 1;
  const useAlpha = opaque < w * h * 0.9;

  const bg = medianCornerColor(data, w, h);
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) {
    const i = p << 2;
    if (useAlpha) {
      mask[p] = data[i + 3]! > 40 ? 1 : 0;
    } else {
      const dr = data[i]! - bg.r;
      const dg = data[i + 1]! - bg.g;
      const db = data[i + 2]! - bg.b;
      mask[p] = Math.sqrt(dr * dr + dg * dg + db * db) > 38 ? 1 : 0;
    }
  }

  const radius = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  const grouped = dilate(mask, w, h, radius);

  const labels = new Int32Array(w * h).fill(-1);
  const boxes: { x0: number; y0: number; x1: number; y1: number; area: number }[] = [];
  const stack: number[] = [];

  for (let start = 0; start < w * h; start += 1) {
    if (!grouped[start] || labels[start] !== -1) continue;
    const id = boxes.length;
    const box = { x0: w, y0: h, x1: 0, y1: 0, area: 0 };
    boxes.push(box);
    labels[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      if (x < box.x0) box.x0 = x;
      if (y < box.y0) box.y0 = y;
      if (x > box.x1) box.x1 = x;
      if (y > box.y1) box.y1 = y;
      if (mask[p]) box.area += 1;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (grouped[q] && labels[q] === -1) {
            labels[q] = id;
            stack.push(q);
          }
        }
      }
    }
  }

  const minArea = w * h * 0.0006;
  const minSide = Math.min(w, h) * 0.03;
  const edge = 2;

  const kept = boxes
    .map((box, id) => ({ box, id }))
    .filter(({ box }) => {
      const bw = box.x1 - box.x0 + 1;
      const bh = box.y1 - box.y0 + 1;
      if (box.area < minArea) return false;
      if (bw < minSide || bh < minSide) return false;
      if (bw > w * 0.9 && bh > h * 0.9) return false;
      if (box.x0 <= edge || box.y0 <= edge || box.x1 >= w - 1 - edge || box.y1 >= h - 1 - edge) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.box.area - a.box.area)
    .slice(0, limit);

  return kept.map(({ box, id }, position) => {
    const pad = 2;
    const x0 = Math.max(0, box.x0 - pad);
    const y0 = Math.max(0, box.y0 - pad);
    const bw = Math.min(w - x0, box.x1 - box.x0 + 1 + pad * 2);
    const bh = Math.min(h - y0, box.y1 - box.y0 + 1 + pad * 2);

    const canvas = document.createElement("canvas");
    canvas.width = bw;
    canvas.height = bh;
    const out = canvas.getContext("2d")!;
    const crop = out.createImageData(bw, bh);
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        const src = (y0 + y) * w + (x0 + x);
        const di = (y * bw + x) << 2;
        const si = src << 2;
        const mine = labels[src] === id && mask[src] === 1;
        if (!mine) {
          crop.data[di + 3] = 0;
          continue;
        }
        crop.data[di] = data[si]!;
        crop.data[di + 1] = data[si + 1]!;
        crop.data[di + 2] = data[si + 2]!;
        crop.data[di + 3] = useAlpha ? data[si + 3]! : 255;
        rSum += data[si]!;
        gSum += data[si + 1]!;
        bSum += data[si + 2]!;
        count += 1;
      }
    }
    // Aperta a caixa ao desenho de verdade, para nenhum motivo sair maior do que é.
    let tx0 = bw;
    let ty0 = bh;
    let tx1 = -1;
    let ty1 = -1;
    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        if (crop.data[((y * bw + x) << 2) + 3]! === 0) continue;
        if (x < tx0) tx0 = x;
        if (y < ty0) ty0 = y;
        if (x > tx1) tx1 = x;
        if (y > ty1) ty1 = y;
      }
    }
    const tw = tx1 >= tx0 ? tx1 - tx0 + 1 : bw;
    const th = ty1 >= ty0 ? ty1 - ty0 + 1 : bh;
    if (tw !== bw || th !== bh) {
      const trimmed = out.createImageData(tw, th);
      for (let y = 0; y < th; y += 1) {
        for (let x = 0; x < tw; x += 1) {
          const si = (((y + ty0) * bw + (x + tx0)) << 2);
          const di = (y * tw + x) << 2;
          trimmed.data[di] = crop.data[si]!;
          trimmed.data[di + 1] = crop.data[si + 1]!;
          trimmed.data[di + 2] = crop.data[si + 2]!;
          trimmed.data[di + 3] = crop.data[si + 3]!;
        }
      }
      canvas.width = tw;
      canvas.height = th;
      out.putImageData(trimmed, 0, 0);
    } else {
      out.putImageData(crop, 0, 0);
    }

    const relSize = Math.max(canvas.width, canvas.height) / w;
    // Rótulo neutro por tamanho: o nome de verdade vem da conferência da prancha.
    let type: MotifType;
    if (relSize > 0.16) type = "grande";
    else if (relSize > 0.1) type = "médio";
    else if (relSize > 0.05) type = "pequeno";
    else type = "preenchimento";

    return {
      index: position,
      canvas,
      bbox: { x: x0 + (tw !== bw ? tx0 : 0), y: y0 + (th !== bh ? ty0 : 0), w: canvas.width, h: canvas.height },
      relSize,
      type,
      bboxRel: {
        x: (x0 + (tw !== bw ? tx0 : 0)) / w,
        y: (y0 + (th !== bh ? ty0 : 0)) / h,
        w: canvas.width / w,
        h: canvas.height / h,
      },
    };
  });
}

export function motifToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}
