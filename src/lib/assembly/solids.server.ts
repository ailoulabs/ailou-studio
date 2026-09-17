/**
 * Coordenados chapados desenhados por código: poá, vichy e listrado.
 *
 * O Gemini quebrava o poá (reticulado irregular) e recusava o pedido por
 * "recitation". Geometria simples não precisa de pintor: sai perfeita,
 * instantânea e emendando certinho, com as cores da paleta da coleção.
 */

import { encode } from "fast-png";

export interface SolidSpec {
  layout: "dots" | "plaid" | "stripe";
  rapportCm: number;
  /** Poá: diâmetro e distância ao vizinho mais próximo, em mm. */
  dotMm?: number;
  nnMm?: number;
  /** Vichy: lado do quadrado, em mm; enviesado gira 45 graus. */
  squareMm?: number;
  bias?: boolean;
  /** Listra: largura da listra e distância entre centros, em mm. */
  stripeMm?: number;
  spacingMm?: number;
}

type Rgb = [number, number, number];

function hexToRgb(hex: string, fallback: Rgb): Rgb {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Quantos períodos inteiros cabem no tile: é isso que faz a emenda fechar. */
function periods(tileMm: number, stepMm: number): number {
  return Math.max(1, Math.round(tileMm / Math.max(0.5, stepMm)));
}

function paint(
  size: number,
  shade: (x: number, y: number) => number,
  ground: Rgb,
  mark: Rgb,
): Uint8Array {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = Math.min(1, Math.max(0, shade(x + 0.5, y + 0.5)));
      const c = mix(ground, mark, t);
      const o = (y * size + x) * 4;
      rgba[o] = Math.round(c[0]);
      rgba[o + 1] = Math.round(c[1]);
      rgba[o + 2] = Math.round(c[2]);
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

/** Cobertura suave na borda de 1 px, para a bolinha não sair serrilhada. */
function edge(distance: number, radius: number): number {
  return Math.min(1, Math.max(0, radius + 0.5 - distance));
}

function dots(size: number, spec: SolidSpec): (x: number, y: number) => number {
  const tileMm = spec.rapportCm * 10;
  const nn = spec.nnMm ?? 9;
  // Reticulado em losango: colunas a nn*raiz(2), fileiras a metade, alternadas.
  const columns = periods(tileMm, nn * Math.SQRT2);
  const p = size / columns;
  const radius = ((spec.dotMm ?? 2) / tileMm) * size * 0.5;
  return (x, y) => {
    const row = Math.floor(y / (p / 2));
    let best = Infinity;
    for (let r = row - 1; r <= row + 1; r += 1) {
      const off = ((r % 2) + 2) % 2 === 0 ? 0 : p / 2;
      const cy = r * (p / 2) + p / 4;
      const col = Math.round((x - off - p / 2) / p);
      for (let c = col - 1; c <= col + 1; c += 1) {
        const cx = c * p + off + p / 2;
        const d = Math.hypot(x - cx, y - cy);
        if (d < best) best = d;
      }
    }
    return edge(best, radius);
  };
}

function plaid(size: number, spec: SolidSpec): (x: number, y: number) => number {
  const tileMm = spec.rapportCm * 10;
  const cellMm = spec.squareMm ?? 8;
  if (spec.bias) {
    // Enviesado: as faixas correm nas diagonais. Período em (x+y) e (x-y).
    const n = periods(tileMm, cellMm * 2 * Math.SQRT2);
    const p = size / n;
    return (x, y) => {
      const a = ((Math.floor((x + y) / p) % 2) + 2) % 2 === 0 ? 1 : 0;
      const b = ((Math.floor((x - y) / p) % 2) + 2) % 2 === 0 ? 1 : 0;
      return (a + b) * 0.5;
    };
  }
  const n = periods(tileMm, cellMm * 2);
  const p = size / n;
  return (x, y) => {
    const a = Math.floor((x / p) * 2) % 2 === 0 ? 1 : 0;
    const b = Math.floor((y / p) * 2) % 2 === 0 ? 1 : 0;
    return (a + b) * 0.5;
  };
}

function stripe(size: number, spec: SolidSpec): (x: number) => number {
  const tileMm = spec.rapportCm * 10;
  const n = periods(tileMm, spec.spacingMm ?? 10);
  const p = size / n;
  const w = ((spec.stripeMm ?? 2.5) / tileMm) * size;
  return (x) => {
    const local = x - Math.floor(x / p) * p;
    const d = Math.abs(local - p / 2);
    return edge(d, w / 2);
  };
}

/** Desenha o tile e devolve o PNG. */
export function drawSolidTile(input: {
  spec: SolidSpec;
  size?: number;
  groundHex: string;
  markHex: string;
}): Uint8Array {
  const size = input.size ?? 1536;
  const ground = hexToRgb(input.groundHex, [246, 240, 230]);
  const mark = hexToRgb(input.markHex, [138, 90, 68]);
  const shade =
    input.spec.layout === "dots"
      ? dots(size, input.spec)
      : input.spec.layout === "plaid"
        ? plaid(size, input.spec)
        : stripe(size, input.spec);
  const rgba = paint(size, shade, ground, mark);
  return encode({ width: size, height: size, data: rgba, channels: 4, depth: 8 });
}

/** Lê os parâmetros do catálogo. */
export function solidSpecOf(params: Record<string, unknown>): SolidSpec | null {
  const layout = String(params["layout"] ?? "");
  if (layout !== "dots" && layout !== "plaid" && layout !== "stripe") return null;
  const num = (k: string): number | undefined =>
    typeof params[k] === "number" ? (params[k] as number) : undefined;
  const spec: SolidSpec = { layout, rapportCm: num("rapportCm") ?? 10 };
  const dotMm = num("dotMm");
  const nnMm = num("nnMm") ?? (layout === "dots" ? num("spacingMm") : undefined);
  const squareMm = num("squareMm");
  const stripeMm = num("stripeMm");
  const spacingMm = num("spacingMm");
  if (dotMm !== undefined) spec.dotMm = dotMm;
  if (nnMm !== undefined) spec.nnMm = nnMm;
  if (squareMm !== undefined) spec.squareMm = squareMm;
  if (params["bias"] === true) spec.bias = true;
  if (stripeMm !== undefined) spec.stripeMm = stripeMm;
  if (spacingMm !== undefined) spec.spacingMm = spacingMm;
  return spec;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex, [128, 128, 128]);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Fundo e marca a partir da paleta da coleção (fundo, principal, segunda,
 * acento 1, acento 2). Se a segunda cor não contrasta com o fundo, a marca
 * passa a ser a cor mais distante do fundo em luminância.
 */
export function solidColorsOf(palette: string[]): { ground: string; mark: string } {
  const valid = palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  const ground = valid[0] ?? "#F6F0E6";
  const candidates = valid.slice(1);
  const preferred = candidates[0];
  const far = [...candidates].sort(
    (a, b) =>
      Math.abs(luminance(b) - luminance(ground)) - Math.abs(luminance(a) - luminance(ground)),
  )[0];
  const mark =
    preferred && Math.abs(luminance(preferred) - luminance(ground)) >= 60
      ? preferred
      : (far ?? "#8A5A44");
  return { ground, mark };
}
