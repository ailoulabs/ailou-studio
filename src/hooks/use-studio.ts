import { useReducer } from "react";
import {
  INSPIRATIONS,
  makeDirection,
  makePiece,
  piecesForUsage,
  type Brief,
  type CollectionStage,
  type Direction,
  type DrawingStyle,
  type Piece,
  type Usage,
} from "@/lib/collection";

export interface StudioState {
  collectionId: string | null;
  brief: Brief;
  pieces: Piece[];
  direction: Direction | null;
  shared: string;
  stage: CollectionStage;
  /** Prancha de motivos da coleção. */
  sheetUrl: string | null;
  motifs: MotifEntry[];
}

export interface MotifEntry {
  index: number;
  type: string;
  relSize: number;
  url: string;
  /** Nome do motivo, vindo da conferência da prancha. */
  name?: string;
  /** A conferência achou este motivo fora do tema pedido. */
  offTheme?: boolean;
  /** A artesã tirou este motivo da coleção. */
  excluded?: boolean;
}

export type StudioAction =
  | { type: "reset" }
  | { type: "setField"; field: "name" | "idea"; value: string }
  | { type: "setStyle"; value: DrawingStyle }
  | { type: "setUsage"; value: Usage }
  | { type: "setReference"; value: string | null }
  | { type: "setPaletteColor"; index: number; value: string }
  | { type: "setPalette"; value: string[] }
  | { type: "setRequiredColor"; index: number; value: string }
  | { type: "addRequiredColor" }
  | { type: "removeRequiredColor"; index: number }
  | { type: "applyInspiration"; label: string; idea: string; palette: string[] }
  | { type: "addPiece"; applicationId: string }
  | { type: "removePiece"; id: string }
  | { type: "elaborate" }
  | { type: "setDirectionSlider"; field: "size" | "density" | "contrast"; value: number }
  | { type: "setGuidance"; index: number; value: string }
  | { type: "generate" }
  | { type: "assemble" }
  | { type: "generated" }
  | { type: "setCollectionId"; value: string | null }
  | { type: "syncPieceIds"; idByPosition: Record<number, string> }
  | { type: "setDirection"; direction: Direction; shared: string }
  | { type: "setStage"; value: CollectionStage }
  | {
      type: "setPieceResult";
      id: string;
      status?: Piece["status"];
      imageUrl?: string;
      printUrl?: string;
      dpi?: number;
      madeBy?: "ia" | "app";
      composition?: { ok: boolean; reason?: string };
      preparing?: boolean;
      seam?: { ok: boolean; score: number };
      stage?: string | null;
      timings?: { totalMs?: number; model?: string; quality?: string; size?: string };
    }
  | { type: "setSheet"; url: string | null }
  | { type: "setMotifs"; motifs: MotifEntry[] }
  | { type: "excludeMotif"; index: number; excluded: boolean }
  | { type: "loadState"; value: StudioState };

const initialBrief: Brief = {
  name: "",
  idea: "",
  referenceImage: null,
  style: "aquarela-delicada",
  usage: "mesa-posta",
  palette: [],
  requiredColors: [],
  preferredColors: [],
};

export const initialStudioState: StudioState = {
  collectionId: null,
  brief: initialBrief,
  pieces: piecesForUsage("mesa-posta"),
  direction: null,
  shared: "",
  stage: "rascunho",
  sheetUrl: null,
  motifs: [],
};


/** Os três ajustes valem para a coleção inteira, então descem para todas as peças. */
function withDirection(pieces: Piece[], direction: Direction): Piece[] {
  return pieces.map((p) => ({
    ...p,
    overrides: {
      ...p.overrides,
      motifScale: direction.size,
      density: direction.density,
      contrast: direction.contrast,
    },
  }));
}

