import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LayoutPreview } from "@/components/studio/LayoutPreview";
import { APPLICATIONS, FAMILY_LABEL, FAMILY_ORDER, measureLabel } from "@/lib/catalog";

interface Props {
  palette: string[];
  onAdd: (applicationId: string) => void;
}

export function AddPieceSheet({ palette, onAdd }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="size-4" strokeWidth={1.5} />
          Adicionar peça
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-2xl">Catálogo de peças</SheetTitle>
          <SheetDescription>
            Escolha o que você quer costurar. Cada peça vira uma estampa da coleção.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 px-4 pb-8">
          {FAMILY_ORDER.map((family) => (
            <section key={family}>
              <p className="eyebrow">{FAMILY_LABEL[family]}</p>
              <div className="mt-3 space-y-3">
                {APPLICATIONS.filter((a) => a.family === family).map((app) => (
                  <article
                    key={app.id}
                    className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="overflow-hidden rounded-md border border-border">
                      <LayoutPreview app={app} palette={palette} aspect={1.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base leading-tight">{app.name}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {app.description}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{measureLabel(app)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          onAdd(app.id);
                          setOpen(false);
                        }}
                      >
                        <Plus className="size-4" strokeWidth={1.5} />
                        Adicionar
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
