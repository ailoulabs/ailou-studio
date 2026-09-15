/**
 * Conferência de conteúdo da prancha de motivos.
 * Olha a pintura e diz o que está lá, comparando com a lista do diretor
 * e com o que a artesã pediu para ficar de fora.
 */

export type SheetElementStatus = "na-lista" | "fora-da-lista" | "excluido" | "fora-da-categoria";

export interface SheetElement {
  /** Nome curto em português, usado como legenda do motivo. */
  name: string;
  status: SheetElementStatus;
  /** Posição aproximada na prancha, em porcentagem de 0 a 100. */
  bbox: { x: number; y: number; w: number; h: number };
}

export interface SheetReview {
  elements: SheetElement[];
  /** Tem algum elemento que a pessoa pediu para não entrar, ou fora da categoria obrigatória. */
  hasExcluded: boolean;
}

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["elements"],
  properties: {
    elements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "status", "bbox"],
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["na-lista", "fora-da-lista", "excluido", "fora-da-categoria"] },
          bbox: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "w", "h"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `Você confere pranchas de motivos para estamparia.
Olhe a imagem e liste cada elemento desenhado que você vê, um por um.
Para cada elemento diga o nome curto em português e a posição aproximada em porcentagem da imagem.
status é "na-lista" quando o elemento corresponde a um item da lista de motivos permitidos,
"excluido" quando corresponde a algo da lista de exclusões,
"fora-da-categoria" quando existe uma categoria obrigatória e o elemento não é uma instância dela
(por exemplo chupeta ou mamadeira quando a categoria obrigatória é doce),
e "fora-da-lista" quando não está em nenhuma dessas situações.
Nunca use o caractere travessão.`;

/** Confere a prancha com gpt-5-mini. Falha em silêncio devolve lista vazia. */
export async function reviewSheet(input: {
  key: string;
  base64Png: string;
  motifs: string[];
  avoid: string[];
  /** Categoria obrigatória, em inglês, ou vazio. */
  category?: string;
  signal?: AbortSignal;
}): Promise<SheetReview> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                motivosPermitidos: input.motifs,
                exclusoes: input.avoid,
                categoriaObrigatoria: input.category ?? "",
              }),
            },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${input.base64Png}` },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "conferencia", strict: true, schema: REVIEW_SCHEMA },
      },
    }),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  if (!res.ok) return { elements: [], hasExcluded: false };
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  let parsed: { elements?: SheetElement[] } = {};
  try {
    parsed = JSON.parse(json.choices[0]?.message.content ?? "{}") as { elements?: SheetElement[] };
  } catch {
    return { elements: [], hasExcluded: false };
  }
  const elements = (parsed.elements ?? []).filter((e) => e && e.name && e.bbox);
  const offending = elements.filter(
    (e) => e.status === "excluido" || e.status === "fora-da-categoria",
  );
  return { elements, hasExcluded: offending.length > 0 };
}
