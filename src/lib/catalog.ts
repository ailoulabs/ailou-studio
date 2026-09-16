/**
 * Catálogo de aplicações do AiLou Studio.
 * Por enquanto dados locais tipados. Na próxima etapa vira tabela no backend.
 */

export type Family = "corrida" | "barrado" | "painel";

export type SuggestedRole = "principal" | "coordenado" | "apoio";

export type CorridaLayout =
  | "tossed"
  | "half-drop"
  | "brick"
  | "grid"
  | "stripe"
  | "dots"
  | "plaid"
  | "texture";

export interface CorridaParams {
  rapportCm: number;
  layout: CorridaLayout;
  /** Poá: clássico (bolinha clara em cor cheia), miúdo em fundo claro ou aquarelado. */
  dotVariant?: "classic" | "fine" | "watercolor";
  dotMm?: number;
  /** Distância ao vizinho mais próximo no reticulado em losango. */
  nnMm?: number;
  spacingMm?: number;
  grid?: "square" | "half-drop" | "diamond";
  stripeMm?: number;
  squareMm?: number;
  /** Xadrez girado 45 graus, os quadrados viram losangos. */
  bias?: boolean;
}

/** Barrinha decorativa que separa as faixas do barrado múltiplo. */
export type TrimStyle = "renda" | "vichy" | "fita" | "azulejo" | "ramo";

/** Fundo de cada faixa ilustrada. */
export type BandGround = "creme" | "clara" | "vichy" | "cheia";

export interface BarradoParams {
  bands: number;
  bandHeightCm: number;
  borderPosition: "bottom" | "both";
  /** Altura de cada faixa, em ordem, de cima para baixo. Soma com as barrinhas dá o corte. */
  bandHeightsCm?: number[];
  /** Altura da barrinha entre as faixas, de 0,7 a 1,5 cm. */
  trimCm?: number;
  trimStyle?: TrimStyle;
  /** Fundo de cada faixa, na mesma ordem de bandHeightsCm. */
  grounds?: BandGround[];
  /** Margem lisa em cima e embaixo do corte. */
  marginCm?: number;
  /** Barrado único: barrinha de acabamento acima da faixa principal. */
  borderHeightCm?: number;
}


export interface QuietArea {
  shape: "rect" | "circle";
  widthCm: number;
  heightCm: number;
}

export interface FrameSpec {
  count: number;
  widthCm: number;
  heightCm: number;
  shape: "rect" | "circle";
  marginCm: number;
  quietArea?: QuietArea;
  backgroundStyle: "plain" | "coordinate";
  /** Acento decorativo em um único canto, o resto do quadro fica liso. */
  accent?: "corner";
  /** Arte gerada deitada e girada 90 graus na montagem do corte. */
  renderLandscape?: boolean;
}


export interface PainelParams {
  frames: FrameSpec;
}

interface ApplicationBase {
  id: string;
  slug: string;
  name: string;
  description: string;
  fabricWidthCm: number;
  cutLengthCm: number;
  suggestedRole: SuggestedRole;
  directorRules: string;
}

export type Application =
  | (ApplicationBase & { family: "corrida"; params: CorridaParams })
  | (ApplicationBase & { family: "barrado"; params: BarradoParams })
  | (ApplicationBase & { family: "painel"; params: PainelParams });

export const FAMILY_LABEL: Record<Family, string> = {
  corrida: "Estampa corrida",
  barrado: "Barrado",
  painel: "Painel",
};

export const FAMILY_ORDER: Family[] = ["corrida", "barrado", "painel"];

export const LAYOUT_LABEL: Record<CorridaLayout, string> = {
  tossed: "Motivos soltos",
  "half-drop": "Meio salto",
  brick: "Tijolinho",
  grid: "Grade",
  stripe: "Listras",
  dots: "Poá",
  plaid: "Xadrez",
  texture: "Textura",
};

export const ROLE_LABEL: Record<SuggestedRole, string> = {
  principal: "PRINCIPAL",
  coordenado: "COORDENADO",
  apoio: "APOIO",
};

const W = 150;
const CUT = 50;

