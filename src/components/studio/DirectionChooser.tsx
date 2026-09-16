import { useState } from "react";
import { Check, Compass, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ExploreDirection, ExploreQuestion } from "@/lib/api/ai.functions";

export interface ChosenDirection {
  name: string;
  pitch: string;
  mood: string;
  technique: string;
  ground: string;
  secondaryLanguage: { name: string; en: string; note: string };
}

interface Props {
  questions: ExploreQuestion[];
  directions: ExploreDirection[];
  chosen: ChosenDirection | null;
  loading: boolean;
  busy: boolean;
  /** Primeira exploração, sem respostas. */
  onExplore: () => void;
  /** Reexplora levando as respostas da artesã. */
  onAnswer: (answers: { question: string; answer: string }[]) => void;
  onChoose: (direction: ExploreDirection) => void;
}

/**
 * Etapa 1.5: em vez de exigir um prompt enorme no começo, a ferramenta pergunta
 * o que ficou indefinido e propõe três direções completas para escolher.
 * O que muda de verdade na coleção é a linguagem secundária de cada direção.
 */
export function DirectionChooser({
  questions,
  directions,
  chosen,
  loading,
  busy,
  onExplore,
  onAnswer,
  onChoose,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  if (chosen) {
    return (
      <section className="surface-card p-5 sm:p-7">
        <p className="eyebrow">Direção escolhida</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl sm:text-[28px]">{chosen.name}</h2>
          <Button variant="outline" size="sm" onClick={onExplore} disabled={busy || loading}>
            <RefreshCw className="size-4" strokeWidth={1.5} />
            Trocar direção
          </Button>
        </div>
        {chosen.pitch && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {chosen.pitch}
          </p>
        )}
        <dl className="mt-4 space-y-1.5 rounded-lg border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
          {chosen.technique && (
            <div className="flex gap-2">
              <dt className="font-medium">Técnica:</dt>
              <dd className="text-muted-foreground">{chosen.technique}</dd>
            </div>
          )}
          {chosen.ground && (
            <div className="flex gap-2">
              <dt className="font-medium">Fundo:</dt>
              <dd className="text-muted-foreground">{chosen.ground}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium">Linguagem secundária:</dt>
            <dd className="text-muted-foreground">
              {chosen.secondaryLanguage.name}
              {chosen.secondaryLanguage.note ? `. ${chosen.secondaryLanguage.note}` : ""}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  if (directions.length === 0 && !loading) {
    return (
      <section className="surface-card p-5 sm:p-7">
        <p className="eyebrow">Antes de gerar</p>
        <h2 className="mt-2 text-2xl sm:text-[28px]">Explorar direções</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Toda coleção que funciona tem duas linguagens: o assunto e uma linguagem gráfica que
          costura as peças, como azulejo, listra ou renda. Deixa eu propor três caminhos e, se
          faltar decidir alguma coisa, eu pergunto antes.
        </p>
        <Button className="mt-5" size="lg" onClick={onExplore} disabled={busy}>
          <Compass className="size-4" strokeWidth={1.5} />
          Explorar direções
        </Button>
      </section>
    );
  }

  return (
    <section className="surface-card p-5 sm:p-7">
      <p className="eyebrow">Antes de gerar</p>
      <h2 className="mt-2 text-2xl sm:text-[28px]">Escolha uma direção</h2>

      {loading && (
        <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Pensando em caminhos diferentes para a sua ideia.
        </div>
      )}

      {!loading && questions.length > 0 && (
        <div className="mt-5 space-y-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Duas coisas ficaram em aberto. Responder afina as propostas, mas é opcional: dá para
            escolher uma direção direto abaixo.
          </p>
          {questions.map((q) => (
            <div key={q.id}>
              <p className="text-sm font-medium text-foreground">{q.question}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const active = answers[q.id] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      title={opt.hint}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.label }))}
                      className={
                        active
                          ? "rounded-full border border-foreground bg-foreground px-3.5 py-1.5 text-sm text-background"
                          : "rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition hover:border-foreground hover:text-foreground"
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {answers[q.id] && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {q.options.find((o) => o.label === answers[q.id])?.hint}
                </p>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={!allAnswered || busy}
            onClick={() =>
              onAnswer(
                questions.map((q) => ({ question: q.question, answer: answers[q.id] ?? "" })),
              )
            }
          >
            <Sparkles className="size-4" strokeWidth={1.5} />
            Refazer as propostas com isso
          </Button>
        </div>
      )}

      {!loading && directions.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {directions.map((d) => (
            <button
              key={d.name}
              type="button"
              disabled={busy}
              onClick={() => onChoose(d)}
              className="group flex h-full flex-col rounded-xl border border-border p-4 text-left transition hover:border-foreground disabled:opacity-60"
            >
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {d.mood}
              </span>
              <span className="mt-1.5 text-base font-medium text-foreground">{d.name}</span>
              <span className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {d.pitch}
              </span>
              <span className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                {[d.technique, d.ground].filter(Boolean).join(" · ")}
              </span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-foreground opacity-0 transition group-hover:opacity-100">
                <Check className="size-4" strokeWidth={1.5} />
                Usar esta
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && directions.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-4" onClick={onExplore} disabled={busy}>
          <RefreshCw className="size-4" strokeWidth={1.5} />
          Me surpreenda com outras três
        </Button>
      )}
    </section>
  );
}
