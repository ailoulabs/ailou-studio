/**
 * Tipos e dados simulados do AiLou Studio.
 * Sem chamadas de rede: os servicos reais entram depois em src/lib/api.
 */

import {
  APPLICATIONS,
  getApplication,
  kitFor,
  measureLabel,
  type Application,
  type SuggestedRole,
} from "@/lib/catalog";

export type DrawingStyle =
  | "aquarela-delicada"
  | "botanico-vintage"
  | "ilustracao-ludica"
  | "traco-minimalista";

export type Usage =
  | "costura-criativa"
  | "mesa-posta"
  | "cozinha"
  | "barrado"
  | "bolsas-acessorios"
  | "enxoval-infantil";


export type PieceRole = SuggestedRole;

/** Máquina de estados da coleção. */
export type CollectionStage = "rascunho" | "proposta" | "motivos" | "montagem" | "pronta";

export type PieceStatus = "pendente" | "gerando" | "pronta" | "erro";

export interface PieceOverrides {
  /** 0 pequeno, 1 médio, 2 grande */
  motifScale: number;
  /** 0 arejado, 1 equilibrado, 2 cheio */
  density: number;
  /** 0 suave, 1 médio, 2 forte */
  contrast: number;
  background: "claro" | "medio" | "escuro";
}

export interface Piece {
  id: string;
  applicationId: string;
  role: PieceRole;
  overrides: PieceOverrides;
  status: PieceStatus;
  imageUrl?: string;
  /** Versão ampliada para impressão, quando existir. */
  printUrl?: string;
  /** Resolução real do arquivo no tamanho da peça. */
  dpi?: number;
  /** Quem desenhou: a IA ou o próprio app. */
  madeBy?: "ia" | "app";
  /** Verificação da composição em peças posicionadas. */
  composition?: { ok: boolean; reason?: string };
  /** true enquanto a peça está sendo preparada para impressão. */
  preparing?: boolean;
  seam?: { ok: boolean; score: number };
  /** Subetapa em andamento, mostrada no card enquanto a peça é feita. */
  stage?: string;
  /** Medições da geração: tempos, provedor, modelo, qualidade e tamanho. */
  timings?: {
    totalMs?: number;
    provider?: string;
    model?: string;
    quality?: string;
    size?: string;
    pixels?: string;
  };

  /** Outras versões da mesma peça: conserto de emenda, xadrez, listras, outra cor. */
  versions?: PieceVersion[];
}

/** Nome amigável do desenhista de imagem usado na peça. */
export function modelLabel(timings?: Piece["timings"]): string | null {
  if (!timings?.model) return null;
  const size = timings.size ? `, ${timings.size}` : "";
  if (timings.provider === "gemini" || timings.model.startsWith("gemini"))
    return `Nano Banana 2 (Google)${size}`;
  if (timings.model.startsWith("gpt-image-2.5")) return `GPT-Image-2.5 (OpenAI)${size}`;
  if (timings.model.startsWith("gpt-image")) return `GPT-Image-2 (OpenAI)${size}`;
  return timings.model;
}

export interface PieceVersion {
  kind: string;
  label: string;
  url: string;
  seam?: { ok: boolean; score: number } | null;
}


/** Nome curto da versão, como aparece nas abas e no nome do arquivo. */
export function versionTitle(version: PieceVersion): string {
  const label = version.label || version.kind;
  const names: Record<string, string> = {
    xadrez: "Xadrez",
    listras: "Listras",
    "outra-cor": "Outra cor",
    conserto: "Conserto",
    original: "Original",
  };
  return names[label] ?? label.charAt(0).toUpperCase() + label.slice(1);
}

/** Sufixo do arquivo da versão, em minúsculas e sem acento. */
export function versionSuffix(version: PieceVersion): string {
  return (version.label || version.kind)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}

export interface Brief {
  name: string;
  idea: string;
  referenceImage: string | null;
  style: DrawingStyle;
  usage: Usage;
  /** Paleta aprovada da coleção. Fica vazia até o diretor criativo propor. */
  palette: string[];
  /** Cores que a artesã exige na coleção. */
  requiredColors?: string[];
  /** Cores que a artesã gostaria de ver, sem obrigação. */
  preferredColors?: string[];
}

export interface Collection {
  id: string;
  name: string;
  stage: CollectionStage;
  style: DrawingStyle;
  usage: Usage;
  palette: string[];
  pieces: Piece[];
  createdAt: string;
}

export interface Direction {
  highlights: string[];
  size: number;
  density: number;
  contrast: number;
  sizeReason?: string;
  densityReason?: string;
  contrastReason?: string;
  suggestedPalette: string[];
  paletteReason: string;
  guidances: string[];
  /** Motivos concretos que a ferramenta entendeu do pedido. */
  motifs?: { name: string; en: string }[];
  /** O que a artesã pediu para ficar fora. */
  avoid?: string[];
}

