/**
 * Montagem do prompt de imagem no servidor. Sempre em inglês para o modelo.
 */

export interface AppSpec {
  family: "corrida" | "barrado" | "painel";
  fabric_width_cm: number;
  cut_length_cm: number;
  params: Record<string, unknown>;
  /** Identificador do catálogo, usado nas regras específicas de poá. */
  slug?: string;
}

export interface Overrides {
  motifScale?: number;
  density?: number;
  contrast?: number;
  background?: string;
}

/** Níveis vão de -2 a 2. Coleções antigas com -1, 0 ou 1 continuam válidas. */
export function levelIndex(value: number | undefined): number {
  const v = Math.round(value ?? 0);
  return Math.min(4, Math.max(0, v + 2));
}

const SCALE = [
  "the largest motif spans about 8% of the tile width",
  "the largest motif spans about 12% of the tile width",
  "the largest motif spans about 18% of the tile width",
  "the largest motif spans about 25% of the tile width",
  "the largest motif spans about 35% of the tile width",
];
const DENSITY = [
  "motifs cover about 20% of the ground, lots of open space",
  "motifs cover about 30% of the ground",
  "motifs cover about 45% of the ground",
  "motifs cover about 60% of the ground",
  "motifs cover about 75% of the ground, densely filled",
];
const CONTRAST = [
  "very close washed tones, almost tone on tone",
  "soft low contrast, gentle tonal difference between motifs and ground",
  "medium contrast, clearly readable motifs on the ground",
  "strong contrast, saturated motifs on a clearly lighter or darker ground",
  "very strong contrast, full saturated colors with a markedly dark or markedly light ground behind the motifs",
];
const BLENDER_CONTRAST = [
  "the mark is only a whisper lighter or darker than the ground",
  "a gentle difference between mark and ground",
  "a clear, readable difference between mark and ground",
  "a strong difference between mark and ground",
  "a maximum difference between mark and ground, full solid colors",
];

/**
 * A identidade visual da colecao nao e mais fixa no prompt.
 *
 * Antes daqui saiam "linho creme claro" e "modelagem botanica" para toda peca,
 * o que fazia coleccao nenhuma escapar do mesmo visual e quebrava tema que nao
 * e floral: churrasco em fundo preto, pinguim de Natal, ceu estrelado.
 *
 * Agora o diretor criativo escolhe tecnica, fundo, layout e paleta no
 * vocabulario (vocabulary.server.ts) e o que chega aqui ja vem em ingles.
 */
export interface LookSpec {
  /** Tecnica de renderizacao, em ingles. */
  technique?: string;
  /** Tratamento do fundo, em ingles. */
  ground?: string;
  /** Distribuicao dos motivos, em ingles. */
  layout?: string;
  /** Estrategia de paleta, em ingles. */
  palette?: string;
}

/**
 * O que vale para qualquer estampa comercial, independente de tecnica.
 * E so isto que continua fixo: o resto virou escolha.
 */
const CRAFT =
  "CRAFT, what separates a finished commercial print from clip art: keep a strong scale contrast, one or two hero motifs clearly larger, surrounded by much smaller supporting ones; let motifs cross the boundaries of the design, running over a frame rule, over the edge of a band or off the edge of the image, instead of stopping neatly short of them; keep the quiet areas genuinely empty, only ground, never a faint wash or a stray mark; every element is finished and deliberate, nothing blurred, smeared, half drawn or out of focus.";

const PAINTED_CONSTRAINTS =
  "CONSTRAINTS: no text, no letters, no labels, no numbers, no watermark, no signature; no mockup, no product photo, no sewn item, no table, no plate, no cutlery, no props, no hands; no perspective, no folds, no draped cloth, no 3D; no shadow cast onto the ground, no glow, no halo, no spotlight, no vignette; no blur and no out-of-focus area anywhere in the image; the artwork is flat, seen straight from above, filling the whole image with no white margin; no drawn outline border around the artwork unless explicitly requested above.";

/** Copia o look sem o layout, para os coordenados que tem geometria propria. */
function withoutLayout(look: LookSpec | undefined): LookSpec {
  const { layout: _ignored, ...rest } = look ?? {};
  return rest;
}

/** Blocos de identidade visual, montados a partir do que o diretor escolheu. */
function lookBlocks(look: LookSpec | undefined, withLayout: boolean): string[] {
  const l = look ?? {};
  const out: string[] = [];
  if (l.technique) {
    out.push(
      `TECHNIQUE: ${l.technique}. Every single element of this artwork is made with this technique and no other, including the ornaments and the background treatment.`,
    );
  }
  if (l.ground) {
    out.push(
      `GROUND: ${l.ground}. This ground is the same across every piece of the collection. It is a flat printed surface seen straight from above, never a photograph of cloth, never folds, never 3D.`,
    );
  }
  if (withLayout && l.layout) out.push(`LAYOUT: ${l.layout}.`);
  if (l.palette) out.push(`COLOUR FEEL: ${l.palette}.`);
  out.push(CRAFT);
  return out;
}

