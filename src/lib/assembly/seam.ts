/**
 * Teste de emenda por continuidade: a última coluna precisa encostar na primeira
 * como se a estampa continuasse, e o mesmo vale para a última e a primeira linha.
 * A diferença no encontro é comparada com a diferença média entre colunas e
 * linhas vizinhas dentro da imagem. Passa quando fica em até 4x.
 */

export interface SeamResult {
  ok: boolean;
  score: number;
}

const THRESHOLD = 4;
const MIN_SIZE = 16;

function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
  }
  return sum / (n / 4) / 3;
}

function column(data: ImageData, x: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.height * 4);
  for (let y = 0; y < data.height; y += 1) {
    const src = (y * data.width + x) * 4;
    out.set(data.data.subarray(src, src + 4), y * 4);
  }
  return out;
}

function row(data: ImageData, y: number): Uint8ClampedArray {
  const start = y * data.width * 4;
  return data.data.slice(start, start + data.width * 4);
}

/** Diferença média entre linhas ou colunas vizinhas dentro da imagem. */
function innerDiff(get: (i: number) => Uint8ClampedArray, total: number): number {
  const samples = Math.min(32, total - 2);
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const idx = 1 + Math.floor(((total - 3) * i) / Math.max(1, samples - 1));
    sum += meanAbsDiff(get(idx), get(idx + 1));
  }
  return sum / samples;
}

export function checkSeam(image: ImageData): SeamResult {
  const w = image.width;
  const h = image.height;
  if (w < MIN_SIZE || h < MIN_SIZE) return { ok: false, score: 0 };

  // No encontro, a última coluna vira vizinha da primeira.
  const edgeX = meanAbsDiff(column(image, w - 1), column(image, 0));
  const edgeY = meanAbsDiff(row(image, h - 1), row(image, 0));

  const innerX = innerDiff((i) => column(image, i), w);
  const innerY = innerDiff((i) => row(image, i), h);

  const ratioX = edgeX / Math.max(innerX, 0.5);
  const ratioY = edgeY / Math.max(innerY, 0.5);
  const worst = Math.max(ratioX, ratioY);

  return { ok: worst <= THRESHOLD, score: Number(worst.toFixed(2)) };
}

export async function checkSeamFromUrl(url: string): Promise<SeamResult> {
  const img = await loadImage(url);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, score: 0 };
  ctx.drawImage(img, 0, 0, size, size);
  return checkSeam(ctx.getImageData(0, 0, size, size));
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = url;
  });
}
