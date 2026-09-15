import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutPreview } from "@/components/studio/LayoutPreview";
import { getApplication } from "@/lib/catalog";
import { listCollections } from "@/lib/api/collections.functions";

export const Route = createFileRoute("/_authenticated/colecoes")({
  head: () => ({
    meta: [
      { title: "Minhas coleções | AiLou Studio" },
      {
        name: "description",
        content: "Suas coleções de estampas salvas no AiLou Studio, prontas para retomar e baixar.",
      },
      { property: "og:title", content: "Minhas coleções | AiLou Studio" },
      {
        property: "og:description",
        content: "Retome uma coleção salva ou comece uma nova no AiLou Studio.",
      },
    ],
  }),
  component: CollectionsPage,
});

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  proposta: "Proposta em revisão",
  gerando: "Em criação",
  pronta: "Pronta",
};

function CollectionsPage() {
  const fetchCollections = useServerFn(listCollections);
  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: () => fetchCollections(),
  });

  const collections = data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-12">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Seu acervo</p>
          <h1 className="mt-3">Minhas coleções</h1>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/studio">
            <Plus className="size-4" strokeWidth={1.5} />
            Nova coleção
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="surface-card mt-8 grid place-items-center gap-3 p-12 text-center">
          <h2 className="text-2xl">Sua primeira coleção começa aqui</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Conte a sua ideia, escolha as peças e deixe o Studio desenhar as estampas coordenadas.
          </p>
          <Button asChild className="mt-2">
            <Link to="/studio">Criar minha primeira coleção</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const pieces = (c.pieces ?? []) as { application_id: string }[];
            const cover = pieces[0] ? getApplication(pieces[0].application_id) : undefined;
            const palette = c.palette ?? [];
            const brief = (c.brief ?? {}) as { style?: string };
            return (
              <article key={c.id} className="surface-card overflow-hidden">
                {cover && <LayoutPreview app={cover} palette={palette} aspect={1.5} />}
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="eyebrow">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <Badge
                      variant="secondary"
                      className="border border-border bg-blush/50 text-primary"
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </div>
                  <h2 className="text-xl leading-tight">{c.name}</h2>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex gap-1">
                      {palette.map((color, i) => (
                        <span
                          key={`${color}-${i}`}
                          className="size-4 rounded-full border border-border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                    <span>
                      {pieces.length} {pieces.length === 1 ? "peça" : "peças"}
                      {brief.style ? "" : ""}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/studio" search={{ colecao: c.id as string }}>
                      Abrir coleção
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
