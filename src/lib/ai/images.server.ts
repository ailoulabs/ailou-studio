/**
 * Camada de provedor de imagem.
 * Pintor: Nano Banana 2 (Google), e so ele. A OpenAI e LLM, nao pintor:
 * o GPT-Image so entra pela chave explicita IMAGE_PROVIDER=openai, nunca como socorro.
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

/**
 * Como a peca usa a prancha de motivos. Chave do experimento de qualidade.
 *
 * "parts": a prancha e uma lista de pecas para copiar. Garante consistencia,
 *          mas o modelo copia icones pequenos e isolados e a arte sai clip-art.
 * "identity": a prancha fixa a identidade (especies, cores, mao que desenhou)
 *          e a peca e pintada como composicao inteira, com sobreposicao,
 *          escala variada e elementos sangrando na borda.
 */
export type SheetMode = "parts" | "identity";
export function sheetMode(): SheetMode {
  return process.env["SHEET_MODE"] === "identity" ? "identity" : "parts";
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
 * Escolhe o pintor. Regra de produto: uma colecao sai de UM pintor so.
 *
 * A OpenAI aqui e apenas LLM. O GPT-Image nao entra como socorro automatico:
 * misturar dois modelos na mesma colecao quebra a coordenacao (foi o que
 * aconteceu com o poa, que saiu de outro pintor sem ninguem pedir).
 *
 * Falha temporaria do Google (429, 5xx, tempo esgotado) ganha novas tentativas.
 * Recusa definitiva (4xx fora de cota) para na hora. Esgotou, a unidade falha
 * com o erro do Google e a pessoa decide se recria.
 *
 * O caminho openai continua existindo so para a chave explicita
 * IMAGE_PROVIDER=openai, que e uma escolha deliberada, nunca um fallback.
 */
async function withProvider(
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

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const started = Date.now();
    try {
      const out = await gemini();
      record({ provider: "gemini", ms: Date.now() - started, ok: true });
      return out;
    } catch (err) {
      lastError = err;
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
  // Sem socorro de outro pintor: a falha e do Google e fica registrada como tal.
  throw lastError instanceof Error
    ? lastError
    : new Error("O Google não devolveu a imagem. Tente recriar esta peça.");
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
  const out = await withProvider(
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
  return withProvider(
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

/** Tamanho das peças do fluxo prompt-first: 2K por padrão, rápido para iterar. */
function promptFlowSize(kind: "principal" | "coordenado"): ImageSize {
  const raw = process.env[kind === "principal" ? "IMAGE_SIZE_PRINCIPAL" : "IMAGE_SIZE_PIECES"];
  return raw === "1K" || raw === "2K" || raw === "4K" ? raw : "2K";
}

function base64Of(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Fluxo prompt-first (v0.7): a peça principal nasce só do prompt; os
 * coordenados recebem a principal aprovada como referência de identidade.
 */
export async function generateFromPrompt(input: {
  prompt: string;
  kind: "principal" | "coordenado";
  size: SizePair;
  reference?: Uint8Array;
  signal?: AbortSignal;
  attempts?: ProviderAttempt[];
}): Promise<ImageOut> {
  const imageSize = promptFlowSize(input.kind);
  return withProvider(
    async () =>
      fromGemini(
        await generateImage({
          prompt: input.prompt,
          aspectRatio: aspectOf(input.size),
          imageSize,
          thinkingLevel: "high",
          ...(input.reference
            ? { referenceImages: [{ b64: base64Of(input.reference), mime: "image/png" }] }
            : {}),
          ...(input.signal ? { signal: input.signal } : {}),
        }),
      ),
    async () => {
      if (input.reference) {
        const run = await requestEditFromSheet({
          key: openAiKey(),
          prompt: input.prompt,
          sheet: input.reference,
          size: input.size,
          quality: "high",
          ...(input.signal ? { signal: input.signal } : {}),
        });
        return {
          bytes: bytesFromBase64(run.b64),
          provider: "openai" as const,
          model: run.model,
          size: run.size,
        };
      }
      const run = await requestImage({
        key: openAiKey(),
        prompt: input.prompt,
        size: input.size,
        quality: "high",
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
  return withProvider(
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
  return withProvider(
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