export const STYLE_OPTIONS: { value: DrawingStyle; label: string }[] = [
  { value: "aquarela-delicada", label: "Aquarela delicada" },
  { value: "botanico-vintage", label: "Botânico vintage" },
  { value: "ilustracao-ludica", label: "Ilustração lúdica" },
  { value: "traco-minimalista", label: "Traço minimalista" },
];

export const USAGE_OPTIONS: { value: Usage; label: string }[] = [
  { value: "mesa-posta", label: "Mesa posta e cozinha" },
  { value: "cozinha", label: "Cozinha" },
  { value: "barrado", label: "Barrado" },
  { value: "costura-criativa", label: "Costura criativa e patchwork" },
  { value: "enxoval-infantil", label: "Enxoval infantil" },
  { value: "bolsas-acessorios", label: "Bolsas e acessórios" },
];

/** Explicação curta mostrada abaixo do seletor de uso. */
export const USAGE_NOTE: Partial<Record<Usage, string>> = {
  barrado:
    "Painel de faixas para pano de copa, toalha de chá e patchwork. A coleção inclui barrado único, estampa corrida, xadrez e poá.",
};


export const DEFAULT_PALETTE = ["#632B4A", "#BB577D", "#FFF8EF", "#3B594A", "#C29957"];

/**
 * Chips de inspiração da tela inicial.
 *
 * Eles nao sao enfeite: sao a primeira ancora criativa que a pessoa recebe, e
 * por isso precisam cobrir o espectro. Os tres primeiros chips eram todos
 * delicados, claros e florais, o que empurrava toda colecao para o mesmo lugar.
 * Agora cada um puxa para uma tecnica, um fundo e um clima diferentes.
 */
export const INSPIRATIONS: { label: string; idea: string; palette: string[] }[] = [
  {
    label: "Jardim romântico",
    idea: "Tulipas e pequenos ramos pintados à mão, com leveza de aquarela e muito espaço em branco entre as flores.",
    palette: ["#632B4A", "#BB577D", "#FFF8EF", "#3B594A", "#C29957"],
  },
  {
    label: "Cozinha afetiva",
    idea: "Frutas da estação, xícaras e folhinhas em traço afetuoso, lembrando a mesa posta da casa da avó.",
    palette: ["#6F1B2C", "#E2A08C", "#FBF3EA", "#6E7F5B", "#D9B25C"],
  },
  {
    label: "Infantil delicado",
    idea: "Bichinhos miúdos, nuvens e estrelinhas em tons suaves, com aparência macia e acolhedora.",
    palette: ["#7C9CC4", "#F3CAC6", "#FFFBF6", "#A8C7A1", "#EBC98A"],
  },
  {
    label: "Boteco e churrasco",
    idea: "Ferramentas de churrasco, cortes de carne e temperos desenhados a giz branco sobre ardósia preta, com letreiro de açougue.",
    palette: ["#1A1A1A", "#F5F0E6", "#C0392B", "#8C7853", "#D9C9A3"],
  },
  {
    label: "Festa junina",
    idea: "Bandeirinhas, espiga de milho, fogueira e balão em chita brasileira, cores cheias e contorno preto forte.",
    palette: ["#D62828", "#F7B32B", "#2A9D8F", "#FFF4E0", "#1D3557"],
  },
  {
    label: "Azulejo português",
    idea: "Arabesco de azulejo azul e branco com um ramo de limão siciliano, no capricho da faiança antiga.",
    palette: ["#1B3A6B", "#FFFFFF", "#7FA9D4", "#E9C46A", "#5C7A4A"],
  },
  {
    label: "Sertão e cordel",
    idea: "Mandacaru, carcará e casinha de taipa em xilogravura de cordel, preto sobre papel cru, traço grosso de goiva.",
    palette: ["#1C1C1C", "#E8DCC4", "#B5651D", "#7A6A53", "#A63A2B"],
  },
  {
    label: "Natal da casa",
    idea: "Pinheirinho, laço e caixa de presente em guache opaco sobre fundo cheio, com xadrez escocês de apoio.",
    palette: ["#0F5132", "#A31621", "#F2E8D5", "#C9A227", "#3E5C42"],
  },
];

export const DEFAULT_OVERRIDES: PieceOverrides = {
  motifScale: 0,
  density: 0,
  contrast: 0,
  background: "claro",
};

let pieceSeq = 0;

export function makePiece(applicationId: string, apps: Application[] = APPLICATIONS): Piece | null {
  const app = getApplication(applicationId, apps);
  if (!app) return null;
  pieceSeq += 1;
  return {
    id: `${applicationId}-${pieceSeq}`,
    applicationId,
    role: app.suggestedRole,
    overrides: { ...DEFAULT_OVERRIDES },
    status: "pendente",
  };
}

