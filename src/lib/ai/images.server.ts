/**
 * Camada de provedor de imagem.
 * Padrão: Nano Banana 2 (Google). A OpenAI fica como reserva por unidade.
 */

import {
  aspectFor,
  generateImage,
  isPermanentGeminiError,
  type AspectRatio,
  type ImageSize,
} from "@/lib/ai/gemini.server";
import {
  bytesFromBase64,
  openAiKey,
  requestEditFromSheet,
  requestImage,
  requestSeamFix,
  requestSheetImage,
} from "@/lib/ai/openai.server";
import type { SizePair } from "@/lib/ai/prompt.server";

export type ImageProvider = "gemini" | "openai";

/** Provedor padrão, configurável por variável de ambiente. */
export function imageProvider(): ImageProvider {
  return process.env["IMAGE_PROVIDER"] === "openai" ? "openai" : "gemini";
}

/** Tamanho padrão das peças. 4K dá 347 dpi num rapport de 30 cm. */
function pieceSize(): ImageSize {
  const raw = process.env["IMAGE_SIZE_PIECES"];
  return raw === "1K" || raw === "2K" || raw === "4K" ? raw : "4K";
}

export interface ImageOut {
  bytes: Uint8Array;
  provider: ImageProvider;
  model: string;
  /** Medida registrada na ficha: "4K" no Gemini, "2560x2560" na OpenAI. */
  size: string;
  width?: number;
  height?: number;
}

/** Proporção do par de tamanhos usado pela OpenAI. */
function aspectOf(size: SizePair): AspectRatio {
  const [w, h] = size.modern.split("x").map(Number);
  return aspectFor(w || 1, h || 1);
}

/** Registro de cada tentativa, guardado no timings da peça. */
export interface ProviderAttempt {
  provider: ImageProvider;
  ms: number;
  ok: boolean;
  error?: string;
}

function summarize(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.slice(0, 140);
}

/**
 * Recusa definitiva do Google (4xx fora de cota) cai para a OpenAI na hora.
 * Só falha temporária (429, 5xx, tempo esgotado) merece uma segunda tentativa.
 */
async function withFallback(
  gemini: () => Promise<ImageOut>,
  openai: () => Promise<ImageOut>,
  attempts?: ProviderAttempt[],
): Promise<ImageOut> {
  const record = (attempt: ProviderAttempt) => {
    attempts?.push(attempt);
    console.log("[imagem] tentativa", JSON.stringify(attempt));
  };

  const runOpenAi = async (): Promise<ImageOut> => {
    const started = Date.now();
    try {
      const out = await openai();
      record({ provider: "openai", ms: Date.now() - started, ok: true });
      return out;
    } catch (err) {
      record({
        provider: "openai",
        ms: Date.now() - started,
        ok: false,
        error: summarize(err),
      });
      throw err;
    }
  };

  if (imageProvider() === "openai") return runOpenAi();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    try {
      const out = await gemini();
      record({ provider: "gemini", ms: Date.now() - started, ok: true });
      return out;
    } catch (err) {
      record({
        provider: "gemini",
        ms: Date.now() - started,
        ok: false,
        error: summarize(err),
      });
      if (err instanceof Error && /interrompid/i.test(err.message)) throw err;
      if (isPermanentGeminiError(err)) break;
    }
  }
  return runOpenAi();
}

function fromGemini(run: {
  bytes: Uint8Array;
  model: string;
  size: ImageSize;
  width: number;
  height: number;
}): ImageOut {
  return {
    bytes: run.bytes,
    provider: "gemini",
    model: run.model,
    size: run.size,
    width: run.width,
    height: run.height,
  };
}