function reducer(state: StudioState, action: StudioAction): StudioState {
  // Comecar de novo: volta ao estado inicial, sem arrastar nada da colecao anterior.
  if (action.type === "reset") return initialStudioState;
  switch (action.type) {
    case "setField":
      return { ...state, brief: { ...state.brief, [action.field]: action.value } };
    case "setStyle":
      return { ...state, brief: { ...state.brief, style: action.value } };
    case "setUsage":
      return {
        ...state,
        brief: { ...state.brief, usage: action.value },
        pieces: piecesForUsage(action.value),
        direction: null,
        stage: "rascunho",
      };
    case "setReference":
      return { ...state, brief: { ...state.brief, referenceImage: action.value } };
    case "setPaletteColor": {
      const palette = [...state.brief.palette];
      palette[action.index] = action.value;
      return { ...state, brief: { ...state.brief, palette } };
    }
    case "setPalette":
      return { ...state, brief: { ...state.brief, palette: action.value.slice(0, 5) } };
    case "setRequiredColor": {
      const required = [...(state.brief.requiredColors ?? [])];
      required[action.index] = action.value;
      return { ...state, brief: { ...state.brief, requiredColors: required } };
    }
    case "addRequiredColor": {
      const required = [...(state.brief.requiredColors ?? [])];
      if (required.length >= 5) return state;
      return { ...state, brief: { ...state.brief, requiredColors: [...required, "#BB577D"] } };
    }
    case "removeRequiredColor": {
      const required = (state.brief.requiredColors ?? []).filter((_, i) => i !== action.index);
      return { ...state, brief: { ...state.brief, requiredColors: required } };
    }
    case "applyInspiration": {
      // O nome vem junto, mas sem atropelar o que a pessoa escreveu: so preenche
      // quando esta vazio ou quando o nome atual veio de outro chip.
      const digitado = state.brief.name.trim();
      const veioDeChip = INSPIRATIONS.some((i) => i.label === digitado);
      const name = digitado === "" || veioDeChip ? action.label : state.brief.name;
      return {
        ...state,
        brief: {
          ...state.brief,
          name,
          idea: action.idea,
          preferredColors: action.palette,
        },
      };
    }
    case "addPiece": {
      const piece = makePiece(action.applicationId);
      if (!piece) return state;
      return { ...state, pieces: [...state.pieces, piece] };
    }
    case "removePiece":
      return { ...state, pieces: state.pieces.filter((p) => p.id !== action.id) };
    case "elaborate":
      return {
        ...state,
        stage: "proposta",
        direction: makeDirection(state.brief, state.pieces),
      };
    case "setDirectionSlider": {
      if (!state.direction) return state;
      const direction = { ...state.direction, [action.field]: action.value };
      return { ...state, direction, pieces: withDirection(state.pieces, direction) };
    }
    case "setGuidance": {
      if (!state.direction) return state;
      const guidances = [...state.direction.guidances];
      guidances[action.index] = action.value;
      return { ...state, direction: { ...state.direction, guidances } };
    }
    case "generate":
      return {
        ...state,
        stage: "motivos",
        pieces: state.pieces.map(({ seam: _seam, ...p }) => ({ ...p, status: "gerando" as const })),
      };
    case "assemble":
      return { ...state, stage: "montagem" };
    case "generated":
      return { ...state, stage: "pronta" };
    case "setCollectionId":
      return { ...state, collectionId: action.value };
    case "syncPieceIds":
      return {
        ...state,
        pieces: state.pieces.map((p, i) => ({ ...p, id: action.idByPosition[i] ?? p.id })),
      };
    case "setDirection":
      return {
        ...state,
        direction: action.direction,
        pieces: withDirection(state.pieces, action.direction),
        shared: action.shared,
        stage: "proposta",
      };
    case "setStage":
      return { ...state, stage: action.value };
    case "setPieceResult":
      return {
        ...state,
        pieces: state.pieces.map((p) =>
          p.id === action.id
            ? {
                ...p,
                ...(action.status ? { status: action.status } : {}),
                ...(action.imageUrl ? { imageUrl: action.imageUrl } : {}),
                ...(action.printUrl ? { printUrl: action.printUrl } : {}),
                ...(action.dpi ? { dpi: action.dpi } : {}),
                ...(action.madeBy ? { madeBy: action.madeBy } : {}),
                ...(action.composition ? { composition: action.composition } : {}),
                ...(action.preparing === undefined ? {} : { preparing: action.preparing }),
                ...(action.seam ? { seam: action.seam } : {}),
                ...(action.stage === undefined ? {} : { stage: action.stage ?? "" }),
                ...(action.timings ? { timings: action.timings } : {}),
              }
            : p,
        ),
      };
    case "setSheet":
      return { ...state, sheetUrl: action.url };
    case "excludeMotif":
      return {
        ...state,
        motifs: state.motifs.map((m) =>
          m.index === action.index ? { ...m, excluded: action.excluded } : m,
        ),
      };
    case "setMotifs":
      return { ...state, motifs: action.motifs };
    case "loadState":
      return action.value;

    default:
      return state;
  }
}

export function useStudio() {
  const [state, dispatch] = useReducer(reducer, initialStudioState);
  return { state, dispatch };
}
