import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { stageLabel, styleLabel, type CollectionStage, type DrawingStyle } from "@/lib/collection";

interface Props {
  name: string;
  stage: CollectionStage;
  style: DrawingStyle;
  palette: string[];
  pieceCount: number;
  onDownload: () => void;
}

export function CollectionHeader({ name, stage, style, palette, pieceCount, onDownload }: Props) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">Coleção</span>
          <Badge variant="secondary" className="border border-border bg-blush/50 text-primary">
            {stageLabel(stage, pieceCount)}
          </Badge>
        </div>
        <h2 className="mt-2 truncate">{name}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="flex gap-1">
            {palette.map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="size-4 rounded-full border border-border"
                style={{ backgroundColor: c }}
              />
            ))}
          </span>
          <span>{styleLabel(style)}</span>
          <span className="text-border">|</span>
          <span>
            {pieceCount} {pieceCount === 1 ? "peça coordenada" : "peças coordenadas"}
          </span>
        </div>
      </div>
      <Button variant="outline" onClick={onDownload} className="shrink-0">
        <Download className="size-4" strokeWidth={1.5} />
        Baixar coleção
      </Button>
    </header>
  );
}
