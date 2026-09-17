/**
 * Prompt-first (v0.7): a peça principal nasce de um único prompt longo em
 * inglês, escrito pelo LLM no molde validado em 16/09/2026 (Café da Manhã em
 * chita, Jardim Romântico em aquarela, Festa Junina em xilogravura). Os
 * coordenados usam a principal aprovada como imagem de referência.
 */

import { adjustmentsBlock, buildPrincipalPrompt } from "@/lib/studio-flow";
import {
  blenderKindOf,
  blenderPrompt,
  buildSolidDotPrompt,
  formatSection,
  isSolidDotApp,
  type AppSpec,
} from "@/lib/ai/prompt.server";

export const RENDER_BLOCK =
  "RENDER: flat artwork seen straight from above, edge to edge, full bleed, no border. No text, no letters, no logo, no watermark. Not a mockup, not a product photo, no fabric folds, no lighting or shadows.";

/** Exemplo aprovado, usado como âncora do escritor de prompt. */
const EXAMPLE_PROMPT = `You are a senior surface-pattern designer painting a finished commercial textile print for a Brazilian home-textile brand, in the tradition of chita brasileira sold by the metre in street markets.

SUBJECT: "Café da Manhã". Hero motifs, drawn large: an enamel coffee pot and a coffee cup on a saucer. Supporting motifs, medium size: a loaf of bread, a croissant, a small sugar bowl.

DECORATION ON THE OBJECTS: the coffee pot and the cup are painted enamelware, decorated with a folk floral: a central flower with leaves and dots on the body of the pot, a ring of small flowers around the cup and the saucer rim. Plain, undecorated objects are wrong for this print.

SECONDARY LAYER (mandatory): sprigs of the coffee plant with dark green leaves and clusters of red coffee cherries, plus small five-petal folk flowers in yellow and cream, woven between the hero and supporting motifs.

FILLERS: at least four kinds, mixed evenly: coffee beans, small diamonds, dots, tiny crosses. No single filler may dominate; coffee beans are one filler among the others, not a carpet of beans.

TECHNIQUE: chita brasileira. Flat saturated colour areas, no gradients, bold dark-brown outlines, naive drawing, decorative flourishes around the main motifs. Each shape is one flat colour.

GROUND AND PALETTE: warm cream ground. Palette led by terracotta and coffee brown, with mustard yellow, deep green and a little cherry red as accents, cream highlights, dark-brown outlines.

COMPOSITION: tossed all-over layout, no visible grid, motifs at three sizes. Dense: the cream ground shows only as small gaps between motifs, never as open areas. Natural overlaps. Elements run off all four edges so the artwork reads as a cut from a continuous fabric. No motif isolated in the centre.

${RENDER_BLOCK}`;

export const WRITER_SYSTEM = `Você escreve prompts de imagem para o Nano Banana 2 (Google), que vai pintar a estampa principal de uma coleção têxtil brasileira (mesa posta, costura criativa, enxoval). O modelo é literal: só pinta o que está escrito. Tudo o que dá riqueza precisa estar no texto.

Escreva UM prompt em inglês, seguindo exatamente este molde, nesta ordem, um bloco por parágrafo:

1. Abertura: "You are a senior surface-pattern designer painting a finished commercial textile print for a Brazilian home-textile brand" e, quando houver, a tradição (chita de mercado, festa junina do Nordeste, azulejaria portuguesa...).
2. SUBJECT: o nome do tema entre aspas, 2 ou 3 heróis "drawn large" e 2 ou 3 motivos de apoio "medium size". Nomes concretos (an enamel coffee pot), nunca categorias (kitchen items).
3. DECORATION ON THE OBJECTS, quando o tema tem objetos: como cada objeto é decorado (pintura folclórica, remendos vichy, listras, arabescos). Termine com "Plain, undecorated objects are wrong for this print." Quando o tema é só botânico ou natural, troque por BOTANICAL VARIETY (mandatory): estágios de cada flor ou fruto (botão, meio aberto, aberto) e três formatos de folha.
4. SECONDARY LAYER (mandatory): uma camada ligada ao tema que costura os heróis (ramos com frutos, trepadeiras com florzinhas, varais de bandeirinhas passando na frente e atrás, fitas...).
5. FILLERS: "at least four kinds, mixed evenly:" com os quatro nomeados, e "No single filler may dominate."
6. TECHNIQUE: use o texto da técnica exatamente como foi enviado, sem trocar por outra.
7. GROUND AND PALETTE: fundo nomeado, "Palette led by X and Y, with A, B and C as accents", cor do contorno quando a técnica tem contorno. Se a técnica fixa cores (azulejo azul e branco, lousa preta), obedeça.
8. COMPOSITION: "tossed all-over layout, no visible grid, motifs at three sizes. Dense: the <fundo> ground shows only as small gaps between motifs, never as open areas. Natural overlaps. Elements run off all four edges so the artwork reads as a cut from a continuous fabric. No motif isolated in the centre."
9. RENDER: copie este bloco sem mudar nada: "${RENDER_BLOCK}"

Regras:
- Nada de texto, letras ou palavras desenhadas na estampa.
- Não invente elementos fora do tema; se a artesã escreveu palavras próprias, elas mandam sobre a descrição do tema.
- A paleta deve combinar tema e técnica (Natal não é pastel, Páscoa não é vinho).
- "resumo": 2 ou 3 frases curtas em português simples, para quem não lê inglês, dizendo o que vai ser pintado: heróis, apoio, camada secundária, técnica, fundo e cores.
- "paleta": 5 cores em hex, nesta ordem: fundo, cor principal, segunda cor, acento 1, acento 2. Precisam ser as mesmas cores descritas no bloco GROUND AND PALETTE.

Exemplo de prompt aprovado (tema Café da Manhã, técnica chita brasileira):

${EXAMPLE_PROMPT}`;

