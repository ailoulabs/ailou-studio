import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { Direction } from "@/lib/collection";
import type { StudioAction } from "@/hooks/use-studio";

interface Props {
  direction: Direction;
  pieceNames: string[];
  paletteInUse: string[];
  dispatch: (action: StudioAction) => void;
  onProposePalette: () => void;
  onPaletteEdited: () => void;
  busy?: boolean;
}

const SIZE_LABELS = ["Miúdo", "Pequeno", "Médio", "Grande", "Bem grande"];
const DENSITY_LABELS = ["Bem arejado", "Arejado", "Equilibrado", "Cheio", "Bem cheio"];
const CONTRAST_LABELS = ["Bem suave", "Suave", "Médio", "Forte", "Bem forte"];

/** O valor vai de -2 a 2; o rótulo vem do índice de 0 a 4. */
const labelIndex = (value: number) => Math.min(4, Math.max(0, Math.round(value) + 2));

function ControlSlider({
  label,
  labels,
  value,
  reason,
  onChange,
}: {
  label: string;
  labels: string[];
  value: number;
  reason?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        <span className="text-xs font-medium text-primary">{labels[labelIndex(value)]}</span>
      </div>
      <Slider
        value={[value]}
        min={-2}
        max={2}
        step={1}
        onValueChange={([v]) => onChange(v ?? 0)}
        aria-label={label}
      />
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        {labels.map((l, i) => (
          <span key={l} className={i === 1 || i === 3 ? "hidden sm:inline" : undefined}>
            {l}
          </span>
        ))}
      </div>
      {reason && <p className="text-xs leading-relaxed text-muted-foreground">{reason}</p>}
    </div>
  );
}

/** Etapa 2: paleta proposta, ajustes da coleção e orientações de cada peça. */
export function DirectionDetails({
  direction,
  pieceNames,
  paletteInUse,
  dispatch,
  onProposePalette,
  onPaletteEdited,
  busy,
}: Props) {
  const palette = (paletteInUse.length > 0 ? paletteInUse : direction.suggestedPalette).slice(0, 5);
  if (palette.length === 0) return null;

  return (
    <div className="mt-6 space-y-6 border-t border-border pt-6">
      <div className="rounded-lg border border-border bg-secondary/50 p-4">
        <h3 className="text-base">Paleta da coleção</h3>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-3">
            {palette.map((color, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <label className="relative block size-9 cursor-pointer overflow-hidden rounded-full border border-border">
                  <span className="block size-full" style={{ backgroundColor: color }} />
                  <input
                    type="color"
                    value={color}
                    aria-label={`Cor ${i + 1} da paleta`}
                    onChange={(e) =>
                      dispatch({ type: "setPaletteColor", index: i, value: e.target.value })
                    }
                    onBlur={onPaletteEdited}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <span className="text-[10px] uppercase text-muted-foreground">{color}</span>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={onProposePalette}>
            {busy && <Spinner className="size-3.5" />}
            {busy ? "Propondo…" : "Propor outra paleta"}
          </Button>
        </div>
        {direction.paletteReason && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {direction.paletteReason}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ControlSlider
          label="Tamanho dos desenhos"
          labels={SIZE_LABELS}
          value={direction.size}
          {...(direction.sizeReason ? { reason: direction.sizeReason } : {})}
          onChange={(v) => dispatch({ type: "setDirectionSlider", field: "size", value: v })}
        />
        <ControlSlider
          label="Quantidade"
          labels={DENSITY_LABELS}
          value={direction.density}
          {...(direction.densityReason ? { reason: direction.densityReason } : {})}
          onChange={(v) => dispatch({ type: "setDirectionSlider", field: "density", value: v })}
        />
        <ControlSlider
          label="Contraste"
          labels={CONTRAST_LABELS}
          value={direction.contrast}
          {...(direction.contrastReason ? { reason: direction.contrastReason } : {})}
          onChange={(v) => dispatch({ type: "setDirectionSlider", field: "contrast", value: v })}
        />
      </div>

      <details className="group rounded-lg border border-border p-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-primary">
          Ver e editar as orientações de cada estampa
        </summary>
        <div className="mt-4 space-y-4">
          {direction.guidances.map((g, i) => (
            <div key={i} className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {String(i + 1).padStart(2, "0")} · {pieceNames[i]}
              </Label>
              <Textarea
                rows={3}
                value={g}
                onChange={(e) => dispatch({ type: "setGuidance", index: i, value: e.target.value })}
              />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
