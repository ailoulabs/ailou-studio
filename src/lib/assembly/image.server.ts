/**
 * Trabalho de imagem no servidor, em JavaScript puro.
 * Porta para o servidor o que antes rodava no canvas do navegador:
 * teste de emenda, conferência de composição e preparo do conserto de emenda.
 */

import { decode, encode } from "fast-png";

export interface Raster {
  width: number;
  height: number;
  /** RGBA de 8 bits, 4 bytes por pixel. */
  rgba: Uint8Array;
}

/** Lê um PNG e devolve sempre RGBA de 8 bits. */
export function decodePng(bytes: Uint8Array): Raster {
  const img = decode(bytes);
  const { width, height, channels, depth } = img;
  const src = img.data as ArrayLike<number>;
  const shift = depth === 16 ? 8 : 0;
  const palette = img.palette as number[][] | undefined;
  const rgba = new Uint8Array(width * height * 4);

  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    if (palette && channels === 1) {
      const entry = palette[src[i] ?? 0] ?? [0, 0, 0];
      rgba[o] = entry[0] ?? 0;
      rgba[o + 1] = entry[1] ?? 0;
      rgba[o + 2] = entry[2] ?? 0;
      rgba[o + 3] = 255;
      continue;
    }
    if (channels === 1 || channels === 2) {
      const v = (src[i * channels] ?? 0) >> shift;
      rgba[o] = v;
      rgba[o + 1] = v;
      rgba[o + 2] = v;
      rgba[o + 3] = channels === 2 ? ((src[i * 2 + 1] ?? 255) >> shift) : 255;
      continue;
    }
    const p = i * channels;
    rgba[o] = (src[p] ?? 0) >> shift;
    rgba[o + 1] = (src[p + 1] ?? 0) >> shift;
    rgba[o + 2] = (src[p + 2] ?? 0) >> shift;
    rgba[o + 3] = channels === 4 ? ((src[p + 3] ?? 255) >> shift) : 255;
  }

  return { width, height, rgba };
}

export function encodePng(raster: Raster): Uint8Array {
  return encode({
    width: raster.width,
    height: raster.height,
    data: raster.rgba,
    channels: 4,
    depth: 8,
  });
}

/** Reamostragem por vizinho mais próximo, suficiente para as medições. */
export function resample(src: Raster, width: number, height: number): Raster {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / width));
      const s = (sy * src.width + sx) * 4;
      const d = (y * width + x) * 4;
      rgba[d] = src.rgba[s] ?? 0;
      rgba[d + 1] = src.rgba[s + 1] ?? 0;
      rgba[d + 2] = src.rgba[s + 2] ?? 0;
      rgba[d + 3] = src.rgba[s + 3] ?? 255;
    }
  }
  return { width, height, rgba };
}

// ------------------------------------------------------------------
// Emenda: a última coluna precisa encostar na primeira sem degrau
// ------------------------------------------------------------------

export interface SeamResult {
  ok: boolean;
  score: number;
}

/** Eixos testados por família: corrida testa os dois, barrado só a largura. */
export type SeamAxis = "both" | "x" | "none";

export function seamAxisForFamily(family: string): SeamAxis {
  if (family === "painel") return "none";
  if (family === "barrado") return "x";
  return "both";
}

const THRESHOLD = 4;
const SEAM_SCALES = [256, 512];

function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 4) {
    sum +=
      Math.abs((a[i] ?? 0) - (b[i] ?? 0)) +
      Math.abs((a[i + 1] ?? 0) - (b[i + 1] ?? 0)) +
      Math.abs((a[i + 2] ?? 0) - (b[i + 2] ?? 0));
  }
  return sum / (n / 4) / 3;
}

function column(r: Raster, x: number): Uint8Array {
  const out = new Uint8Array(r.height * 4);
  for (let y = 0; y < r.height; y += 1) {
    const src = (y * r.width + x) * 4;
    out.set(r.rgba.subarray(src, src + 4), y * 4);
  }
  return out;
}

