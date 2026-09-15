/**
 * Chamadas de baixo nível à OpenAI. Só roda no servidor.
 * Usado tanto pelas server functions quanto pelo processador de geração.
 */

export const MODEL_IMAGE_FLARE = "gpt-image-2.5-flare";
export const MODEL_IMAGE_SUNBURST = "gpt-image-2.5-sunburst";
export const MODEL_DIRECTOR = "gpt-5-mini";

/** Cadeia de geração: 2.5 Flare, depois os anteriores. */
const GENERATION_MODELS = [MODEL_IMAGE_FLARE, "gpt-image-2", "gpt-image-1"] as const;
/** Cadeia de edição: Flare primeiro, que é o rápido. */
const EDIT_MODELS = [
  MODEL_IMAGE_FLARE,
  MODEL_IMAGE_SUNBURST,
  "gpt-image-2",
  "gpt-image-1",
] as const;
/** Alta fidelidade sob pedido: Sunburst na frente. */
const EDIT_MODELS_HIFI = [
  MODEL_IMAGE_SUNBURST,
  MODEL_IMAGE_FLARE,
  "gpt-image-2",
  "gpt-image-1",
] as const;

export const isNewModel = (model: string) => model.startsWith("gpt-image-2.5");

export type SizePair = { modern: string; legacy: string };
export const sizeFor = (model: string, size: SizePair) =>
  isNewModel(model) ? size.modern : size.legacy;

export function openAiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) {
    throw new Error(
      "A chave da OpenAI ainda não está configurada. Adicione OPENAI_API_KEY nas configurações do projeto.",
    );
  }
  return key;
}

export function openAiError(status: number, detail?: string): string {
  const extra = detail ? ` (${detail.slice(0, 200)})` : "";
  if (status === 401) return "A chave da OpenAI foi recusada. Confira a configuração.";
  if (status === 429) return "A OpenAI está ocupada agora. Tente novamente em instantes.";
  if (status === 400) return `O pedido foi recusado pela OpenAI${extra}`;
  return `A OpenAI não respondeu como esperado (código ${status})${extra}`;
}

export async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? "";
  } catch {
    return "";
  }
}

/** Chamada que respeita o Retry-After em caso de 429, com até duas novas tentativas. */
export async function openAiFetch(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < 2 && res.status === 429; attempt += 1) {
    if (init.signal?.aborted) break;
    const header = Number(res.headers.get("retry-after") ?? "");
    const waitMs = Number.isFinite(header) && header > 0 ? header * 1000 : (attempt + 1) * 3000;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 20000)));
    if (init.signal?.aborted) break;
    res = await fetch(url, init);
  }
  return res;
}

export interface ImageRun {
  b64: string;
  model: string;
  quality: string;
  size: string;
}

export function bytesFromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Geração direta de imagem, tolerando diferenças de parâmetros entre modelos. */
export async function requestImage(input: {
  prompt: string;
  size: SizePair;
  key: string;
  quality?: string;
  signal?: AbortSignal;
}): Promise<ImageRun> {
  let lastMessage = "A OpenAI não devolveu a imagem. Tente novamente.";

  for (const model of GENERATION_MODELS) {
    const quality = isNewModel(model) ? (input.quality ?? "high") : "medium";
    const usedSize = sizeFor(model, input.size);
    for (const extras of [{ quality, output_format: "png" }, {}]) {
      const res = await openAiFetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${input.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: input.prompt, size: usedSize, n: 1, ...extras }),
        ...(input.signal ? { signal: input.signal } : {}),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
        const b64 = json.data?.[0]?.b64_json;
        if (b64) return { b64, model, quality, size: usedSize };
        const url = json.data?.[0]?.url;
        if (url) {
          const img = await fetch(url, input.signal ? { signal: input.signal } : {});
          return {
            b64: base64FromBytes(new Uint8Array(await img.arrayBuffer())),
            model,
            quality,
            size: usedSize,
          };
        }
        lastMessage = "A OpenAI não devolveu a imagem. Tente novamente.";
        continue;
      }

      const detail = await errorDetail(res);
      lastMessage = openAiError(res.status, detail);
      const recoverable =
        res.status === 400 &&
        /model|quality|output_format|size|unsupported|unknown parameter/i.test(detail);
      if (!recoverable) throw new Error(lastMessage);
    }
  }

  throw new Error(lastMessage);
}