export const APPLICATIONS: Application[] = [
  // ---------- Corrida ----------
  {
    id: "estampa-principal",
    slug: "estampa-principal",
    name: "Estampa principal",
    family: "corrida",
    description: "A estampa que dá o tom da coleção, com os desenhos maiores e mais coloridos.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "principal",
    directorRules:
      "Motivos grandes bem distribuídos, com respiro entre eles. Usa toda a paleta e concentra o colorido da coleção.",
    params: { rapportCm: 30, layout: "tossed" },
  },
  {
    id: "delicadeza-miniatura",
    slug: "delicadeza-miniatura",
    name: "Delicadeza em miniatura",
    family: "corrida",
    description: "Os mesmos desenhos, bem pequenininhos, para forros e detalhes.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "coordenado",
    directorRules:
      "Versão miúda dos motivos principais, distribuição densa e uniforme, sem elementos dominantes.",
    params: { rapportCm: 20, layout: "tossed" },
  },
  {
    id: "ramos-detalhes",
    slug: "ramos-detalhes",
    name: "Ramos e detalhes",
    family: "corrida",
    description: "Folhas e raminhos em meio salto, para dar movimento sem competir.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "coordenado",
    directorRules:
      "Somente folhagem e elementos secundários, em meio salto, com contraste médio e fundo claro.",
    params: { rapportCm: 25, layout: "half-drop" },
  },
  {
    id: "listrado-coordenado",
    slug: "listrado-coordenado",
    name: "Listrado coordenado",
    family: "corrida",
    description: "Listras finas nas cores da coleção, ótimas para vieses e alças.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Listras verticais chapadas de 2,5 mm a cada 10 mm, em duas cores sólidas da paleta, bordas nítidas. Escreva background color: #RRGGBB e stripe color: #RRGGBB. Sem motivos figurativos, sem aquarela.",
    params: { rapportCm: 10, layout: "stripe", stripeMm: 2.5, spacingMm: 10 },
  },
  {
    id: "listrado-largo",
    slug: "listrado-largo",
    name: "Listrado largo",
    family: "corrida",
    description: "Listras chapadas de 8 mm a cada 16 mm, com ar de toalha de feira.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Listras verticais chapadas de 8 mm a cada 16 mm, em duas cores sólidas da paleta, bordas nítidas. Escreva background color: #RRGGBB e stripe color: #RRGGBB. Sem aquarela.",
    params: { rapportCm: 16, layout: "stripe", stripeMm: 8, spacingMm: 16 },
  },
  {
    id: "poa-delicado",
    slug: "poa-classico",
    name: "Poá clássico",
    family: "corrida",
    description: "Bolinhas brancas miúdas em fundo de cor cheia, o poá clássico da tricoline.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Fundo em cor cheia e saturada da paleta, nunca branco. Bolinhas em branco #FFFFFF, creme #FFF6E5 ou um tom 45% mais claro do fundo. Bolinhas redondas de 2 mm em reticulado losangular com 9 mm até o vizinho mais próximo. Escreva background color: #RRGGBB e dot color: #RRGGBB. Sem motivos florais, sem aquarela.",
    params: {
      rapportCm: 10,
      layout: "dots",
      dotVariant: "classic",
      dotMm: 2,
      nnMm: 9,
      grid: "diamond",
    },
  },
  {
    id: "poa-miudo-claro",
    slug: "poa-miudo-claro",
    name: "Poá miúdo em fundo claro",
    family: "corrida",
    description: "Bolinhas de 1,5 mm em cor cheia sobre fundo claro, em reticulado losangular.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Aqui a regra inverte: fundo na cor clara da paleta e bolinhas na cor cheia, com contraste nítido, nunca off-white sobre claro. Bolinhas de 1,5 mm em reticulado losangular com 7 mm até o vizinho mais próximo. Escreva background color: #RRGGBB e dot color: #RRGGBB. Sem aquarela.",
    params: {
      rapportCm: 10,
      layout: "dots",
      dotVariant: "fine",
      dotMm: 1.5,
      nnMm: 7,
      grid: "diamond",
    },
  },
  {
    id: "poa-aquarela",
    slug: "poa-aquarela",
    name: "Poá aquarela",
    family: "corrida",
    description: "Bolinhas brancas de 2 mm sobre fundo aquarelado manchado na cor da paleta.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Fundo em lavagem de aquarela manchada na cor cheia da paleta, com áreas mais claras e mais escuras, e bolinhas brancas de 2 mm em reticulado losangular com 9 mm até o vizinho mais próximo.",
    params: {
      rapportCm: 10,
      layout: "dots",
      dotVariant: "watercolor",
      dotMm: 2,
      nnMm: 9,
      grid: "diamond",
    },
  },
  {
    id: "xadrez-coordenado",
    slug: "xadrez-coordenado",
    name: "Xadrez coordenado",
    family: "corrida",
    description: "Vichy de 8 mm em três tons, com cara de pano de cozinha.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Vichy chapado de quadrados de 8 mm em três tons: branco, o tom claro da cor e a cor cheia no cruzamento, como tecido de fio tinto. Bordas nítidas. Escreva background color: #FFFFFF e check color: #RRGGBB. Sem aquarela, sem motivos figurativos.",
    params: { rapportCm: 9.6, layout: "plaid", squareMm: 8 },
  },
  {
    id: "xadrez-enviesado",
    slug: "xadrez-enviesado",
    name: "Xadrez enviesado",
    family: "corrida",
    description: "O mesmo vichy girado 45 graus, quadrados de 15 mm virando losangos.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Vichy chapado de quadrados de 15 mm girado 45 graus, em três tons como o xadrez coordenado. Escreva background color: #FFFFFF e check color: #RRGGBB. Sem aquarela.",
    params: { rapportCm: 15, layout: "plaid", squareMm: 15, bias: true },
  },
  {
    id: "xadrez-aquarela",
    slug: "xadrez-aquarela",
    name: "Xadrez aquarela",
    family: "corrida",
    description: "Xadrez pintado de 30 mm com textura de linho, para coleções em aquarela.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Xadrez pintado de quadrados de 30 mm em duas cores da paleta sobre fundo claro, com bordas de aquarela e textura sutil de linho.",
    params: { rapportCm: 30, layout: "plaid", squareMm: 30 },
  },

  {
    id: "textura-suave",
    slug: "textura-suave",
    name: "Textura suave",
    family: "corrida",
    description: "Um fundo texturizado quase liso, para dar descanso visual.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules: "Textura orgânica de baixo contraste, sem desenho reconhecível.",
    params: { rapportCm: 20, layout: "texture" },
  },
  {
    id: "toalha-de-mesa",
    slug: "toalha-de-mesa",
    name: "Toalha de mesa",
    family: "corrida",
    description: "Estampa corrida arejada, pensada para cobrir a mesa inteira.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "coordenado",
    directorRules:
      "Motivos médios bem espaçados, muito fundo à mostra, para não pesar em grandes áreas.",
    params: { rapportCm: 30, layout: "tossed" },
  },

  // ---------- Barrado ----------
  {
    id: "barrado-unico",
    slug: "barrado-unico",
    name: "Barrado único",
    family: "barrado",
    description: "Um corte com uma borda decorada de 15 cm na base e área calma acima.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "coordenado",
    directorRules:
      "Borda decorada de cerca de 15 cm na base, em duas camadas: a faixa principal de motivos e, logo acima dela, uma barrinha estreita de acabamento. Acima fica uma área calma quase lisa. A repetição se resolve na horizontal, sem motivo cortado nas laterais.",
    params: {
      bands: 1,
      bandHeightCm: 15,
      borderPosition: "bottom",
      trimCm: 1.2,
      trimStyle: "renda",
      borderHeightCm: 15,
    },
  },
  {
    id: "barrado-multiplo",
    slug: "barrado-multiplo",
    name: "Barrado múltiplo",
    family: "barrado",
    description: "Corte de 50 × 150 cheio de faixas ilustradas para recortar e costurar.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "principal",
    directorRules:
      "Descreva faixa por faixa, de cima para baixo: o tema de cada uma, o fundo e a barrinha que separa uma da outra. Cada faixa é independente, com os motivos em fileira, e se repete da esquerda para a direita sem cortar nenhum desenho. Mesma paleta e mesmo jeito de pintar em todas.",
    params: {
      bands: 5,
      bandHeightCm: 9,
      borderPosition: "bottom",
      bandHeightsCm: [9, 9, 9, 9, 9],
      trimCm: 1,
      trimStyle: "renda",
      grounds: ["creme", "clara", "creme", "cheia", "creme"],
      marginCm: 0.5,
    },
  },

  {
    id: "trilho-de-mesa",
    slug: "trilho-de-mesa",
    name: "Trilho de mesa",
    family: "corrida",
    description: "Mesma estampa corrida da toalha, cortada mais comprida e estreita.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "coordenado",
    directorRules:
      "Estampa corrida igual a da toalha de mesa, motivos espalhados por toda a area, sem borda e sem centro vazio. O que muda em relacao a toalha e so o corte, mais comprido e estreito.",
    params: { layout: "tossed", rapportCm: 30 },
  },

  // ---------- Painel ----------
  {
    id: "jogo-americano",
    slug: "jogo-americano",
    name: "Jogo americano",
    family: "painel",
    description: "Quatro jogos americanos posicionados em um corte, prontos para recortar e costurar.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "principal",
    directorRules:
      "Quatro quadros iguais de 50 cm de largura por 37,5 de altura, desenhados deitados. Moldura ou filete a cerca de 2 cm da borda, buquês ou frutas em dois cantos opostos ou nos quatro cantos, centro calmo com textura discreta de linho e a área do prato de 26 cm totalmente livre. Texto manuscrito curto e selos só quando o tema pedir.",
    params: {
      frames: {
        count: 4,
        widthCm: 37.5,
        heightCm: 50,
        shape: "rect",
        marginCm: 2,
        quietArea: { shape: "rect", widthCm: 26, heightCm: 26 },
        backgroundStyle: "coordinate",
        renderLandscape: true,
      },
    },

  },
  {
    id: "capa-de-almofada",
    slug: "capa-de-almofada",
    name: "Capa de almofada",
    family: "painel",
    description: "Três frentes de almofada de 50 × 50 cm no mesmo corte.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "coordenado",
    directorRules:
      "Três quadros de 50 × 50 com composição centralizada e fundo coordenado com a estampa principal.",
    params: {
      frames: {
        count: 3,
        widthCm: 50,
        heightCm: 50,
        shape: "rect",
        marginCm: 1.5,
        backgroundStyle: "coordinate",
      },
    },
  },
  {
    id: "guardanapo",
    slug: "guardanapo",
    name: "Guardanapo",
    family: "painel",
    description: "Três guardanapos de 50 × 50 cm com um acento em um dos cantos.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Três quadros de 50 × 50 com fundo liso e um único acento decorativo no canto inferior direito, sem moldura e sem nada no restante do quadro.",
    params: {
      frames: {
        count: 3,
        widthCm: 50,
        heightCm: 50,
        shape: "rect",
        marginCm: 1.5,
        backgroundStyle: "plain",
        accent: "corner",
      },
    },
  },
  {
    id: "capa-de-sousplat",
    slug: "capa-de-sousplat",
    name: "Capa de sousplat",
    family: "painel",
    description: "Quatro círculos de 35 cm para cobrir o sousplat.",
    fabricWidthCm: W,
    cutLengthCm: CUT,
    suggestedRole: "apoio",
    directorRules:
      "Quatro quadros redondos de 35 cm, composição radial simples e fundo liso.",
    params: {
      frames: {
        count: 4,
        widthCm: 35,
        heightCm: 35,
        shape: "circle",
        marginCm: 2,
        backgroundStyle: "plain",
      },
    },
  },
];