/** Estilos de borda mole, que pedem listra pincelada em vez de listra reta. */
const SOFT_EDGE_STYLES = new Set(["aquarela-delicada", "botanico-vintage"]);

/** Sem estilo definido a colecao cai no padrao aquarela, de borda mole. */
export function isModelledStyle(style?: string): boolean {
  const key = (style ?? "").trim();
  return key === "" || SOFT_EDGE_STYLES.has(key);
}

/** Linha de controles de estilo usada em todos os prompts. */
function styleControls(o: Overrides, frame: boolean, blender = false): string {
  const scale = SCALE[levelIndex(o.motifScale)]!.replace(
    "tile width",
    frame ? "frame width" : "tile width",
  );
  const contrast = blender
    ? BLENDER_CONTRAST[levelIndex(o.contrast)]!
    : CONTRAST[levelIndex(o.contrast)]!;
  return `STYLE CONTROLS: ${scale}; ${DENSITY[levelIndex(o.density)]!}; ${contrast}; ${o.background ?? "claro"} background value.`;
}

function frameOf(params: Record<string, unknown>) {
  const frames = params["frames"] as
    | {
        count: number;
        widthCm: number;
        heightCm: number;
        shape: "rect" | "circle";
        marginCm: number;
        quietArea?: { shape: string; widthCm: number; heightCm: number };
        backgroundStyle: "plain" | "coordinate";
        accent?: "corner";
        /** Quadro gerado deitado e girado 90 graus na montagem do corte. */
        renderLandscape?: boolean;

      }
    | undefined;
  return frames;
}

