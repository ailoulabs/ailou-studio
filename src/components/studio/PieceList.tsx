import { Grid2X2, Rows3, Repeat, X } from "lucide-react";
import { getApplication, FAMILY_LABEL, type Family } from "@/lib/catalog";
import type { Piece } from "@/lib/collection";

const FAMILY_ICON: Record<Family, typeof Repeat> = {
  corrida: Repeat,
  barrado: Rows3,
  painel: Grid2X2,
};

export function PieceList({
  pieces,
  onRemove,
}: {
  pieces: Piece[];
  onRemove: (id: string) => void;
}) {
  if (pieces.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Nenhuma peça ainda. Use o botão abaixo para adicionar.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {pieces.map((piece) => {
        const app = getApplication(piece.applicationId);
        if (!app) return null;
        const Icon = FAMILY_ICON[app.family];
        return (
          <li
            key={piece.id}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
          >
            <Icon
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={1.5}
              aria-label={FAMILY_LABEL[app.family]}
            />
            <span className="min-w-0 flex-1 truncate text-sm">{app.name}</span>
            <button
              type="button"
              onClick={() => onRemove(piece.id)}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              aria-label={`Remover ${app.name}`}
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