export interface Kit {
  usage: string;
  name: string;
  applicationIds: string[];
}

export const KITS: Kit[] = [
  {
    usage: "mesa-posta",
    name: "Mesa posta e cozinha",
    applicationIds: [
      "jogo-americano",
      "trilho-de-mesa",
      "toalha-de-mesa",
      "guardanapo",
      "poa-delicado",
    ],
  },
  {
    usage: "barrado",
    name: "Barrado",
    applicationIds: [
      "barrado-multiplo",
      "barrado-unico",
      "estampa-principal",
      "xadrez-coordenado",
      "poa-delicado",
    ],
  },
  {
    usage: "cozinha",

    name: "Cozinha",
    applicationIds: [
      "barrado-multiplo",
      "barrado-unico",
      "estampa-principal",
      "xadrez-coordenado",
      "poa-delicado",
    ],
  },
  {
    usage: "costura-criativa",
    name: "Costura criativa e patchwork",
    applicationIds: [
      "estampa-principal",
      "delicadeza-miniatura",
      "ramos-detalhes",
      "listrado-coordenado",
      "poa-delicado",
    ],
  },
  {
    usage: "enxoval-infantil",
    name: "Enxoval infantil",
    applicationIds: [
      "estampa-principal",
      "delicadeza-miniatura",
      "capa-de-almofada",
      "barrado-unico",
      "poa-miudo-claro",
    ],
  },
  {
    usage: "bolsas-acessorios",
    name: "Bolsas e acessórios",
    applicationIds: [
      "estampa-principal",
      "delicadeza-miniatura",
      "listrado-coordenado",
      "capa-de-almofada",
      "poa-miudo-claro",
    ],
  },
];