/** Prancha de motivos: 3:2 em 2K, fundo liso uniforme. */
export async function generateSheet(input: {
  promptTransparent: string;
  promptPlain: string;
  size: SizePair;
  quality?: "medium";
  signal?: AbortSignal;
  attempts?: ProviderAttempt[];
}): Promise<ImageOut & { transparent: boolean }> {
  const gemini = async () => {
    const run = await generateImage({
      prompt: input.promptPlain,
      aspectRatio: aspectOf(input.size),
      imageSize: "2K",
      thinkingLevel: "high",
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return { ...fromGemini(run), transparent: false };
  };
  const openai = async () => {
    const run = await requestSheetImage({
      key: openAiKey(),
      promptTransparent: input.promptTransparent,
      promptPlain: input.promptPlain,
      size: input.size,
      ...(input.quality ? { qualityOverride: input.quality } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
    return {
      bytes: bytesFromBase64(run.b64),
      provider: "openai" as const,
      model: run.model,
      size: input.size.modern,
      transparent: run.transparent,
    };
  };
  const out = await withFallback(
    gemini as unknown as () => Promise<ImageOut>,
    openai as unknown as () => Promise<ImageOut>,
    input.attempts,
  );
  return out as ImageOut & { transparent: boolean };
}

/** Peça a partir da prancha: a prancha entra como imagem de referência. */
export async function generateFromSheet(input: {
  prompt: string;
  sheet: Uint8Array;
  size: SizePair;
  quality: string;
  hiFi?: boolean;
  signal?: AbortSignal;
  attempts?: ProviderAttempt[];
}): Promise<ImageOut> {
  const base64Sheet = () => {
    let binary = "";
    for (const byte of input.sheet) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  return withFallback(
    async () =>
      fromGemini(
        await generateImage({
          prompt: input.prompt,
          aspectRatio: aspectOf(input.size),
          imageSize: input.hiFi ? "4K" : pieceSize(),
          thinkingLevel: "high",
          referenceImages: [{ b64: base64Sheet(), mime: "image/png" }],
          ...(input.signal ? { signal: input.signal } : {}),
        }),
      ),
    async () => {
      const run = await requestEditFromSheet({
        key: openAiKey(),
        prompt: input.prompt,
        sheet: input.sheet,
        size: input.size,
        quality: input.quality,
        ...(input.hiFi ? { hiFi: true } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
      return {
        bytes: bytesFromBase64(run.b64),
        provider: "openai" as const,
        model: run.model,
        size: run.size,
      };
    },
    input.attempts,
  );
}

/** Coordenados sólidos: poá, vichy e listras, sem referência. */
export async function generateSolid(input: {
  prompt: string;
  size: SizePair;
  quality: string;
  signal?: AbortSignal;
  attempts?: ProviderAttempt[];
}): Promise<ImageOut> {
  return withFallback(
    async () =>
      fromGemini(
        await generateImage({
          prompt: input.prompt,
          aspectRatio: aspectOf(input.size),
          imageSize: "2K",
          thinkingLevel: "minimal",
          ...(input.signal ? { signal: input.signal } : {}),
        }),
      ),
    async () => {
      const run = await requestImage({
        prompt: input.prompt,
        size: input.size,
        key: openAiKey(),
        quality: input.quality,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      return {
        bytes: bytesFromBase64(run.b64),
        provider: "openai" as const,
        model: run.model,
        size: run.size,
      };
    },
    input.attempts,
  );
}

/** Instrução do conserto sem máscara: só a cruz central é repintada. */
const SEAM_INSTRUCTION =
  "repaint only the central vertical and horizontal seam band so the pattern becomes continuous; keep everything else pixel-identical";

/**
 * Conserto de emenda. O Gemini recebe a imagem já deslocada e repinta a cruz;
 * a OpenAI continua usando a máscara. Nos dois casos o reencaixe é o mesmo.
 */
export async function fixSeamImage(input: {
  image: Uint8Array;
  mask: Uint8Array;
  prompt: string;
  signal?: AbortSignal;
  attempts?: ProviderAttempt[];
}): Promise<ImageOut> {
  const toB64 = (bytes: Uint8Array) => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  return withFallback(
    async () =>
      fromGemini(
        await generateImage({
          prompt: `${SEAM_INSTRUCTION}. ${input.prompt}`,
          aspectRatio: "1:1",
          imageSize: "2K",
          thinkingLevel: "high",
          referenceImages: [{ b64: toB64(input.image), mime: "image/png" }],
          ...(input.signal ? { signal: input.signal } : {}),
        }),
      ),
    async () => {
      const b64 = await requestSeamFix({
        key: openAiKey(),
        image: input.image,
        mask: input.mask,
        prompt: input.prompt,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      return {
        bytes: bytesFromBase64(b64),
        provider: "openai" as const,
        model: "gpt-image",
        size: "1024x1024",
      };
    },
    input.attempts,
  );
}
