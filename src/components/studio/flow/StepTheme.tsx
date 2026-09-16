import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { THEME_GROUPS } from "@/lib/studio-flow";
import { cn } from "@/lib/utils";

interface Props {
  theme: string | null;
  words: string;
  onTheme: (id: string) => void;
  onWords: (words: string) => void;
  onNext: () => void;
}

export function StepTheme({ theme, words, onTheme, onWords, onNext }: Props) {
  const canGo = theme !== null || words.trim().length > 2;
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
            {group.themes.map((th) => {
              const selected = theme === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => onTheme(th.id)}
                  title={th.desc}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition",
                    "hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-border",
                  )}
                >
                  <span className="text-2xl" aria-hidden>
                    {th.emoji}
                  </span>
                  <span className="text-sm font-semibold leading-tight">{th.name}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{th.desc}</span>
                </button>
              );
            })}
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
          Se escrever aqui, o texto vale mais do que o tema escolhido acima.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canGo}>
          Continuar
        </Button>
      </div>
    </section>
  );
}