export function getApplication(id: string, list: Application[] = APPLICATIONS) {
  return list.find((a) => a.id === id);
}

export function kitFor(usage: string): string[] {
  return KITS.find((k) => k.usage === usage)?.applicationIds ?? [];
}

/** Quantas peças o corte rende. */
export function yieldCount(app: Application): number {
  if (app.family === "painel") return app.params.frames.count;
  if (app.family === "barrado") return app.params.bands;
  return 0;
}

export interface BandSlot {
  kind: "margem" | "faixa" | "barrinha";
  heightCm: number;
  index?: number;
}

/**
 * Plano do corte de barrado, de cima para baixo:
 * margem, faixa, barrinha, faixa, ..., margem.
 */
export function bandPlan(app: Application): BandSlot[] {
  if (app.family !== "barrado") return [];
  const p = app.params;
  const heights =
    p.bandHeightsCm && p.bandHeightsCm.length === p.bands
      ? p.bandHeightsCm
      : Array.from({ length: p.bands }, () => p.bandHeightCm);
  const trim = p.trimCm ?? 0;
  const margin = p.marginCm ?? 0;
  const slots: BandSlot[] = [];
  if (margin > 0) slots.push({ kind: "margem", heightCm: margin });
  heights.forEach((h, i) => {
    if (i > 0 && trim > 0) slots.push({ kind: "barrinha", heightCm: trim });
    slots.push({ kind: "faixa", heightCm: h, index: i + 1 });
  });
  if (margin > 0) slots.push({ kind: "margem", heightCm: margin });
  return slots;
}

/** Linha de medida mostrada na interface. */
export function measureLabel(app: Application): string {
  if (app.family === "corrida") {
    return `Rapport ${fmt(app.params.rapportCm)} × ${fmt(app.params.rapportCm)} cm`;
  }
  const cut = `Corte ${fmt(app.cutLengthCm)} × ${fmt(app.fabricWidthCm)} cm`;
  const n = yieldCount(app);
  if (app.family === "barrado") {
    const heights = bandPlan(app)
      .filter((s) => s.kind === "faixa")
      .map((s) => s.heightCm);
    const uniform = heights.every((h) => h === heights[0]);
    const desc = uniform
      ? `de ${fmt(heights[0] ?? app.params.bandHeightCm)} cm`
      : `de ${heights.map(fmt).join(", ")} cm`;
    return `${cut} · ${n} ${n === 1 ? "faixa" : "faixas"} ${desc}`;
  }
  return `${cut} · rende ${n} ${n === 1 ? "peça" : "peças"}`;
}


export function fmt(n: number): string {
  return String(n).replace(".", ",");
}