function row(r: Raster, y: number): Uint8Array {
  const start = y * r.width * 4;
  return r.rgba.slice(start, start + r.width * 4);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return (((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

/**
 * Razão de um eixo: o degrau da volta (última linha contra a primeira)
 * dividido pela variação típica entre linhas vizinhas do interior.
 */
function axisRatio(
  get: (i: number) => Uint8Array,
  total: number,
  samples: number,
): number {
  const wrap = meanAbsDiff(get(total - 1), get(0));
  const inner: number[] = [];
  const count = Math.min(samples, total - 2);
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(((total - 2) * i) / Math.max(1, count - 1));
    inner.push(meanAbsDiff(get(idx), get(idx + 1)));
  }
  return wrap / Math.max(median(inner), 0.5);
}

function ratiosAt(image: Raster, axis: SeamAxis): number {
  let worst = 0;
  if (axis !== "none") {
    worst = Math.max(worst, axisRatio((i) => column(image, i), image.width, 48));
  }
  if (axis === "both") {
    worst = Math.max(worst, axisRatio((i) => row(image, i), image.height, 48));
  }
  return worst;
}

export function checkSeam(image: Raster, axis: SeamAxis = "both"): SeamResult {
  if (axis === "none") return { ok: true, score: 0 };
  if (image.width < 16 || image.height < 16) return { ok: false, score: 0 };
  const worst = ratiosAt(image, axis);
  return { ok: worst <= THRESHOLD, score: Number(worst.toFixed(2)) };
}

/** Mede em duas resoluções e fica com o pior resultado. */
export function checkSeamFromPng(bytes: Uint8Array, axis: SeamAxis = "both"): SeamResult {
  if (axis === "none") return { ok: true, score: 0 };
  const src = decodePng(bytes);
  let worst = 0;
  for (const size of SEAM_SCALES) {
    if (src.width < size / 2 || src.height < size / 2) continue;
    worst = Math.max(worst, ratiosAt(resample(src, size, size), axis));
  }
  if (worst === 0) worst = ratiosAt(resample(src, 256, 256), axis);
  return { ok: worst <= THRESHOLD, score: Number(worst.toFixed(2)) };
}


// ------------------------------------------------------------------
// Composição das peças posicionadas
// ------------------------------------------------------------------

export interface CompositionResult {
  ok: boolean;
  cornerShare?: number;
  topEdgeShare?: number;
  quietInk?: number;
  bandsFound?: number;
  crossShare?: number;
  reason?: string;
}


export interface FrameSpec {
  widthCm: number;
  heightCm: number;
  accent?: string;
  quietArea?: { widthCm: number; heightCm: number };
}

const COMP_SIZE = 256;

function backgroundColor(r: Raster): [number, number, number] {
  const samples: [number, number, number][] = [];
  const push = (x: number, y: number) => {
    const i = (y * r.width + x) * 4;
    samples.push([r.rgba[i] ?? 0, r.rgba[i + 1] ?? 0, r.rgba[i + 2] ?? 0]);
  };
  for (let i = 0; i < r.width; i += 4) {
    push(i, 1);
    push(i, r.height - 2);
    push(1, Math.min(i, r.height - 1));
    push(r.width - 2, Math.min(i, r.height - 1));
  }
  const median = (idx: 0 | 1 | 2) => {
    const values = samples.map((s) => s[idx]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] ?? 255;
  };
  return [median(0), median(1), median(2)];
}

interface InkMap {
  mask: Uint8Array;
  total: number;
}

function inkMap(r: Raster): InkMap {
  const [br, bg, bb] = backgroundColor(r);
  const mask = new Uint8Array(r.width * r.height);
  let total = 0;
  for (let i = 0; i < mask.length; i += 1) {
    const p = i * 4;
    const d =
      Math.abs((r.rgba[p] ?? 0) - br) +
      Math.abs((r.rgba[p + 1] ?? 0) - bg) +
      Math.abs((r.rgba[p + 2] ?? 0) - bb);
    if (d > 60) {
      mask[i] = 1;
      total += 1;
    }
  }
  return { mask, total };
}

function countIn(map: InkMap, x0: number, y0: number, x1: number, y1: number): number {
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) count += map.mask[y * COMP_SIZE + x] ?? 0;
  }
  return count;
}

export interface BandSpec {
  /** Alturas em cm, de cima para baixo, incluindo margens e barrinhas. */
  slots: { kind: "margem" | "faixa" | "barrinha"; heightCm: number }[];
  cutCm: number;
}

/**
 * Confere o barrado múltiplo: número de faixas pelo perfil de linhas
 * e motivos atravessando as bordas das faixas.
 */
export function checkBands(bytes: Uint8Array, spec: BandSpec): CompositionResult {
  const r = resample(decodePng(bytes), COMP_SIZE, COMP_SIZE);
  const map = inkMap(r);
  if (map.total === 0) return { ok: false, reason: "A arte saiu vazia." };

  // Perfil de mudança entre linhas vizinhas.
  const diff = new Float64Array(COMP_SIZE);
  for (let y = 1; y < COMP_SIZE; y += 1) {
    let sum = 0;
    for (let x = 0; x < COMP_SIZE; x += 1) {
      const a = (y * COMP_SIZE + x) * 4;
      const b = ((y - 1) * COMP_SIZE + x) * 4;
      sum +=
        Math.abs((r.rgba[a] ?? 0) - (r.rgba[b] ?? 0)) +
        Math.abs((r.rgba[a + 1] ?? 0) - (r.rgba[b + 1] ?? 0)) +
        Math.abs((r.rgba[a + 2] ?? 0) - (r.rgba[b + 2] ?? 0));
    }
    diff[y] = sum / COMP_SIZE;
  }
  const sorted = Array.from(diff).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const peak = sorted[sorted.length - 1] ?? 0;
  const threshold = Math.max(median * 3, peak * 0.35, 8);

  // Picos separados por pelo menos 4 linhas viram bordas de faixa.
  const edges: number[] = [];
  for (let y = 2; y < COMP_SIZE - 1; y += 1) {
    const v = diff[y] ?? 0;
    if (v < threshold) continue;
    if (v < (diff[y - 1] ?? 0) || v < (diff[y + 1] ?? 0)) continue;
    if (edges.length > 0 && y - (edges[edges.length - 1] ?? 0) < 4) continue;
    edges.push(y);
  }

  const expected = spec.slots.filter((s) => s.kind === "faixa").length;
  // Cada barrinha marca duas bordas; margens marcam uma cada.
  const bandsFound = Math.max(1, Math.round((edges.length + 1) / 2));

  // Motivos atravessando as bordas previstas das faixas.
  let worstCross = 0;
  let acc = 0;
  for (const slot of spec.slots) {
    acc += slot.heightCm;
    const y = Math.round((acc / spec.cutCm) * COMP_SIZE);
    if (y <= 1 || y >= COMP_SIZE - 1) continue;
    let crossing = 0;
    for (let x = 0; x < COMP_SIZE; x += 1) {
      const above = map.mask[(y - 2) * COMP_SIZE + x] ?? 0;
      const below = map.mask[(y + 1) * COMP_SIZE + x] ?? 0;
      if (above === 1 && below === 1) crossing += 1;
    }
    worstCross = Math.max(worstCross, crossing / COMP_SIZE);
  }

  const countOk = Math.abs(bandsFound - expected) <= 1;
  const crossOk = worstCross <= 0.05;
  const reason = !countOk
    ? "O número de faixas ficou diferente do combinado."
    : "Tem desenho atravessando a borda das faixas.";
  return {
    ok: countOk && crossOk,
    bandsFound,
    crossShare: Number(worstCross.toFixed(3)),
    ...(countOk && crossOk ? {} : { reason }),
  };
}

export function checkComposition(bytes: Uint8Array, frame: FrameSpec): CompositionResult {

  const r = resample(decodePng(bytes), COMP_SIZE, COMP_SIZE);
  const map = inkMap(r);
  if (map.total === 0) return { ok: true };

  if (frame.accent === "corner") {
    const half = COMP_SIZE / 2;
    const cornerShare = countIn(map, half, half, COMP_SIZE, COMP_SIZE) / map.total;
    const topEdgeShare =
      countIn(map, 0, 0, COMP_SIZE, Math.round(COMP_SIZE * 0.15)) / map.total;
    const ok = cornerShare >= 0.7 && topEdgeShare < 0.03;
    return {
      ok,
      cornerShare: Number(cornerShare.toFixed(3)),
      topEdgeShare: Number(topEdgeShare.toFixed(3)),
      ...(ok ? {} : { reason: "O acento não ficou sozinho no canto." }),
    };
  }

  if (frame.quietArea) {
    const qw = (frame.quietArea.widthCm / frame.widthCm) * COMP_SIZE;
    const qh = (frame.quietArea.heightCm / frame.heightCm) * COMP_SIZE;
    const x0 = Math.round((COMP_SIZE - qw) / 2);
    const y0 = Math.round((COMP_SIZE - qh) / 2);
    const x1 = Math.round(x0 + qw);
    const y1 = Math.round(y0 + qh);
    const area = Math.max(1, (x1 - x0) * (y1 - y0));
    const quietInk = countIn(map, x0, y0, x1, y1) / area;
    const ok = quietInk <= 0.03;
    return {
      ok,
      quietInk: Number(quietInk.toFixed(3)),
      ...(ok ? {} : { reason: "O centro do prato ficou com desenho demais." }),
    };
  }

  return { ok: true };
}

// ------------------------------------------------------------------
// Conserto de emenda: deslocamento em meio quadro e máscara em cruz.
// A arte original é preservada pixel a pixel fora da cruz central.
// ------------------------------------------------------------------

/** Tamanho enviado à API de edição. A arte original continua no tamanho dela. */
const FIX_API_MIN = 1024;
const FIX_API_MAX = 1536;
/** Largura da cruz repintada, em fração do lado. */
const CROSS_BAND = 0.12;

/** Desloca meia largura e meia altura, em wrap-around, mantendo as dimensões. */
export function shiftWrap(src: Raster): Raster {
  const { width: w, height: h } = src;
  const out = new Uint8Array(w * h * 4);
  const hx = Math.floor(w / 2);
  const hy = Math.floor(h / 2);
  for (let y = 0; y < h; y += 1) {
    const sy = (y + hy) % h;
    for (let x = 0; x < w; x += 1) {
      const sx = (x + hx) % w;
      const s = (sy * w + sx) * 4;
      const d = (y * w + x) * 4;
      out[d] = src.rgba[s] ?? 0;
      out[d + 1] = src.rgba[s + 1] ?? 0;
      out[d + 2] = src.rgba[s + 2] ?? 0;
      out[d + 3] = src.rgba[s + 3] ?? 255;
    }
  }
  return { width: w, height: h, rgba: out };
}

/** Desloca e reamostra para um quadrado, usado só no envio à API. */
export function shiftRaster(src: Raster, size: number): Raster {
  return shiftWrap(resample(src, size, size));
}

export interface SeamFixInput {
  image: Uint8Array;
  mask: Uint8Array;
  size: number;
}

function crossBounds(size: number): { from: number; to: number } {
  const band = Math.max(8, Math.round(size * CROSS_BAND));
  const from = Math.round((size - band) / 2);
  return { from, to: from + band };
}

/** Imagem deslocada e máscara em cruz prontas para a edição. */
export function prepareSeamFix(bytes: Uint8Array): SeamFixInput {
  const src = decodePng(bytes);
  const size = Math.min(FIX_API_MAX, Math.max(FIX_API_MIN, Math.min(src.width, src.height)));
  const shifted = shiftRaster(src, size);

  // Máscara: branca opaca no geral, transparente na cruz central (a área a repintar).
  const mask = new Uint8Array(size * size * 4);
  const { from, to } = crossBounds(size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = (y * size + x) * 4;
      const inCross = (x >= from && x < to) || (y >= from && y < to);
      mask[d] = 255;
      mask[d + 1] = 255;
      mask[d + 2] = 255;
      mask[d + 3] = inCross ? 0 : 255;
    }
  }

  return {
    image: encodePng(shifted),
    mask: encodePng({ width: size, height: size, rgba: mask }),
    size,
  };
}

