import { Button } from "@/components/ui/button";
import { getApplication, measureLabel } from "@/lib/catalog";
import { principalAppFor, USAGES } from "@/lib/studio-flow";
import { cn } from "@/lib/utils";

interface Props {
  usage: string;
  apps: string[];
  onUsage: (usage: string) => void;
  onApps: (apps: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export function StepUsage({ usage, apps, onUsage, onApps, onBack, onNext, disabled }: Props) {
  const kit = USAGES.find((u) => u.usage === usage) ?? USAGES[0]!;
  const principalId = principalAppFor(kit.applicationIds);
  const principal = getApplication(principalId);
  const options = kit.applicationIds.filter((id) => id !== principalId && getApplication(id));

  const toggle = (id: string) => {
    onApps(apps.includes(id) ? apps.filter((a) => a !== id) : [...apps, id]);
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Para onde vai?</h1>
        <p className="mt-1 text-muted-foreground">
          As peças já vêm marcadas. Desmarque o que não quiser.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {USAGES.map((u) => {
          const selected = u.usage === usage;
          return (
            <button
              key={u.usage}
              type="button"
              onClick={() => onUsage(u.usage)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition",
                "hover:border-primary/60 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "border-primary ring-2 ring-primary/30" : "border-border",
              )}
            >
              <span className="text-2xl" aria-hidden>
                {u.emoji}
              </span>
              <span className="text-sm font-semibold leading-tight">{u.name}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Peças da coleção</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2 text-sm">
            <span
              className="inline-block h-4 w-4 rounded border border-primary bg-primary"
              aria-hidden
            />
            <span>
              <b>{principal?.name ?? "Estampa principal"}</b>
              <span className="text-muted-foreground">
                {" "}
                · principal, {principal ? measureLabel(principal) : ""}
              </span>
            </span>
          </li>
          {options.map((id) => {
            const app = getApplication(id)!;
            const on = apps.includes(id);
            return (
              <li key={id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>
                    <b>{app.name}</b>
                    <span className="text-muted-foreground"> · {measureLabel(app)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          A principal é pintada primeiro. As outras seguem a principal: mesmos desenhos, mesmas
          cores, mesma mão.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={disabled}>
          Voltar
        </Button>
        <Button onClick={onNext} disabled={disabled}>
          Criar a peça principal
        </Button>
      </div>
    </section>
  );
}
