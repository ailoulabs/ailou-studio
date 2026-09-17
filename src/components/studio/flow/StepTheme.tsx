import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { generateThemeThumbnails } from "@/lib/api/studio.functions";
import { ALL_THEMES, THEME_GROUPS, type Theme } from "@/lib/studio-flow";
import { cn } from "@/lib/utils";

interface Props {
  theme: string | null;
  words: string;
  onTheme: (id: string) => void;
  onWords: (words: string) => void;
  onNext: () => void;
}

/** Miniatura pública do tema, gerada uma vez pelo administrador. */
function thumbUrl(id: string, stamp: number): string {
  const base = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/temas/${id}.png${stamp ? `?v=${stamp}` : ""}`;
}

function ThemeCard({
  theme,
  selected,
  stamp,
  onClick,
}: {
  theme: Theme;
  selected: boolean;
  stamp: number;
  onClick: () => void;
}) {
  const [missing, setMissing] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={theme.desc}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card text-left transition",
        "hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-muted to-muted/40">
        {!missing && (
          <img
            src={thumbUrl(theme.id, stamp)}
            alt=""
            loading="lazy"
            onError={() => setMissing(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <span className="text-sm font-semibold leading-tight">{theme.name}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{theme.desc}</span>
      </div>
    </button>
  );
}

export function StepTheme({ theme, words, onTheme, onWords, onNext }: Props) {
  const { isAdmin } = useAuth();
  const generate = useServerFn(generateThemeThumbnails);
  const [stamp, setStamp] = useState(0);
  const [making, setMaking] = useState<string | null>(null);
  const canGo = theme !== null || words.trim().length > 2;

  /** Administrador: gera as miniaturas em lotes de três, até acabar. */
  const runThumbnails = async (all: boolean) => {
    setMaking("Preparando…");
    try {
      if (all) {
        const ids = ALL_THEMES.map((t) => t.id);
        for (let i = 0; i < ids.length; i += 3) {
          setMaking(
            `Pintando miniaturas ${i + 1} a ${Math.min(i + 3, ids.length)} de ${ids.length}…`,
          );
          await generate({ data: { ids: ids.slice(i, i + 3) } });
          setStamp(Date.now());
        }
      } else {
        let remaining = 1;
        let count = 0;
        while (remaining > 0) {
          const res = await generate({ data: {} });
          count += res.done.length;
          remaining = res.remaining;
          setStamp(Date.now());
          setMaking(`Pintadas ${count}, faltam ${remaining}…`);
          if (res.done.length === 0) break;
        }
      }
      toast.success("Miniaturas prontas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar as miniaturas.");
    } finally {
      setMaking(null);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">O que você quer estampar?</h1>
        <p className="mt-1 text-muted-foreground">
          Toque em um tema. Depois a gente acerta o jeito.
        </p>
      </div>

      {THEME_GROUPS.map((group) => (
        <div key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.themes.map((th) => (
              <ThemeCard
                key={th.id}
                theme={th}
                selected={theme === th.id}
                stamp={stamp}
                onClick={() => onTheme(th.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-2 rounded-xl border border-dashed border-border bg-card/60 p-4">
        <label htmlFor="palavras" className="text-sm font-medium">
          Ou conte com suas palavras
        </label>
        <Input
          id="palavras"
          value={words}
          onChange={(e) => onWords(e.target.value)}
          placeholder="Ex.: girassóis com abelhinhas e fitas azuis"
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">
          Se escrever aqui, o texto vale mais do que a descrição do tema escolhido acima.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              disabled={making !== null}
              onClick={() => void runThumbnails(false)}
            >
              Gerar miniaturas que faltam
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={making !== null}
              onClick={() => void runThumbnails(true)}
            >
              Regerar todas
            </Button>
            {making && <span>{making}</span>}
          </div>
        ) : (
          <span />
        )}
        <Button onClick={onNext} disabled={!canGo}>
          Continuar
        </Button>
      </div>
    </section>
  );
}
