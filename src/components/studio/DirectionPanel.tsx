import { Check } from "lucide-react";
import type { Direction } from "@/lib/collection";

interface Props {
  direction: Direction;
  shared: string;
}

/** Etapa 1: o que a ferramenta entendeu do pedido, só em texto. */
export function DirectionPanel({ direction, shared }: Props) {
  return (
    <section className="surface-card p-5 sm:p-7">
      <p className="eyebrow">Sua ideia</p>
      <h2 className="mt-2 text-2xl sm:text-[28px]">O que entendi</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Confira se é isso mesmo. Se faltar algo, ajuste sua ideia ao lado e elabore de novo.
      </p>

      <ul className="mt-5 space-y-2">
        {direction.highlights.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-sand" strokeWidth={1.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {(direction.motifs?.length ?? 0) > 0 && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Motivos: </span>
          {direction.motifs!.map((m) => m.name).join(", ")}
        </p>
      )}
      {(direction.avoid?.length ?? 0) > 0 && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Fora do tema: </span>
          {direction.avoid!.join(", ")}
        </p>
      )}

      {shared && (
        <p className="mt-5 rounded-lg border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-foreground">
          {shared}
        </p>
      )}
    </section>
  );
}