export const REWRITER_SYSTEM = `Você recebe um prompt de imagem em inglês, no molde de blocos (SUBJECT, DECORATION ON THE OBJECTS ou BOTANICAL VARIETY, SECONDARY LAYER, FILLERS, TECHNIQUE, GROUND AND PALETTE, COMPOSITION, RENDER), e um pedido da artesã em português.

Reescreva o prompt aplicando o pedido. Mude só o que o pedido exige, mantendo os outros blocos como estão, na mesma ordem, e o bloco RENDER intacto. O pedido pode trocar cores, tirar ou acrescentar motivos, mudar o fundo, a escala ou a densidade. Se o pedido pedir algo que não cabe numa estampa (texto, foto, mockup), ignore essa parte.

Devolva também "resumo" (2 ou 3 frases em português simples do que vai ser pintado) e "paleta" (5 hex: fundo, principal, segunda, acento 1, acento 2, iguais ao bloco GROUND AND PALETTE).`;

export const WRITER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["prompt", "resumo", "paleta"],
  properties: {
    prompt: { type: "string" },
    resumo: { type: "string" },
    paleta: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 5 },
  },
} as const;

export interface WriterResult {
  prompt: string;
  resumo: string;
  paleta: string[];
}

export { adjustmentsBlock, buildPrincipalPrompt };

/** Pega um bloco ("TECHNIQUE", "GROUND AND PALETTE"...) do prompt, com o rótulo. */
export function extractBlock(prompt: string, label: string): string {
  const re = new RegExp(`(^|\\n)${label}[^\\n]*(\\n(?!\\n)[^\\n]*)*`, "m");
  const m = re.exec(prompt);
  return m ? m[0].trim() : "";
}

const ROLE_GUIDANCE: Record<string, string> = {
  coordenado:
    "ROLE: a companion print, lighter than the principal. Use the supporting motifs and the secondary layer of the reference at a smaller scale, more air between them, so it sits beside the principal without competing with it.",
  apoio:
    "ROLE: a quiet support print. Use only one or two of the smallest elements of the reference (fillers, sprigs, tiny flowers), small and evenly scattered, with plenty of plain ground in the same colour as the reference ground.",
};

/**
 * Prompt de um coordenado. A principal aprovada vai anexada como referência de
 * identidade; o formato (corrida, barrado, painel) vem do catálogo.
 */
export function buildCoordinatePrompt(input: {
  app: AppSpec;
  pieceName: string;
  role: string;
  masterPrompt: string;
  palette: string[];
  soft: boolean;
}): { prompt: string; needsReference: boolean } {
  if (isSolidDotApp(input.app)) {
    // Poá, vichy e listra chapados: geometria por regra, cores da paleta.
    const ground = input.palette[0] ?? "#F6F0E6";
    const mark = input.palette[1] ?? "#8A5A44";
    return {
      prompt: buildSolidDotPrompt({
        app: input.app,
        pieceGuidance: `background color: ${ground}; dot color: ${mark}`,
        palette: input.palette,
        overrides: { contrast: 1 },
      }),
      needsReference: false,
    };
  }

  const technique = extractBlock(input.masterPrompt, "TECHNIQUE");
  const palette = extractBlock(input.masterPrompt, "GROUND AND PALETTE");
  const blender = blenderKindOf(input.app);

  if (blender) {
    return {
      prompt: [
        `You are the same surface-pattern designer who painted the attached image, the principal print of a coordinated collection. Now paint a support coordinate of that collection: ${input.pieceName}.`,
        blenderPrompt(input.app, blender, input.soft ? "aquarela-delicada" : "chita"),
        "The attached image is only a colour and brushwork reference: take the ground colour and one accent colour from it, keep the same hand, and do not copy its motifs. No flowers, no leaves, no objects.",
        technique,
        palette,
        RENDER_BLOCK,
      ]
        .filter(Boolean)
        .join("\n\n"),
      needsReference: true,
    };
  }

  const isPanel = input.app.family === "painel";
  return {
    prompt: [
      `You are the same surface-pattern designer who painted the attached image, the PRINCIPAL PRINT of a coordinated collection. Now paint a DIFFERENT piece of the same collection: ${input.pieceName}. This new piece has its own format, described next, and must look clearly different from the attached image.`,
      formatSection(input.app),
      isPanel
        ? "DO NOT COPY THE REFERENCE: the attached image is an all-over repeat; this piece is not. Never fill the whole canvas with motifs the way the reference does. Most of this piece is plain empty ground, exactly as the format above says; the decoration sits only where the format puts it."
        : "DO NOT COPY THE REFERENCE: never reproduce its composition or its layout. Redraw every element from scratch, at the size and density this piece asks for.",
      isPanel
        ? "ROLE: inside the decorated areas, use the hero and supporting motifs of the reference at full size and full detail, in generous overlapping clusters; the undecorated areas are only the plain ground colour of the reference."
        : (ROLE_GUIDANCE[input.role] ?? ROLE_GUIDANCE["coordenado"]),
      "IDENTITY, keep it exactly: the same technique, the same drawing hand, the same palette, the same ground colour and the same kinds of motif as the reference. Do not introduce new colours or new kinds of motif.",
      technique,
      palette,
      RENDER_BLOCK,
    ]
      .filter(Boolean)
      .join("\n\n"),
    needsReference: true,
  };
}
