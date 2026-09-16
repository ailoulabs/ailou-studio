/** Tipos do fluxo em cinco passos (v0.7), compartilhados entre rota e componentes. */

export interface FlowVersion {
  label: string;
  path: string;
  url: string;
  createdAt: string;
}

export interface FlowPiece {
  id: string;
  applicationId: string;
  role: string;
  position: number;
  status: "pendente" | "gerando" | "pronta" | "erro";
  imagePath: string | null;
  imageUrl: string | null;
  error: string | null;
  versions: FlowVersion[];
}