/**
 * Junta o retorno da API com a arte original, no tamanho original.
 * Só a cruz central deslocada vem da API; todo o resto é o original intacto.
 */
export function mergeSeamFix(originalBytes: Uint8Array, fixedBytes: Uint8Array): Uint8Array {
  const original = decodePng(originalBytes);
  const w = original.width;
  const h = original.height;
  const shifted = shiftWrap(original);
  const painted = resample(decodePng(fixedBytes), w, h);

  const bandX = Math.max(8, Math.round(w * CROSS_BAND));
  const bandY = Math.max(8, Math.round(h * CROSS_BAND));
  const fromX = Math.round((w - bandX) / 2);
  const toX = fromX + bandX;
  const fromY = Math.round((h - bandY) / 2);
  const toY = fromY + bandY;
  // Borda suave para o remendo não deixar degrau visível.
  const feather = Math.max(2, Math.round(Math.min(bandX, bandY) * 0.15));

  const weight = (v: number, from: number, to: number): number => {
    if (v < from || v >= to) return 0;
    const d = Math.min(v - from, to - 1 - v);
    return Math.min(1, (d + 1) / feather);
  };

  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const wy = weight(y, fromY, toY);
    for (let x = 0; x < w; x += 1) {
      const a = Math.max(weight(x, fromX, toX), wy);
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const base = shifted.rgba[i + c] ?? 0;
        const top = painted.rgba[i + c] ?? 0;
        out[i + c] = Math.round(base + (top - base) * a);
      }
    }
  }

  // Desfaz o deslocamento e volta ao enquadramento original.
  return encodePng(shiftWrap({ width: w, height: h, rgba: out }));
}