export function piecesForUsage(usage: Usage): Piece[] {
  return kitFor(usage)
    .map((id) => makePiece(id))
    .filter((p): p is Piece => p !== null);
}

/** Peças posicionadas, que a IA compõe a partir da prancha de motivos. */
export function positionedPieces(pieces: Piece[], apps: Application[] = APPLICATIONS): Piece[] {
  return pieces.filter((p) => getApplication(p.applicationId, apps)?.family === "painel");
}

/** Toda a arte é pintada pela IA, então todas as peças contam. */
export function aiPieces(pieces: Piece[], _apps: Application[] = APPLICATIONS): Piece[] {
  return pieces;
}


export function pieceApplication(piece: Piece, apps: Application[] = APPLICATIONS) {
  return getApplication(piece.applicationId, apps);
}

export function pieceName(piece: Piece, apps: Application[] = APPLICATIONS): string {
  return pieceApplication(piece, apps)?.name ?? "Peça";
}

export function pieceMeasure(piece: Piece, apps: Application[] = APPLICATIONS): string {
  const app = pieceApplication(piece, apps);
  return app ? measureLabel(app) : "";
}

export function styleLabel(style: DrawingStyle): string {
  return STYLE_OPTIONS.find((s) => s.value === style)?.label ?? "";
}

export function usageLabel(usage: Usage): string {
  return USAGE_OPTIONS.find((u) => u.value === usage)?.label ?? "";
}

export function roleLabel(role: PieceRole): string {
  return role === "principal" ? "PRINCIPAL" : role === "coordenado" ? "COORDENADO" : "APOIO";
}

export function stageLabel(stage: CollectionStage, count: number): string {
  switch (stage) {
    case "rascunho":
      return "Exemplo para explorar";
    case "proposta":
      return "Proposta em revisão";
    case "motivos":
      return "Criando os motivos";
    case "montagem":
      return "Montando as peças";
    case "pronta":
      return `${count} de ${count} prontas`;
  }
}

export function makeDirection(brief: Brief, pieces: Piece[]): Direction {
  const principal = pieces.find((p) => p.role === "principal");
  const hasPainel = pieces.some((p) => pieceApplication(p)?.family === "painel");
  return {
    highlights: [
      `Tema: ${brief.idea.trim().slice(0, 90) || "coleção delicada com motivos florais"}.`,
      `Estilo escolhido: ${styleLabel(brief.style).toLowerCase()}, com traço leve e aparência de pintura à mão.`,
      `Uso pensado para ${usageLabel(brief.usage).toLowerCase()}.`,
      principal
        ? `A peça de destaque é ${pieceName(principal).toLowerCase()}, com os desenhos maiores.`
        : "A coleção não tem peça de destaque definida, então o equilíbrio fica entre os coordenados.",
      hasPainel
        ? "Nos painéis, os quadros ficam posicionados no corte de 50 cm, com centro calmo e moldura decorada."
        : "Todas as peças de repetição terão a emenda conferida antes de ficarem prontas.",
      `A coleção tem ${pieces.length} ${pieces.length === 1 ? "peça" : "peças"}, todas na mesma paleta.`,
    ],
    size: 0,
    density: 0,
    contrast: 0,
    suggestedPalette: brief.palette,
    paletteReason: "",
    guidances: pieces.map((p) => {
      const app = pieceApplication(p);
      return app ? `${app.name}: ${app.directorRules}` : "";
    }),
  };
}

export function makeCollection(brief: Brief, pieces: Piece[], stage: CollectionStage): Collection {
  return {
    id: `col-${Date.now()}`,
    name: brief.name.trim() || "Coleção sem nome",
    stage,
    style: brief.style,
    usage: brief.usage,
    palette: brief.palette,
    pieces,
    createdAt: new Date().toISOString(),
  };
}

export const SAVED_COLLECTIONS: Collection[] = [
  {
    id: "exemplo",
    name: "Jardim de Tulipas",
    stage: "pronta",
    style: "aquarela-delicada",
    usage: "mesa-posta",
    palette: DEFAULT_PALETTE,
    pieces: piecesForUsage("mesa-posta"),
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "col-2",
    name: "Cozinha da Vovó",
    stage: "pronta",
    style: "botanico-vintage",
    usage: "cozinha",
    palette: ["#6F1B2C", "#E2A08C", "#FBF3EA", "#6E7F5B", "#D9B25C"],
    pieces: piecesForUsage("cozinha"),
    createdAt: "2026-02-14T00:00:00.000Z",
  },
  {
    id: "col-3",
    name: "Ninho de Nuvens",
    stage: "pronta",
    style: "ilustracao-ludica",
    usage: "enxoval-infantil",
    palette: ["#7C9CC4", "#F3CAC6", "#FFFBF6", "#A8C7A1", "#EBC98A"],
    pieces: piecesForUsage("enxoval-infantil"),
    createdAt: "2026-03-02T00:00:00.000Z",
  },
];
