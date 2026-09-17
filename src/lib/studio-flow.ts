/**
 * Dados do fluxo em cinco passos do Studio (v0.7): tema, clima, uso, peça
 * principal e coleção. Tudo aqui é escolha por clique; o texto fica opcional.
 */

import { APPLICATIONS, KITS, getApplication } from "@/lib/catalog";

export interface Theme {
  id: string;
  emoji: string;
  name: string;
  /** Descrição curta em português: é ela que vira o prompt. */
  desc: string;
}

export interface ThemeGroup {
  title: string;
  themes: Theme[];
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const t = (emoji: string, name: string, desc: string): Theme => ({
  id: slug(name),
  emoji,
  name,
  desc,
});

export const THEME_GROUPS: ThemeGroup[] = [
  {
    title: "Temas gerais",
    themes: [
      t("🌷", "Jardim de Tulipas", "tulipas coloridas, folhas delicadas e pequenos botões"),
      t(
        "🍋",
        "Limões da Toscana",
        "limões sicilianos, ramos verdes, florzinhas brancas e azulejo mediterrâneo",
      ),
      t(
        "💜",
        "Lavandas da Provence",
        "ramos de lavanda, flores silvestres, listras delicadas em lilás, creme e verde",
      ),
      t("💠", "Jardim de Hortênsias", "hortênsias azuis, lilases e rosadas com folhagens suaves"),
      t(
        "🍎",
        "Romãs do Mediterrâneo",
        "romãs abertas e inteiras, folhas verde-oliva e cerâmica artesanal",
      ),
      t(
        "🍄",
        "Bosque de Cogumelos",
        "cogumelos, folhas secas, samambaias e florzinhas de floresta",
      ),
      t("🐦", "Pássaros no Jardim", "pássaros entre flores, galhos e frutos, clima romântico"),
      t("🐔", "Casa de Campo", "galinhas, flores, utensílios de cozinha e xadrez de fazenda"),
      t(
        "☕",
        "Café da Manhã",
        "xícaras, cafeteiras, pães, croissants, grãos de café e geométricos",
      ),
      t("🍒", "Cerejas Vintage", "cerejas, folhas, mini flores, poá e xadrez retrô"),
      t("🍓", "Morangos do Jardim", "morangos, flores brancas, folhas e frutinhas delicadas"),
      t("🌿", "Ervas e Temperos", "alecrim, manjericão, tomilho, sálvia e ramos de oliveira"),
      t("🌼", "Flores do Campo", "margaridas, papoulas, lavandas e flores espontâneas"),
      t("🌴", "Jardim Tropical", "costela-de-adão, helicônias, bananeira e hibiscos"),
      t("🐚", "Fundo do Mar", "conchas, estrelas-do-mar, corais e cavalos-marinhos"),
      t("🏖️", "Praia Brasileira", "coqueiros, conchas, ondas, guarda-sóis e folhagens"),
      t(
        "🧵",
        "Costura com Afeto",
        "máquinas de costura antigas, carretéis, botões, tesouras e fitas",
      ),
    ],
  },
  {
    title: "Datas comemorativas",
    themes: [
      t(
        "🎭",
        "Carnaval Brasileiro",
        "confetes, serpentinas, máscaras e flores tropicais vibrantes",
      ),
      t("🐰", "Páscoa no Jardim", "coelhos, ovos decorados, cenouras e flores em tons pastel"),
      t("🧺", "Páscoa Campestre", "coelhos, cestas, palha, flores silvestres e xadrez"),
      t("🍫", "Páscoa Doce", "chocolates, cupcakes, ovos e confeitos lúdicos"),
      t("💌", "Dia dos Namorados", "corações, rosas, cartas e tons de vinho e rosa"),
      t(
        "🌽",
        "Festa Junina Tradicional",
        "bandeirinhas, balões, fogueira, milho, chapéu de palha e xadrez",
      ),
      t("🎀", "Arraiá Floral", "flores do campo, bandeirinhas, chita e fitas, mais sofisticado"),
      t("👻", "Halloween Fofo", "fantasminhas, abóboras, gatinhos pretos, estrelas e doces"),
      t("🎃", "Halloween Vintage", "abóboras antigas, luas, bruxas e corvos, estética retrô"),
      t("🎄", "Natal Tradicional", "pinheiros, bolas, presentes, sinos, vermelho com verde"),
      t("🌲", "Natal Botânico", "pinheiros, azevinho, pinhas e frutas vermelhas, discreto"),
      t("🍪", "Natal Doce", "biscoitos de gengibre, bengalas, casinhas e presentes"),
      t("🥂", "Réveillon Elegante", "estrelas, fogos, taças e confetes em branco, dourado e prata"),
    ],
  },
];

export const ALL_THEMES: Theme[] = THEME_GROUPS.flatMap((g) => g.themes);

export function findTheme(id: string | null | undefined): Theme | undefined {
  return ALL_THEMES.find((th) => th.id === id);
}

/** Clima visual: a técnica de desenho, mostrada com uma amostra de cores. */
export interface Climate {
  id: string;
  name: string;
  /** Uma linha em português, para a artesã escolher olhando. */
  hint: string;
  /** Bloco TECHNIQUE em inglês, entra no prompt como está. */
  en: string;
  /** Quatro cores da amostra do cartão (não limitam a paleta). */
  swatch: [string, string, string, string];
  /** Técnica de borda mole: muda o desenho da listra pintada. */
  soft?: boolean;
}

export const CLIMATES: Climate[] = [
  {
    id: "aquarela-delicada",
    name: "Aquarela delicada",
    hint: "lavada e leve, borda mole, muito fundo",
    en: "loose watercolour. Soft wet-in-wet edges, visible pigment blooms and granulation, transparent layered washes, no black outlines, light pencil sketch lines showing under the paint in places.",
    swatch: ["#F8F2EC", "#D9A5A0", "#9DB59A", "#C9B8D6"],
    soft: true,
  },
  {
    id: "chita-brasileira",
    name: "Chita brasileira",
    hint: "cores cheias, contorno escuro, cara de feira",
    en: "chita brasileira. Flat saturated colour areas, no gradients, bold dark outlines, naive drawing, decorative flourishes around the main motifs. Each shape is one flat colour.",
    swatch: ["#F4E9D2", "#C8552E", "#E1A62B", "#2F6B4F"],
  },
  {
    id: "xilogravura",
    name: "Xilogravura de cordel",
    hint: "traço de goiva, hachuras, papel cru",
    en: "woodcut in the cordel tradition (xilogravura). Bold carved outlines with slight roughness, flat colour blocks inside them, hatched shading made of parallel carved lines, naive drawing.",
    swatch: ["#EFE3C8", "#1F1B18", "#B8422C", "#D8A23B"],
  },
  {
    id: "guache",
    name: "Guache opaco",
    hint: "fosco, pincelada visível, sem contorno",
    en: "opaque gouache. Matte flat paint with visible brush edges, slightly uneven coverage, no outlines, colours mixed on the brush, a hand-painted poster feel.",
    swatch: ["#F1EDE4", "#E07A5F", "#3D405B", "#81B29A"],
  },
  {
    id: "azulejo",
    name: "Azulejo português",
    hint: "azul cobalto sobre branco, arabescos",
    en: "Portuguese azulejo tile painting. Cobalt blue on white glaze, brushed shading in three values of blue, ornamental arabesque borders, slight glaze bleed at the edges. The whole print is blue and white only.",
    swatch: ["#F6F7F4", "#1B3F8B", "#4A73C2", "#A9C1E8"],
  },
  {
    id: "botanico-vintage",
    name: "Botânico vintage",
    hint: "gravura científica colorida à mão",
    en: "vintage botanical engraving, hand-tinted. Fine ink hatching for volume, delicate coloured washes on top, precise natural drawing, an aged paper feel without any text.",
    swatch: ["#F3EBD9", "#7A8C5B", "#B7643F", "#4A3B2E"],
    soft: true,
  },
  {
    id: "traco-fino",
    name: "Traço fino",
    hint: "linha única, poucas cores, muito ar",
    en: "fine single-weight line drawing. Thin consistent ink line, two or three flat spot colours slightly offset from the line, lots of quiet ground, modern and clean.",
    swatch: ["#FFFFFF", "#2B2B2B", "#F2B84B", "#7FB3A5"],
  },
  {
    id: "ponto-cruz",
    name: "Bordado ponto-cruz",
    hint: "pontinhos de linha, ar de enxoval",
    en: "cross-stitch embroidery look. Every motif built from tiny stitched squares on an even grid, thread texture visible, a limited palette of floss colours, on a plain linen-coloured ground.",
    swatch: ["#EFE7D8", "#B23A48", "#3E6B48", "#2E4A7D"],
  },
  {
    id: "retro-50",
    name: "Retrô anos 50",
    hint: "cores chapadas, registro deslocado, alegre",
    en: "mid-century retro illustration. Flat colours with a slight print misregistration, a halftone-like dot texture in shaded areas, cheerful simplified shapes, cream ground.",
    swatch: ["#FBF3E1", "#E63946", "#2A9D8F", "#F4A261"],
  },
  {
    id: "lousa",
    name: "Giz sobre lousa",
    hint: "fundo preto, traço de giz colorido",
    en: "chalk drawing on a blackboard. Matte black ground, motifs drawn in white and coloured chalk with soft dusty strokes, slight chalk smudges, no letters.",
    swatch: ["#1E1F1C", "#F5F1E6", "#E9C46A", "#8AB6D6"],
  },
  {
    id: "recorte",
    name: "Recorte de papel",
    hint: "papéis coloridos, tesoura, camadas",
    en: "paper cut-out collage. Motifs cut from flat coloured papers with crisp scissor edges, layered with tiny paper shadows, textured paper grain, playful simplified shapes.",
    swatch: ["#FDF6EC", "#F28482", "#84A59D", "#F6BD60"],
  },
  {
    id: "aquarela-vibrante",
    name: "Aquarela vibrante",
    hint: "molhada, saturada, papel branco",
    en: "vibrant watercolour. Juicy saturated washes bleeding into each other, hard-edged blooms, white paper left as highlights, no outlines.",
    swatch: ["#FFFFFF", "#E5397B", "#2EC4B6", "#FF9F1C"],
    soft: true,
  },
];

export function findClimate(id: string | null | undefined): Climate | undefined {
  return CLIMATES.find((c) => c.id === id);
}

/** Uso da coleção: um kit de peças já marcado, que a artesã só desmarca. */
export interface UsageCard {
  usage: string;
  emoji: string;
  name: string;
  applicationIds: string[];
}

const USAGE_EMOJI: Record<string, string> = {
  "mesa-posta": "🍽️",
  "costura-criativa": "🧵",
  "enxoval-infantil": "🍼",
  "bolsas-acessorios": "👜",
  barrado: "🧻",
};

export const USAGES: UsageCard[] = KITS.filter((k) => USAGE_EMOJI[k.usage]).map((k) => ({
  usage: k.usage,
  emoji: USAGE_EMOJI[k.usage]!,
  name: k.name,
  applicationIds: k.applicationIds,
}));

/** Estampa corrida grande do kit, que faz o papel de peça principal. */
export function principalAppFor(applicationIds: string[]): string {
  // Preferência: a estampa principal do catálogo, depois a toalha, depois
  // qualquer corrida grande do kit.
  for (const preferred of ["estampa-principal", "toalha-de-mesa"]) {
    if (applicationIds.includes(preferred)) return preferred;
  }
  for (const id of applicationIds) {
    const app = getApplication(id);
    if (!app || app.family !== "corrida") continue;
    if (app.params.layout === "tossed" && app.params.rapportCm >= 25) return id;
  }
  return "estampa-principal";
}

/** Peças do kit, sem a principal, na ordem do catálogo. */
export function coordinateAppsFor(applicationIds: string[]): string[] {
  const principal = principalAppFor(applicationIds);
  return applicationIds.filter((id) => id !== principal && getApplication(id));
}

export const PRINCIPAL_NAME = (id: string) => getApplication(id)?.name ?? "Estampa principal";

/** Botões de ajuste da peça principal. Cada um vira um bloco em inglês. */
export const ADJUSTMENT_GROUPS: { id: string; label: string }[] = [
  { id: "estilo", label: "Estilo" },
  { id: "acabamento", label: "Acabamento" },
  { id: "cor", label: "Cores" },
  { id: "escala", label: "Tamanho dos motivos" },
  { id: "densidade", label: "Preenchimento" },
  { id: "fundo", label: "Fundo" },
  { id: "paleta", label: "Paleta" },
];

export interface Adjustment {
  id: string;
  label: string;
  /** Ajustes do mesmo grupo se excluem: "mais cheio" tira "mais vazio". */
  group: string;
  en: string;
}

export const ADJUSTMENTS: Adjustment[] = [
  // Estilo: o acabamento geral, calibrado nas coleções da Casa Criativa
  // (aquarela realista sobre linho, muito respiro, paleta contida).
  {
    id: "estilo-clean",
    label: "Clean",
    group: "estilo",
    en: "STYLE: clean and airy. About half of the canvas is plain ground; motifs are spaced calmly with generous breathing room, only two or three colours plus greens, nothing crowded, no fillers scattered everywhere. This replaces any density instruction above.",
  },
  {
    id: "estilo-sofisticado",
    label: "Sofisticado",
    group: "estilo",
    en: "STYLE: sophisticated and refined, in the manner of premium home-textile collections: realistic delicate rendering with soft natural shading and no outlines, a restrained palette of two or three colours plus greens, calm spacing with plain ground showing between motif groups, elegant restraint over abundance.",
  },
  {
    id: "estilo-rustico",
    label: "Rústico",
    group: "estilo",
    en: "STYLE: rustic farmhouse. Warm natural linen-coloured ground, earthy palette (olive, terracotta, mustard, denim blue), a hand-painted feel, with thin stripes or a small gingham check as the secondary language.",
  },
  {
    id: "estilo-vintage",
    label: "Vintage",
    group: "estilo",
    en: "STYLE: vintage. Aged cream ground, faded and muted colours as if printed decades ago, old-fashioned botanical drawing with small ornamental flourishes, a slight softness of worn print.",
  },
  {
    id: "estilo-romantico",
    label: "Romântico",
    group: "estilo",
    en: "STYLE: romantic. Soft pinks, powder blues and creams, blooming flowers with ribbons and bows woven between them, gentle light, delicate fine details.",
  },
  {
    id: "estilo-ludico",
    label: "Lúdico",
    group: "estilo",
    en: "STYLE: playful and cute. Rounded, simplified characters and objects with friendly expressions, soft cheerful pastel colours, small hearts and stars as fillers, made for children's and festive lines.",
  },
  {
    id: "estilo-chic-escuro",
    label: "Chic escuro",
    group: "estilo",
    en: "STYLE: modern dark chic. Deep charcoal or navy ground, large dramatic blooms and leaves in rich saturated colours with cream highlights, editorial elegance, few but generous motifs.",
  },
  {
    id: "acabamento-linho",
    label: "Linho visível",
    group: "acabamento",
    en: "FINISH: the ground shows a faint natural linen weave, like a printed cotton-linen fabric seen up close; the texture is very subtle and even, and the printed colours stay flat on top of it.",
  },
  {
    id: "acabamento-liso",
    label: "Liso",
    group: "acabamento",
    en: "FINISH: perfectly smooth flat ground with no fabric or paper texture at all.",
  },
  {
    id: "mais-colorido",
    label: "Mais colorido",
    group: "cor",
    en: "COLOUR: raise the saturation one step and use the full palette boldly, adding one extra bright accent colour.",
  },
  {
    id: "mais-suave",
    label: "Mais suave",
    group: "cor",
    en: "COLOUR: lower the saturation one step, lighter and softer tones; if there are outlines, make them dark brown instead of black.",
  },
  {
    id: "motivos-maiores",
    label: "Maiores",
    group: "escala",
    en: "SCALE: draw the hero motifs larger, the biggest hero spanning about a third of the canvas, with fewer repetitions.",
  },
  {
    id: "motivos-menores",
    label: "Menores",
    group: "escala",
    en: "SCALE: draw every motif smaller, the biggest hero spanning about a sixth of the canvas, with more repetitions and finer detail.",
  },
  {
    id: "mais-cheio",
    label: "Mais cheio",
    group: "densidade",
    en: "DENSITY: pack the composition tighter, the ground visible only as thin gaps between motifs.",
  },
  {
    id: "mais-vazio",
    label: "Mais vazio",
    group: "densidade",
    en: "DENSITY: open the composition up, about a third of the canvas is plain ground and the motifs breathe.",
  },
  {
    id: "fundo-escuro",
    label: "Escuro",
    group: "fundo",
    en: "GROUND OVERRIDE: paint the ground in a deep dark colour that suits the palette (navy, charcoal, bottle green or wine) and lighten the motifs so they read clearly on it.",
  },
  {
    id: "fundo-claro",
    label: "Claro",
    group: "fundo",
    en: "GROUND OVERRIDE: paint the ground in a light cream or soft white, with the motifs clearly darker than the ground.",
  },
  {
    id: "outra-paleta",
    label: "Trocar as cores",
    group: "paleta",
    en: "PALETTE OVERRIDE: choose a different but equally harmonious palette for the same subject and technique, clearly distinct from the one described above.",
  },
];

export function findAdjustment(id: string): Adjustment | undefined {
  return ADJUSTMENTS.find((a) => a.id === id);
}

/** Liga ou desliga um ajuste, tirando o oposto do mesmo grupo. */
export function toggleAdjustment(current: string[], id: string): string[] {
  const adj = findAdjustment(id);
  if (!adj) return current;
  if (current.includes(id)) return current.filter((x) => x !== id);
  const without = current.filter((x) => findAdjustment(x)?.group !== adj.group);
  return [...without, id];
}

/** Nome amigável de um app do catálogo, com a medida. */
export function appLabel(id: string): string {
  const app = APPLICATIONS.find((a) => a.id === id);
  return app?.name ?? id;
}

/** Bloco de ajustes escolhidos por clique, em inglês. */
export function adjustmentsBlock(ids: string[]): string {
  const lines = ids.map((id) => findAdjustment(id)?.en).filter((s): s is string => Boolean(s));
  if (lines.length === 0) return "";
  return `ADJUSTMENTS (these override anything above that conflicts with them):\n${lines.join("\n")}`;
}

/** Prompt final da peça principal: molde + ajustes, com o RENDER por último. */
export function buildPrincipalPrompt(master: string, adjustments: string[]): string {
  const clean = master.trim();
  const block = adjustmentsBlock(adjustments);
  if (!block) return clean;
  const idx = clean.lastIndexOf("RENDER:");
  if (idx < 0) return `${clean}\n\n${block}`;
  return `${clean.slice(0, idx).trimEnd()}\n\n${block}\n\n${clean.slice(idx)}`;
}
