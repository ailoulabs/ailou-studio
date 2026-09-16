import { useRef } from "react";
import { Palette, ImageUp, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddPieceSheet } from "@/components/studio/AddPieceSheet";
import { PieceList } from "@/components/studio/PieceList";
import {
  INSPIRATIONS,
  STYLE_OPTIONS,
  USAGE_OPTIONS,
  USAGE_NOTE,

  aiPieces,
  styleLabel,
  usageLabel,
  type DrawingStyle,
  type Usage,
} from "@/lib/collection";

import type { StudioAction, StudioState } from "@/hooks/use-studio";

interface Props {
  state: StudioState;
  dispatch: (action: StudioAction) => void;
  onElaborate: () => void;
  busy?: boolean;
}

export function BriefForm({ state, dispatch, onElaborate, busy }: Props) {

  const fileRef = useRef<HTMLInputElement>(null);
  const { brief, pieces } = state;
  const required: string[] = brief.requiredColors ?? [];
  const painted = aiPieces(pieces).length;


  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("A imagem precisa ter até 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => dispatch({ type: "setReference", value: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-start gap-3 border-b border-border pb-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <Palette className="size-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg leading-tight">Sua próxima coleção</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Conte o que você imaginou.</p>
        </div>
      </div>

      <div className="space-y-5 pt-5">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome da coleção</Label>
          <Input
            id="nome"
            value={brief.name}
            placeholder="Jardim de Tulipas"
            onChange={(e) => dispatch({ type: "setField", field: "name", value: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ideia">Qual é a sua ideia?</Label>
          <Textarea
            id="ideia"
            rows={5}
            value={brief.idea}
            placeholder="Conte o tema, os elementos e a sensação que deseja transmitir…"
            onChange={(e) => dispatch({ type: "setField", field: "idea", value: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>
            Imagem de referência <span className="font-normal text-muted-foreground">opcional</span>
          </Label>
          {brief.referenceImage ? (
            <div className="relative overflow-hidden rounded-lg border border-border">
              <img src={brief.referenceImage} alt="Referência enviada" className="h-36 w-full object-cover" />
              <button
                type="button"
                onClick={() => dispatch({ type: "setReference", value: null })}
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-card/90 text-muted-foreground transition-colors hover:text-primary"
                aria-label="Remover imagem de referência"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <ImageUp className="size-4" strokeWidth={1.5} />
              Enviar imagem de referência
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            PNG, JPG ou WebP, até 8 MB. A imagem inspira o estilo da coleção junto com o tema e a paleta.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Uma inspiração para começar</Label>
          <div className="flex flex-wrap gap-2">
            {INSPIRATIONS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "applyInspiration",
                    label: chip.label,
                    idea: chip.idea,
                    palette: chip.palette,
                  })
                }
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-sand hover:bg-secondary hover:text-primary"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Estilo do desenho</Label>
          <Select
            value={brief.style}
            onValueChange={(v) => dispatch({ type: "setStyle", value: v as DrawingStyle })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{styleLabel(brief.style)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Onde você vai usar?</Label>
          <Select
            value={brief.usage}
            onValueChange={(v) => dispatch({ type: "setUsage", value: v as Usage })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{usageLabel(brief.usage)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {USAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {USAGE_NOTE[brief.usage] ? (
            <p className="text-xs text-muted-foreground">{USAGE_NOTE[brief.usage]}</p>
          ) : null}

        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Label>Peças da coleção</Label>
            <span className="text-xs text-muted-foreground">
              {pieces.length} {pieces.length === 1 ? "peça" : "peças"}
            </span>
          </div>
          <PieceList pieces={pieces} onRemove={(id) => dispatch({ type: "removePiece", id })} />
          <AddPieceSheet
            palette={brief.palette}
            onAdd={(applicationId) => dispatch({ type: "addPiece", applicationId })}
          />
        </div>

        <details className="group rounded-lg border border-border p-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-primary">
            Tem cores que precisam entrar? <span className="font-normal text-muted-foreground">opcional</span>
          </summary>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              {required.map((color, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <label className="relative block size-10 cursor-pointer overflow-hidden rounded-full border border-border shadow-card">
                    <span className="block size-full" style={{ backgroundColor: color }} />
                    <input
                      type="color"
                      value={color}
                      aria-label={`Cor obrigatória ${i + 1}`}
                      onChange={(e) =>
                        dispatch({ type: "setRequiredColor", index: i, value: e.target.value })
                      }
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "removeRequiredColor", index: i })}
                    className="text-[10px] uppercase text-muted-foreground transition-colors hover:text-primary"
                  >
                    remover
                  </button>
                </div>
              ))}
              {required.length < 5 && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "addRequiredColor" })}
                  className="grid size-10 place-items-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-sand hover:text-primary"
                  aria-label="Adicionar cor obrigatória"
                >
                  +
                </button>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Deixe vazio se preferir. A paleta completa é proposta no passo 2, depois que entendemos
              a sua ideia.
            </p>
          </div>
        </details>

        <div className="space-y-3 border-t border-border pt-5">
          <Button className="w-full" size="lg" onClick={onElaborate} disabled={busy}>
            {busy ? <Spinner /> : <Sparkles className="size-4" strokeWidth={1.5} />}
            {busy ? "Elaborando…" : "1. Elaborar minha ideia"}
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Primeiro você confere o que entendi, depois gera as cores e os motivos, e só então as estampas.
          </p>
        </div>

      </div>
    </div>
  );
}