/**
 * Apaga áreas da prancha, para tirar de vista os motivos que a artesã excluiu.
 * As regiões vêm em fração de 0 a 1, então valem para qualquer tamanho de prancha.
 */
export function eraseRegions(
  bytes: Uint8Array,
  regions: { x: number; y: number; w: number; h: number }[],
): Uint8Array {
  const img = decodePng(bytes);
  let opaque = 0;
  for (let i = 3; i < img.rgba.length; i += 4) if (img.rgba[i]! > 200) opaque += 1;
  const solid = opaque > img.width * img.height * 0.9;
  const fill = solid ? backgroundColor(img) : [0, 0, 0];
  const alpha = solid ? 255 : 0;

  for (const r of regions) {
    const x0 = Math.max(0, Math.floor(r.x * img.width));
    const y0 = Math.max(0, Math.floor(r.y * img.height));
    const x1 = Math.min(img.width, Math.ceil((r.x + r.w) * img.width));
    const y1 = Math.min(img.height, Math.ceil((r.y + r.h) * img.height));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const o = (y * img.width + x) * 4;
        img.rgba[o] = fill[0] ?? 0;
        img.rgba[o + 1] = fill[1] ?? 0;
        img.rgba[o + 2] = fill[2] ?? 0;
        img.rgba[o + 3] = alpha;
      }
    }
  }
  return encodePng(img);
}
