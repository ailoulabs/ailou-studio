/**
 * Nano Banana 2 (Gemini 3.1 Flash Image) da Google.
 * Só roda no servidor. Geração e edição por instrução, com imagens de referência.
 */

export const MODEL_NANO_BANANA = "gemini-3.1-flash-image";

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** Proporções aceitas pelo modelo. */
export const ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
  "1:4",
  "4:1",
  "1:8",
  "8:1",
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type ImageSize = "512px" | "1K" | "2K" | "4K";
export type ThinkingLevel = "minimal" | "high";

export function geminiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    throw new GeminiApiError(
      "A chave do Google ainda não está configurada. Adicione GEMINI_API_KEY nas configurações do projeto.",
      401,
    );
  }
  return key;
}

/** Proporção suportada mais próxima de uma medida real. */
export function aspectFor(width: number, height: number): AspectRatio {
  const target = Math.log(width / Math.max(0.01, height));
  let best: AspectRatio = "1:1";
  let bestDiff = Infinity;
  for (const ratio of ASPECT_RATIOS) {
    const [w, h] = ratio.split(":").map(Number) as [number, number];
    const diff = Math.abs(Math.log(w / h) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

/** Dimensões reais de um PNG ou JPEG devolvido pela API. */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: IHDR logo depois da assinatura de 8 bytes.
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: procura o primeiro marcador SOF.
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    const length = view.getUint16(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    }
    offset += 2 + length;
  }
  return { width: 0, height: 0 };
}

/** Erro do Google com o código HTTP, para decidir se vale tentar de novo. */
export class GeminiApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

/** 4xx (fora do 429) não adianta repetir: cai para o outro provedor na hora. */
export function isPermanentGeminiError(err: unknown): boolean {
  return (
    err instanceof GeminiApiError && err.status >= 400 && err.status < 500 && err.status !== 429
  );
}

function geminiError(status: number, detail: string): string {
  const extra = detail ? ` (${detail.slice(0, 200)})` : "";
  if (status === 401 || status === 403) return "A chave do Google foi recusada. Confira a configuração.";
  if (status === 429) return "O Google está ocupado agora. Tente novamente em instantes.";
  if (status === 400) return `O pedido foi recusado pelo Google${extra}`;
  return `O Google não respondeu como esperado (código ${status})${extra}`;
}

/** O modelo pode responder em JPEG; o app só trabalha com PNG. */
async function toPng(bytes: Uint8Array): Promise<Uint8Array> {
  const [{ default: jpeg }, { encode }] = await Promise.all([
    import("jpeg-js"),
    import("fast-png"),
  ]);
  const raw = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return encode({
    width: raw.width,
    height: raw.height,
    data: new Uint8Array(raw.data),
    channels: 4,
    depth: 8,
  });
}

export interface GeminiImage {
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
  model: string;
  size: ImageSize;
  aspectRatio: AspectRatio;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
    finishReason?: string;
  }[];
  error?: { message?: string };
}

/** Geração e edição: mesma chamada, com ou sem imagens de referência. */
export async function generateImage(input: {
  prompt: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  /** Referências em base64 (prancha de motivos, arte a consertar). */
  referenceImages?: { b64: string; mime?: string }[];
  thinkingLevel?: ThinkingLevel;
  model?: string;
  signal?: AbortSignal;
}): Promise<GeminiImage> {
  const key = geminiKey();
  const model = input.model ?? MODEL_NANO_BANANA;
  const parts: Record<string, unknown>[] = [{ text: input.prompt }];
  for (const ref of input.referenceImages ?? []) {
    parts.push({ inlineData: { mimeType: ref.mime ?? "image/png", data: ref.b64 } });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: input.aspectRatio, imageSize: input.imageSize },
      // Na API REST atual o nível de raciocínio fica dentro de thinkingConfig.
      ...(input.thinkingLevel ? { thinkingConfig: { thinkingLevel: input.thinkingLevel } } : {}),
    },
  };


  let lastMessage = "O Google não devolveu a imagem. Tente novamente.";
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (input.signal?.aborted) throw new Error("A geração foi interrompida.");
    const res = await fetch(ENDPOINT(model), {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...(input.signal ? { signal: input.signal } : {}),
    });

    if (res.ok) {
      const json = (await res.json()) as GeminiResponse;
      const candidate = json.candidates?.[0];
      const part = candidate?.content?.parts?.find((p) => p.inlineData?.data);
      const b64 = part?.inlineData?.data;
      if (b64) {
        let bytes: Uint8Array<ArrayBuffer> = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        // O modelo pode devolver JPEG. O app inteiro trabalha em PNG.
        if (!(bytes[0] === 0x89 && bytes[1] === 0x50)) {
          bytes = new Uint8Array(await toPng(bytes));
        }

        const dims = imageDimensions(bytes);
        return {
          bytes,
          mime: "image/png",
          width: dims.width,
          height: dims.height,
          model,
          size: input.imageSize,
          aspectRatio: input.aspectRatio,
        };
      }
      const reason = candidate?.finishReason ?? "";
      // Recusa do modelo não melhora repetindo: cai para o outro provedor.
      if (/RECITATION|SAFETY|PROHIBITED|BLOCK/i.test(reason)) {
        throw new GeminiApiError(`O Google recusou este pedido (${reason}).`, 422);
      }
      lastMessage = "O Google não devolveu a imagem. Tente novamente.";
      continue;
    }

    let detail = "";
    try {
      const json = (await res.json()) as GeminiResponse;
      detail = json.error?.message ?? "";
    } catch {
      detail = "";
    }
    lastMessage = geminiError(res.status, detail);
    lastStatus = res.status;
    if (res.status !== 429 && res.status !== 503 && res.status < 500) {
      throw new GeminiApiError(lastMessage, res.status);
    }

    const header = Number(res.headers.get("retry-after") ?? "");
    const waitMs = Number.isFinite(header) && header > 0 ? header * 1000 : (attempt + 1) * 3000;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 20000)));
  }
  throw new GeminiApiError(lastMessage, lastStatus);
}