/** Prancha de motivos: tenta fundo transparente e, se recusado, fundo liso. */
export async function requestSheetImage(input: {
  key: string;
  promptTransparent: string;
  promptPlain: string;
  size: SizePair;
  /** Força a qualidade da imagem. Sem isso, cada modelo usa a sua melhor. */
  qualityOverride?: "low" | "medium" | "high";
  signal?: AbortSignal;
}): Promise<{ b64: string; transparent: boolean; model: string }> {
  let lastMessage = "A OpenAI não devolveu a prancha de motivos.";

  for (const model of GENERATION_MODELS) {
    const quality = input.qualityOverride ?? (isNewModel(model) ? "high" : "medium");
    const attempts = [
      {
        prompt: input.promptTransparent,
        extras: { quality, output_format: "png", background: "transparent" },
        transparent: true,
      },
      { prompt: input.promptPlain, extras: { quality, output_format: "png" }, transparent: false },
      { prompt: input.promptPlain, extras: {}, transparent: false },
    ];
    for (const attempt of attempts) {
      const res = await openAiFetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${input.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: attempt.prompt,
          size: sizeFor(model, input.size),
          n: 1,
          ...attempt.extras,
        }),
        ...(input.signal ? { signal: input.signal } : {}),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: { b64_json?: string }[] };
        const b64 = json.data?.[0]?.b64_json;
        if (b64) return { b64, transparent: attempt.transparent, model };
        lastMessage = "A OpenAI não devolveu a prancha de motivos.";
        continue;
      }

      const detail = await errorDetail(res);
      lastMessage = openAiError(res.status, detail);
      const recoverable =
        res.status === 400 &&
        /model|quality|output_format|background|size|unsupported|unknown parameter|transparent/i.test(
          detail,
        );
      if (!recoverable) throw new Error(lastMessage);
    }
  }
  throw new Error(lastMessage);
}

/** Edição usando a prancha como referência. */
export async function requestEditFromSheet(input: {
  key: string;
  prompt: string;
  sheet: Uint8Array;
  size: SizePair;
  quality: string;
  hiFi?: boolean;
  signal?: AbortSignal;
}): Promise<ImageRun> {
  let lastMessage = "A edição não devolveu a imagem.";

  for (const model of input.hiFi ? EDIT_MODELS_HIFI : EDIT_MODELS) {
    // O Sunburst recusa input_fidelity; os modelos antigos aceitam.
    const quality = isNewModel(model) ? (input.hiFi ? "high" : input.quality) : "medium";
    const variants: Record<string, string>[] = isNewModel(model)
      ? [{ quality, output_format: "png" }, { quality }, {}]
      : [{ input_fidelity: "high", quality: "medium" }, { quality: "medium" }, {}];

    for (const extras of variants) {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", input.prompt);
      form.append("size", sizeFor(model, input.size));
      for (const [k, v] of Object.entries(extras)) form.append(k, String(v));
      form.append("image", new Blob([input.sheet as BlobPart], { type: "image/png" }), "motifs.png");

      const res = await openAiFetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${input.key}` },
        body: form,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: { b64_json?: string }[] };
        const b64 = json.data?.[0]?.b64_json ?? null;
        if (b64) return { b64, model, quality, size: sizeFor(model, input.size) };
        continue;
      }
      const detail = await errorDetail(res);
      lastMessage = openAiError(res.status, detail);
      const recoverable =
        res.status === 400 &&
        /input_fidelity|quality|output_format|size|unsupported|unknown parameter|model/i.test(
          detail,
        );
      if (!recoverable) throw new Error(lastMessage);
    }
  }
  throw new Error(lastMessage);
}

/** Texto padrão do conserto, usado quando a peça não informa o estilo dela. */
export const SEAM_FIX_PROMPT =
  "continue the existing pattern seamlessly across the masked cross; keep exactly the same motifs, palette, scale and rendering style; do not add new elements and do not touch the outer edges";

/** Conserto de emenda: edição com máscara em cruz. */
export async function requestSeamFix(input: {
  key: string;
  image: Uint8Array;
  mask: Uint8Array;
  prompt?: string;
  signal?: AbortSignal;
}): Promise<string> {

  let lastMessage = "A edição não devolveu a imagem corrigida.";

  for (const model of EDIT_MODELS) {
    const form = new FormData();
    form.append("model", model);
    if (isNewModel(model)) form.append("quality", "high");
    form.append("prompt", input.prompt ?? SEAM_FIX_PROMPT);
    form.append("image", new Blob([input.image as BlobPart], { type: "image/png" }), "piece.png");
    form.append("mask", new Blob([input.mask as BlobPart], { type: "image/png" }), "mask.png");

    const res = await openAiFetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.key}` },
      body: form,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = json.data?.[0]?.b64_json ?? null;
      if (b64) return b64;
      continue;
    }
    const detail = await errorDetail(res);
    lastMessage = openAiError(res.status, detail);
    const recoverable =
      res.status === 400 && /model|quality|unsupported|unknown parameter/i.test(detail);
    if (!recoverable) throw new Error(lastMessage);
  }
  throw new Error(lastMessage);
}
