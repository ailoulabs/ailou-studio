import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CLIMATES } from "@/lib/studio-flow";
import { cn } from "@/lib/utils";

interface Props {
  themeName: string;
  climate: string | null;
  onClimate: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const PAGE = 6;

export function StepClimate({ themeName, climate, onClimate, onBack, onNext }: Props) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(CLIMATES.length / PAGE);
  const visible = CLIMATES.slice(page * PAGE, page * PAGE + PAGE);
  const chosen = CLIMATES.find((c) => c.id === climate);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Em que clima?</h1>
        <p className="mt-1 text-muted-foreground">
          Jeitos de desenhar <b>{themeName}</b>. Escolha olhando as cores e a descrição.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => {
          const selected = climate === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onClimate(c.id)}
              className={cn(
                "overflow-hidden rounded-xl border bg-card text-left transition",
                "hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "border-primary ring-2 ring-primary/30" : "border-border",
              )}
            >
              <div className="flex h-16" aria-hidden>
                {c.swatch.map((hex, i) => (
                  <span key={i} className="flex-1" style={{ background: hex }} />
                ))}
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.hint}</div>
              </div>
            </button>
          );
        })}
      </div>

      {chosen && chosen.id !== visible.find((c) => c.id === chosen.id)?.id && (
        <p className="text-sm text-muted-foreground">
          Escolhido: <b>{chosen.name}</b>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex gap-2">
          {pages > 1 && (
            <Button variant="outline" onClick={() => setPage((p) => (p + 1) % pages)}>
              Ver outros
            </Button>
          )}
          <Button onClick={onNext} disabled={!climate}>
            Continuar
          </Button>
        </div>
      </div>
    </section>
  );
}