export function formatSection(app: AppSpec, secondary?: string): string {
  const p = app.params ?? {};
  // Linguagem grafica secundaria da colecao (azulejo, listra, jeans, renda...).
  // E ela que amarra as pecas: vira moldura no painel, filigrana no barrado
  // e ornamento solto na estampa corrida.
  const sec = (secondary ?? "").trim();
  if (app.family === "corrida") {
    const rapport = Number(p["rapportCm"] ?? 30);
    const layout = String(p["layout"] ?? "tossed");
    return [
      `PRODUCT FORMAT: a seamless square repeat tile representing ${rapport} x ${rapport} cm of printed fabric, ${layout} layout, motifs scattered across the whole square, no border, no frame; opposite edges must continue into each other so the tile repeats invisibly in every direction.`,
      sec
        ? `SECOND LAYER: scatter ${sec} ornaments in between the main motifs, clearly smaller and quieter than the main subject and drawn in a single accent color, so this print reads as a member of the same collection instead of a standalone floral.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (app.family === "barrado") {
    const bands = Number(p["bands"] ?? 1);
    const bandHeight = Number(p["bandHeightCm"] ?? 50);
    const position = String(p["borderPosition"] ?? "bottom");
    const ratio = Math.min(0.9, bandHeight / Math.max(1, app.cut_length_cm));
    if (bands > 1) {
      const cut = app.cut_length_cm;
      const rawHeights = Array.isArray(p["bandHeightsCm"]) ? (p["bandHeightsCm"] as number[]) : [];
      const heights =
        rawHeights.length === bands
          ? rawHeights
          : Array.from({ length: bands }, () => bandHeight);
      const trim = Number(p["trimCm"] ?? 1);
      const margin = Number(p["marginCm"] ?? 0.5);
      const trimStyle = String(p["trimStyle"] ?? "renda");
      const grounds = Array.isArray(p["grounds"]) ? (p["grounds"] as string[]) : [];
      const GROUND: Record<string, string> = {
        creme: "a plain warm cream ground",
        clara: "a plain very light tinted ground in one of the palette colors",
        vichy: "a tiny gingham check ground",
        cheia: "a fully colored ground in a saturated palette color",
      };
      const TRIM: Record<string, string> = {
        renda: "a narrow lace-like scalloped trim strip",
        vichy: "a narrow gingham check trim strip",
        fita: "a narrow ribbon strip with thin stripes",
        azulejo: "a narrow tile-like geometric trim strip",
        ramo: "a narrow strip of small repeating leaves",
      };
      const rows = heights
        .map((h, i) => {
          const g = GROUND[grounds[i] ?? "creme"] ?? GROUND["creme"];
          return `band ${i + 1}: ${h} cm tall, ${g}, one single row of motifs repeating left to right`;
        })
        .join("; ");
      return [
        `PRODUCT FORMAT: one flat multi-band border panel, ${cut} cm tall and as wide as the image, drawn as horizontal stripes stacked from top to bottom.`,
        `LAYOUT from top to bottom: ${margin} cm plain margin; ${rows}; between two consecutive bands there is ${TRIM[trimStyle] ?? TRIM["renda"]} exactly ${trim} cm tall; ${margin} cm plain margin at the bottom.`,
        `Every band is independent, has its own theme and its own straight horizontal top and bottom edges spanning the full width; motifs sit inside their band and never cross a band edge, never touch the trim strips.`,
        `Each band and each trim strip repeats perfectly from left to right: the left and right edges of the image must continue into each other seamlessly, with no motif cut at the sides.`,
        `Do not draw a towel, a cloth, a table, a mockup, a product photo, shadows or a white margin around the artwork.`,
      ].join(" ");
    }
    if (position === "both") {
      const bandFrac = Math.min(0.38, ratio * 0.4).toFixed(2);
      return [
        `PRODUCT FORMAT: a square module for a table-runner border print.`,
        `A decorative band of motifs runs along the TOP edge and an equally decorated, equally full band runs along the BOTTOM edge, each about ${bandFrac} of the height; the bottom band must be just as finished, detailed and richly painted as the top band, never left empty, faded or unfinished.`,
        `Between the two bands is a calm center made of a clean linen ground in the lightest base color, almost empty, with at most a few very small sparse specks.`,
        `The center must stay crisp and light: no blurry wash, no out-of-focus flowers, no faded or smeared motifs, and no soft gradient bleeding down from the top band into the center.`,
        `Left and right edges must continue into each other so the module repeats horizontally, with no motif cut at the sides.`,
      ].join(" ");
    }
    const trimCm = Number(p["trimCm"] ?? 1.2);
    return [
      `PRODUCT FORMAT: a square module for a border print: a decorative border along the bottom edge occupying about ${ratio.toFixed(2)} of the height, built in two layers.`,
      `The lower layer is the main band of motifs in a single row; directly above it sits a narrow finishing trim strip about ${trimCm} cm tall running the full width.`,
      sec
        ? `The band is built out of ${sec}: use it for the band ground and for the finishing trim strip, mixing stripe widths and letting a fine reserved pattern show inside the wider stripes, so the border belongs to the same family as the framed pieces.`
        : "",
      `Everything above that is a calm, almost plain quiet area, with one or two motif clusters descending into it from the upper corners.`,
      `BRIDGE, this is what makes the border look designed instead of pasted on: at least one motif cluster must straddle the top edge of the band, sitting partly on the plain ground above and partly over the band below, so the two zones interlock. The band edge stays straight and full width underneath; the motif simply overlaps it.`,
      `Left and right edges must continue into each other so the module repeats horizontally, with no motif cut at the sides.`,
    ].join(" ");
  }


  const frame = frameOf(p);
  const landscape = frame?.renderLandscape === true;
  const w = landscape ? Math.max(frame!.widthCm, frame!.heightCm) : (frame?.widthCm ?? 50);
  const h = landscape ? Math.min(frame!.widthCm, frame!.heightCm) : (frame?.heightCm ?? 50);
  const shape = frame?.shape ?? "rect";
  const bg = frame?.backgroundStyle ?? "plain";

  if (frame?.accent === "corner") {
    return [
      `PRODUCT FORMAT: a single flat square napkin design, aspect ${w}:${h}, on the plain collection ground.`,
      `Draw exactly ONE generous corner bouquet or motif cluster, anchored in the LOWER-RIGHT CORNER and touching both the bottom edge and the right edge, growing inward and upward from that corner.`,
      `SIZE, this is the part that usually comes out wrong: the cluster must span about 30% of the width and 30% of the height of the whole image, built from several overlapping motifs at different sizes, not one small isolated element. A single little motif floating in the middle of the napkin is a failure.`,
      `The other three corners, the whole centre and the top and left edges stay completely empty ground.`,
      `CRITICAL: draw only ONE single design, never several squares, panels, napkins, frames, a grid or a repeated layout; no border line around the edges.`,
      `Do not draw a real napkin object, a table, a plate, a mockup or a product photo; the art is flat, seen straight from above, filling the whole image with no white margin.`,
    ].join(" ");
  }

  const quietCm = frame?.quietArea
    ? `${frame.quietArea.widthCm} x ${frame.quietArea.heightCm} cm`
    : "26 x 26 cm";

  if (landscape) {
    // Jogo americano no padrão da loja: moldura recuada, cantos carregados, centro calmo.
    return [
      `PRODUCT FORMAT: a single finished landscape placemat panel artwork, ${w} cm wide by ${h} cm tall, aspect ${w}:${h}, drawn horizontally.`,
      `FRAME: an ornamental border band set about 2 cm inside the outer edge and running all the way around, bounded on both its outer and its inner side by a pair of thin parallel rules; inside that band, symmetric ${sec || "scrollwork"} drawn in a single accent color of the palette, shaded from a pale wash to a deep saturated tone with clean reserved highlights, with a small medallion centred in each of the four corners and a centred symmetrical motif at the middle of each of the four sides.`,
      `COMPOSITION: generous bouquets, fruit or foliage clusters sitting in the outer margin between the frame and the image edge, concentrated at two opposite corners or more lightly at all four, running off the image edge where they reach it instead of being tucked neatly inside, and overlapping inward over the outer rule and partly onto the scrollwork; the whole center is calm, only the collection ground, undecorated; a central resting zone of about ${quietCm} that stays free of motifs, washes and marks, painted in exactly the same ground as the rest of the panel. No words, no letters and no lettering anywhere on the panel.`,
      "CRITICAL: the center is only empty background, never a drawn object. Do NOT draw a plate, a dish, a white circle, a white disc, a bright or solid filled shape, a halo or a spotlight in the middle; the central zone must be the very same ground as the rest, just without decoration.",
      "Do not draw any plate, cutlery, napkin, table, mockup or product photo. The artwork is flat, seen straight from above, filling the whole image with no white margin around it.",
    ].join(" ");
  }

  const quiet = frame?.quietArea
    ? `a quiet ${frame.quietArea.shape === "circle" ? "circular" : "rectangular"} area in the center, roughly ${frame.quietArea.widthCm} x ${frame.quietArea.heightCm} cm of the ${w} x ${h} cm panel, completely free of motifs`
    : "a calm center with lighter, sparser decoration";
  return `PRODUCT FORMAT: a single finished ${shape === "circle" ? "round" : "framed rectangular"} panel artwork, aspect ${w}:${h}, ${bg === "coordinate" ? "background filled with a soft coordinating pattern" : "plain calm background"}, with ${quiet}; motifs concentrated at the sides and corners as a decorative frame, with the corner clusters crossing slightly over the frame rule instead of stopping short of it, so the border reads as designed and not as clip art; do not draw any plate, cutlery, table, mockup or product photo.`;
}

export type LegacySize = "1024x1024" | "1024x1536" | "1536x1024";

export interface SizePair {
  /** Tamanho grande, aceito pelos modelos 2.5. */
  modern: string;
  /** Tamanho equivalente nos modelos antigos. */
  legacy: LegacySize;
}

/** Tamanho da prancha de motivos. */
export const SHEET_SIZE: SizePair = { modern: "2560x1712", legacy: "1536x1024" };

/** Proporções aceitas pelo modelo, com o lado maior no limite prático. */
const MODERN_SIZES: { w: number; h: number }[] = [
  { w: 2560, h: 2560 },
  { w: 2560, h: 1920 },
  { w: 1920, h: 2560 },
  { w: 2560, h: 1712 },
  { w: 1712, h: 2560 },
  { w: 2560, h: 1440 },
  { w: 1440, h: 2560 },
];

function legacyFor(w: number, h: number): LegacySize {
  if (w > h * 1.05) return "1536x1024";
  if (h > w * 1.05) return "1024x1536";
  return "1024x1024";
}

/** Escolhe a proporção suportada mais próxima da proporção real do quadro. */
export function sizeForAspect(widthCm: number, heightCm: number): SizePair {
  const target = widthCm / Math.max(0.01, heightCm);
  let best = MODERN_SIZES[0]!;
  let bestDiff = Infinity;
  for (const candidate of MODERN_SIZES) {
    const diff = Math.abs(Math.log(candidate.w / candidate.h) - Math.log(target));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return { modern: `${best.w}x${best.h}`, legacy: legacyFor(best.w, best.h) };
}

/**
 * Tamanho por família, aproveitando as bordas maiores do 2.5.
 * Corrida (rapport 30 cm) e módulos de 50 x 50 cm ficam em 2560 px.
 */
export function imageSizeFor(app: AppSpec): SizePair {
  // Coordenados de apoio: rapport de 10 cm em 1536 px, ou seja 390 dpi reais,
  // folga confortável sobre os 300 dpi de impressão pedidos, e bem mais rápido.
  if (blenderKindOf(app)) return { modern: "1536x1536", legacy: "1024x1024" };
  if (app.family !== "painel") return { modern: "2560x2560", legacy: "1024x1024" };
  const frame = frameOf(app.params ?? {});
  if (!frame) return { modern: "2560x2560", legacy: "1024x1024" };
  if (frame.shape === "circle") return { modern: "2048x2048", legacy: "1024x1024" };
  const landscape = frame.renderLandscape === true;
  const w = landscape ? Math.max(frame.widthCm, frame.heightCm) : frame.widthCm;
  const h = landscape ? Math.min(frame.widthCm, frame.heightCm) : frame.heightCm;
  return sizeForAspect(w, h);
}


/** Reforço usado na segunda tentativa, quando a composição saiu fora do pedido. */
export function reinforcementFor(app: AppSpec): string {
  const frame = frameOf(app.params ?? {});
  if (frame?.accent === "corner") {
    return "STRICT RETRY: the previous attempt was rejected. Draw ONLY one small motif cluster inside the lower-right corner, at most 20% of the width and 20% of the height. Everything else must be uniform empty background with zero marks. Absolutely no frame, no border, no scattered motifs, no centered motif.";
  }
  if (frame?.quietArea) {
    return `STRICT RETRY: the previous attempt was rejected because the center was not empty. The central ${frame.quietArea.widthCm} x ${frame.quietArea.heightCm} cm area must be completely empty background, with zero motifs, zero washes and zero marks. Keep all decoration on the outer frame only.`;
  }
  return "STRICT RETRY: follow the product format exactly, keeping the requested empty areas completely free of motifs.";
}

export function buildImagePrompt(input: {
  app: AppSpec;
  sharedDirection: string;
  pieceGuidance: string;
  overrides: Overrides;
  palette: string[];
  reinforce?: boolean;
  /** Estilo da colecao: decide se entra a modelagem botanica. */
  style?: string;
  /** Linguagem grafica secundaria da colecao, em ingles, para os prompts. */
  secondary?: string;
  /** Identidade visual escolhida pelo diretor: tecnica, fundo, layout, paleta. */
  look?: LookSpec;
}): string {
  const o = input.overrides ?? {};
  const parts = [
    formatSection(input.app, input.secondary),
    input.reinforce ? reinforcementFor(input.app) : "",
    [input.sharedDirection, input.pieceGuidance].filter(Boolean).join(" "),
    styleControls(o, input.app.family === "painel"),
    ...lookBlocks(input.look, input.app.family === "corrida"),
    `AUTHORITATIVE COLOR PALETTE, use only these colors and their tints: ${input.palette.join(", ")}.`,
    PAINTED_CONSTRAINTS,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Descrição real de cada estilo do catálogo, para o modelo de imagem. */
const STYLE_DESCRIPTIONS: Record<string, string> = {
  "aquarela-delicada":
    "hand-painted botanical watercolor in a soft delicate register: luminous transparent washes layered wet on dry, confident defined edges, fine brush detail inside every petal and leaf, visible watercolor paper grain",
  "botanico-vintage":
    "classic vintage botanical plate illustration: fine ink linework over muted layered washes, engraved feel, high botanical accuracy with every fruit and petal fully modelled",
  "ilustracao-ludica":
    "playful childlike gouache illustration, rounded simple shapes, cheerful flat colors",
  "traco-minimalista":
    "minimal line drawing, single thin continuous stroke, very few flat color fills",
};

/** Traduz o identificador do estilo em uma descrição que o modelo entende. */
export function styleDescription(style: string): string {
  const key = (style ?? "").trim();
  return STYLE_DESCRIPTIONS[key] ?? (key || STYLE_DESCRIPTIONS["aquarela-delicada"]!);
}

/**
 * Prompt da prancha de motivos: uma única pintura que abastece a coleção inteira.
 * Só entram os motivos que o diretor listou. O que a pessoa não quer é simplesmente
 * omitido, porque modelo de imagem costuma ignorar ou inverter negativa de conteúdo.
 */
export function buildMotifSheetPrompt(input: {
  motifs: string[];
  fillers: string[];
  styleDescription: string;
  sharedDirection: string;
  palette: string[];
  plainBackgroundHex?: string;
  strict?: boolean;
  /** Estilo da colecao: decide se entra a modelagem botanica. */
  style?: string;
  /** Identidade visual escolhida pelo diretor: tecnica, fundo, layout, paleta. */
  look?: LookSpec;
}): string {
  const background = input.plainBackgroundHex
    ? `Place every element over a single flat uniform ${input.plainBackgroundHex} background, exactly the same tone everywhere, with no gradient and no texture.`
    : "No background at all, fully transparent around every element.";
  const motifs = input.motifs.filter(Boolean);
  const fillers = input.fillers.filter(Boolean);
  return [
    `A clean reference sheet of isolated hand-painted ${input.styleDescription} motifs for a coordinated textile collection: ${motifs.join("; ")}${fillers.length > 0 ? `; small fillers: ${fillers.join("; ")}` : ""}. Only the listed elements, nothing else. Each element completely separated by empty space, no overlapping, no background, no shadows, no frame, no text. Palette: use only these colors and their lighter tints: ${input.palette.join(", ")}. Same brush, same hand, consistent scale.`,
    input.strict
      ? `STRICT: the sheet must contain only these elements and nothing else: ${[...motifs, ...fillers].join("; ")}. Any element outside this list is a rejection.`
      : "",
    input.sharedDirection ? `DIRECTION: ${input.sharedDirection}` : "",
    ...lookBlocks(input.look, false),
    background,
    "CONSTRAINTS: elements arranged in a loose grid with generous empty space between them, nothing touching the image edges, no text, no labels, no numbers, no watermark, no drop shadows, no mockup, flat illustration only.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Coordenados de apoio: poá, listras, xadrez e textura, também pintados pela IA. */
const BLENDER_LAYOUTS = ["dots", "stripe", "plaid", "texture"];

export function blenderKindOf(app: AppSpec): string | null {
  if (app.family !== "corrida") return null;
  const layout = String(app.params?.["layout"] ?? "");
  return BLENDER_LAYOUTS.includes(layout) ? layout : null;
}

/** Converte milímetros em porcentagem do rapport, para o modelo entender a escala. */
function pct(mm: number, rapportCm: number): string {
  return `${((mm / (rapportCm * 10)) * 100).toFixed(1)}%`;
}

/**
 * Ajusta um passo em milímetros para caber um número inteiro de períodos no tile.
 * Sem isso o desenho nunca fecha na volta e a emenda aparece.
 */
export function snapPeriod(stepMm: number, rapportCm: number): { mm: number; count: number } {
  const tileMm = rapportCm * 10;
  const count = Math.max(1, Math.round(tileMm / Math.max(0.5, stepMm)));
  return { mm: tileMm / count, count };
}

/** Clareia uma cor hex na proporção pedida, usado nas regras de cor do poá. */
export function lighten(hex: string, amount: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Coordenados chapados: nada de aquarela, pincelada ou textura de papel. */
const SOLID_SLUGS = [
  "poa-classico",
  "poa-miudo-claro",
  "xadrez-coordenado",
  "xadrez-enviesado",
  "listrado-coordenado",
  "listrado-largo",
];

export function isSolidDotApp(app: AppSpec): boolean {
  return !!app.slug && SOLID_SLUGS.includes(app.slug);
}

export interface ColorPair {
  background?: string;
  mark?: string;
}

/** Lê o par de cores que o diretor escreveu na orientação da peça. */
export function parseColorPair(guidance: string): ColorPair {
  const bg = /background color:\s*(#[0-9a-fA-F]{6})/.exec(guidance)?.[1];
  const mark = /(?:dot|stripe|mark|check) color:\s*(#[0-9a-fA-F]{6})/.exec(guidance)?.[1];
  return { ...(bg ? { background: bg } : {}), ...(mark ? { mark: mark } : {}) };
}

const NO_PAINT =
  "flat solid vector-style print, crisp edges, no watercolor, no brush strokes, no paper texture, no gradients, no noise, no shading, no outline, no floral motifs, no text, no watermark, no mockup or product photo, no drop shadows";

/** Poá chapado no padrão da loja: reticulado em losango. */
function solidDotPrompt(app: AppSpec, background: string, mark: string): string {
  const p = app.params ?? {};
  const rapport = Number(p["rapportCm"] ?? 10);
  const nnMm = Number(p["nnMm"] ?? p["spacingMm"] ?? 9);
  // No losango cada fileira desce meio passo, então o vizinho fica na diagonal.
  const snapped = snapPeriod(nnMm * Math.SQRT2, rapport);
  const dotMm = Number(p["dotMm"] ?? 2);
  return `seamless repeat tile of a flat solid vector-style polka dot print: perfectly round uniform dots of ${mark} on a solid flat ${background} ground; dots arranged in a diamond lattice, each row offset by half the horizontal spacing and dropped by half the vertical step, so the nearest neighbours of every dot sit on the diagonal; dot diameter ${pct(dotMm, rapport)} of the tile width; horizontal distance between dot centers ${pct(snapped.mm, rapport)} of the tile width, giving exactly ${snapped.count} columns and ${snapped.count * 2} rows across the tile, an exact whole number so the tile repeats seamlessly in every direction`;
}

/** Vichy chapado: três tons, como tecido de fio tinto. */
function solidPlaidPrompt(app: AppSpec, background: string, mark: string): string {
  const p = app.params ?? {};
  const rapport = Number(p["rapportCm"] ?? 10);
  const snapped = snapPeriod(Number(p["squareMm"] ?? 8) * 2, rapport);
  const cell = snapped.mm / 2;
  const bias = p["bias"] === true;
  return `seamless repeat tile of a flat solid gingham (vichy) check print in three tones: white ${background} stripes crossing ${mark} stripes, producing white squares, two light ${mark} squares and one full-strength ${mark} square at every crossing, exactly like a yarn-dyed gingham; square cell ${pct(cell, rapport)} of the tile width, giving exactly ${snapped.count * 2} squares across and down the tile, an exact whole number so it repeats seamlessly${bias ? "; the whole check is rotated 45 degrees on the bias, the squares read as diamonds" : ""}`;
}

/** Listrado chapado, sempre vertical. */
function solidStripePrompt(app: AppSpec, background: string, mark: string): string {
  const p = app.params ?? {};
  const rapport = Number(p["rapportCm"] ?? 10);
  const snapped = snapPeriod(Number(p["spacingMm"] ?? 10), rapport);
  const stripeMm = Number(p["stripeMm"] ?? 2.5);
  return `seamless repeat tile of a flat solid vertical stripe print: perfectly straight ${mark} stripes on a solid flat ${background} ground, running from the top edge to the bottom edge; stripe width ${pct(stripeMm, rapport)} of the tile width; distance between stripe centers ${pct(snapped.mm, rapport)} of the tile width, giving exactly ${snapped.count} stripes across the tile, an exact whole number so it repeats seamlessly`;
}

/** Prompt dos coordenados chapados, gerados sem a prancha de motivos. */
export function buildSolidDotPrompt(input: {
  app: AppSpec;
  pieceGuidance: string;
  palette: string[];
  overrides?: Overrides;
}): string {
  const layout = String(input.app.params?.["layout"] ?? "dots");
  const pair = parseColorPair(input.pieceGuidance);
  const background = pair.background ?? input.palette[0] ?? "#F2C744";
  const mark = pair.mark ?? "#FFFFFF";
  const body =
    layout === "plaid"
      ? solidPlaidPrompt(input.app, background, mark)
      : layout === "stripe"
        ? solidStripePrompt(input.app, background, mark)
        : solidDotPrompt(input.app, background, mark);
  return [
    body,
    `CONTRAST LEVEL: ${BLENDER_CONTRAST[levelIndex(input.overrides?.contrast)]!}.`,
    NO_PAINT,
  ].join("\n\n");
}

/** Prompt de cada coordenado pintado, com proporções em porcentagem do rapport. */
export function blenderPrompt(app: AppSpec, layout: string, style?: string): string {
  const p = app.params ?? {};
  // Aquarela pede borda mole; azulejo, jeans e afins pedem borda reta.
  const stripeEdge = isModelledStyle(style)
    ? "each stripe hand-painted with a slightly irregular living edge and visible brush drag, the density varying subtly from stripe to stripe"
    : "each stripe with a clean straight crisp edge and flat even color, never a wobbly or feathered edge";
  const rapport = Number(p["rapportCm"] ?? 10);
  if (layout === "dots") {
    const dot = pct(Number(p["dotMm"] ?? 2), rapport);
    const nn = snapPeriod(Number(p["nnMm"] ?? p["spacingMm"] ?? 9) * Math.SQRT2, rapport);
    return `seamless repeat tile of a classic textile polka dot print: perfectly uniform tiny round dots of the chosen dot color on a softly mottled watercolor wash of the chosen background color, dot diameter about ${dot} of the tile width, dots in a diamond lattice with each row offset by half the spacing and the horizontal distance between centers about ${pct(nn.mm, rapport)} of the tile width, exactly ${nn.count} columns across so the pattern continues across all four edges, soft hand-painted watercolor edge on each dot, no floral motifs, flat print artwork`;
  }
  if (layout === "stripe") {
    const w = pct(Number(p["stripeMm"] ?? 2.5), rapport);
    const gap = snapPeriod(Number(p["spacingMm"] ?? 10), rapport);
    return `seamless repeat tile of a classic textile fine stripe print: perfectly straight vertical hand-painted stripes of the chosen stripe color on a solid ground of the chosen background color, stripe width about ${w} of the tile width, spacing between stripe centers about ${pct(gap.mm, rapport)} of the tile width, exactly ${gap.count} stripes across the tile, stripes running from top to bottom so the pattern continues exactly across all four edges; ${stripeEdge}; the stripe color is printed onto the linen, so the weave stays faintly visible through it; no floral motifs, flat print artwork`;
  }
  if (layout === "plaid") {
    const snapped = snapPeriod(Number(p["squareMm"] ?? 30) * 2, rapport);
    return `seamless repeat tile of a classic hand-painted gingham check print in two colors of the palette on a light ground, with a subtle linen weave texture and soft watercolor edges on every band, square cell about ${pct(snapped.mm / 2, rapport)} of the tile width, exactly ${snapped.count * 2} squares across and down the tile so the pattern continues across all four edges, no floral motifs, flat print artwork`;
  }
  return `seamless repeat tile of a soft hand-painted watercolor paper texture in the chosen background color, gentle lighter and darker patches only, no dots, no stripes, no floral motifs, continues exactly across all four edges, flat print artwork`;
}

/** Texto do conserto de emenda, no estilo real da peça. */
export function buildSeamFixPrompt(input: { app: AppSpec; style: string }): string {
  const base =
    "repaint only the masked cross so the pattern continues perfectly across it; keep exactly the same motifs, colors, scale and rendering as the surrounding artwork; add nothing new and do not touch the outer edges";
  if (isSolidDotApp(input.app)) {
    return `${base}. The artwork is a ${NO_PAINT.split(",")[0]}: keep flat solid color, perfectly crisp edges, the same regular lattice and spacing, no watercolor, no brush strokes, no paper texture, no gradients, no shading.`;
  }
  const watercolor = /aquarela|watercolor/i.test(input.style);
  return watercolor
    ? `${base}. The artwork is hand-painted watercolor: match the same brush, the same washes and the same paper grain.`
    : `${base}. Match the exact rendering style of the surrounding artwork, whatever it is; do not switch to watercolor or to any other technique.`;
}


/** Prompt de peça montada a partir da prancha de motivos. */
export function buildFromSheetPrompt(input: {
  app: AppSpec;
  sharedDirection: string;
  pieceGuidance: string;
  overrides: Overrides;
  palette: string[];
  reinforce?: boolean;
  /** Nomes em inglês dos motivos que continuam valendo nesta coleção. */
  allowedMotifs?: string[];
  /** Estilo da colecao: decide se entra a modelagem botanica. */
  style?: string;
  /** Linguagem grafica secundaria da colecao, em ingles, para os prompts. */
  secondary?: string;
  /** Identidade visual escolhida pelo diretor: tecnica, fundo, layout, paleta. */
  look?: LookSpec;
  /** Como usar a prancha: lista de pecas (padrao) ou referencia de identidade. */
  sheetMode?: "parts" | "identity";
}): string {
  const o = input.overrides ?? {};
  const repeat = input.app.family !== "painel";
  const identity = input.sheetMode === "identity";
  const blender = blenderKindOf(input.app);
  if (isSolidDotApp(input.app)) {
    return buildSolidDotPrompt({
      app: input.app,
      pieceGuidance: input.pieceGuidance,
      palette: input.palette,
      overrides: o,
    });
  }
  if (blender) {
    return [
      blenderPrompt(input.app, blender, input.style),
      "The provided image is only a color and brushwork reference: do not copy its motifs, do not reproduce its layout, no flowers or leaves anywhere.",
      [input.sharedDirection, input.pieceGuidance].filter(Boolean).join(" "),
      "COLOR PAIR: follow exactly the background color and the mark color stated above; the marks must contrast clearly with the ground, never off-white marks on a light ground.",
      `CONTRAST LEVEL: ${BLENDER_CONTRAST[levelIndex(o.contrast)]!}.`,
      `AUTHORITATIVE COLOR PALETTE, use only these colors and their tints: ${input.palette.join(", ")}.`,
      ...lookBlocks(withoutLayout(input.look), false),
      `${PAINTED_CONSTRAINTS} No gradients other than the requested watercolor wash.`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  const allowed = (input.allowedMotifs ?? []).filter(Boolean);
  const sheetUse = identity
    ? [
        "PAINT A COMPLETE, RICH, FINISHED TEXTILE ARTWORK of this collection's subject, composed as an original piece by a professional surface designer, never assembled from stickers.",
        "The attached image is an IDENTITY REFERENCE, not a parts list. It fixes which species and objects belong to this collection, their exact colours and the hand that drew them, and that identity must be kept faithfully. But do NOT copy its small isolated icons as they are: draw every element again from scratch at full size and full detail, with real overlaps, a wide range of scale from hero to tiny, foreshortening, partial views, elements tucked behind others and elements running off the edges. The sheet says what things ARE; you decide how they are composed.",
        allowed.length > 0
          ? `ELEMENTS OF THIS COLLECTION, use these and nothing else: ${allowed.join("; ")}.`
          : "",
        repeat ? "Opposite edges must continue into each other so the tile repeats invisibly." : "",
      ]
    : [
        "USE ONLY THE MOTIFS FROM THE PROVIDED SHEET, same brushwork and palette; arrange them in a natural hand-painted textile layout with varied rotation, gentle overlaps between the listed elements and balanced density; opposite edges must continue into each other.",
        allowed.length > 0 ? `ALLOWED ELEMENTS, nothing else: ${allowed.join("; ")}.` : "",
        repeat
          ? "The provided image is a motif reference sheet, not the layout: do not copy its grid, do not keep the empty gaps, do not reproduce it. Redraw the motifs freely across the whole artwork."
          : "The provided image is a motif reference sheet, not the layout: redraw the motifs inside the requested panel composition.",
      ];
  return [
    formatSection(input.app, input.secondary),
    ...sheetUse,
    "Do not invent new elements and do not invent new colors.",
    input.reinforce ? reinforcementFor(input.app) : "",
    [input.sharedDirection, input.pieceGuidance].filter(Boolean).join(" "),
    styleControls(o, input.app.family === "painel"),
    ...lookBlocks(input.look, input.app.family === "corrida"),
    `AUTHORITATIVE COLOR PALETTE, use only these colors and their tints: ${input.palette.join(", ")}.`,
    PAINTED_CONSTRAINTS,
  ]
    .filter(Boolean)
    .join("\n\n");
}
