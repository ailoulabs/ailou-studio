import { getApplication } from "@/lib/catalog";
import type { Piece } from "@/lib/collection";
import { PatternCard } from "./PatternCard";

export function PatternGrid({
  pieces,
  palette,
  onOpen,
  onRecreate,
  onHiFi,
  onFixSeam,
}: {
  pieces: Piece[];
  palette: string[];
  onOpen: (piece: Piece) => void;
  onRecreate?: (piece: Piece) => void;
  onHiFi?: (piece: Piece) => void;
  onFixSeam?: (piece: Piece) => void;
}) {
  if (pieces.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Sua coleção está vazia. Adicione peças na coluna ao lado para começar.
      </div>
    );
  }

  const entries = pieces
    .map((piece, i) => ({ piece, index: i + 1, app: getApplication(piece.applicationId) }))
    .filter((e): e is { piece: Piece; index: number; app: NonNullable<typeof e.app> } => !!e.app);

  const cuts = entries.filter((e) => e.app.family !== "corrida");
  const runs = entries.filter((e) => e.app.family === "corrida");

  return (
    <div className="space-y-5">
      {cuts.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {cuts.map(({ piece, index, app }) => (
            <PatternCard
              key={piece.id}
              piece={piece}
              app={app}
              palette={palette}
              index={index}
              onOpen={() => onOpen(piece)}
              {...(onRecreate ? { onRecreate: () => onRecreate(piece) } : {})}
              {...(onHiFi ? { onHiFi: () => onHiFi(piece) } : {})}
              {...(onFixSeam ? { onFixSeam: () => onFixSeam(piece) } : {})}
            />
          ))}
        </div>
      )}

      {runs.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {runs.map(({ piece, index, app }) => (
            <PatternCard
              key={piece.id}
              piece={piece}
              app={app}
              palette={palette}
              index={index}
              onOpen={() => onOpen(piece)}
              {...(onRecreate ? { onRecreate: () => onRecreate(piece) } : {})}
              {...(onHiFi ? { onHiFi: () => onHiFi(piece) } : {})}
              {...(onFixSeam ? { onFixSeam: () => onFixSeam(piece) } : {})}
            />
          ))}
        </div>
      )}
    </div>
  );
}
