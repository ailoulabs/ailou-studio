import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { deleteApplication, listCatalog, saveApplication } from "@/lib/api/catalog.functions";
import { AdminUsers } from "@/components/studio/AdminUsers";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  APPLICATIONS,
  FAMILY_LABEL,
  FAMILY_ORDER,
  LAYOUT_LABEL,
  ROLE_LABEL,
  fmt,
  measureLabel,
  type Application,
  type CorridaLayout,
  type Family,
  type SuggestedRole,
} from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo de aplicações | AiLou Studio" },
      {
        name: "description",
        content:
          "Cadastro das aplicações do AiLou Studio: estampas corridas, barrados e painéis, com medidas e regras.",
      },
      { property: "og:title", content: "Catálogo de aplicações | AiLou Studio" },
      {
        property: "og:description",
        content: "Gerencie as aplicações que a artesã pode adicionar a uma coleção.",
      },
    ],
  }),
  component: CatalogPage,
});

interface FormState {
  id: string;
  name: string;
  family: Family;
  description: string;
  fabricWidthCm: string;
  suggestedRole: SuggestedRole;
  directorRules: string;
  rapportCm: string;
  layout: CorridaLayout;
  bands: string;
  bandHeightCm: string;
  borderPosition: "bottom" | "both";
  frameCount: string;
  frameWidthCm: string;
  frameHeightCm: string;
  frameShape: "rect" | "circle";
  marginCm: string;
  quiet: boolean;
  quietWidthCm: string;
  quietHeightCm: string;
  backgroundStyle: "plain" | "coordinate";
  /** Parâmetros extras da família (poá, listrado, xadrez) preservados ao salvar. */
  extra: Record<string, unknown>;
  /** Parâmetros extras do quadro nos painéis, como accent. */
  frameExtra: Record<string, unknown>;
}

const KNOWN_PARAMS = new Set([
  "rapportCm",
  "layout",
  "bands",
  "bandHeightCm",
  "borderPosition",
  "frames",
]);
const KNOWN_FRAME_PARAMS = new Set([
  "count",
  "widthCm",
  "heightCm",
  "shape",
  "marginCm",
  "backgroundStyle",
  "quietArea",
]);

function rest(source: unknown, known: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (!known.has(key)) out[key] = value;
    }
  }
  return out;
}

const EMPTY: FormState = {
  id: "",
  name: "",
  family: "corrida",
  description: "",
  fabricWidthCm: "150",
  suggestedRole: "coordenado",
  directorRules: "",
  rapportCm: "25",
  layout: "tossed",
  bands: "1",
  bandHeightCm: "50",
  borderPosition: "bottom",
  frameCount: "4",
  frameWidthCm: "37.5",
  frameHeightCm: "50",
  frameShape: "rect",
  marginCm: "1.5",
  quiet: false,
  quietWidthCm: "26",
  quietHeightCm: "26",
  backgroundStyle: "coordinate",
  extra: {},
  frameExtra: {},
};

function toForm(app: Application): FormState {
  const base: FormState = {
    ...EMPTY,
    id: app.id,
    name: app.name,
    family: app.family,
    description: app.description,
    fabricWidthCm: String(app.fabricWidthCm),
    suggestedRole: app.suggestedRole,
    directorRules: app.directorRules,
    extra: rest(app.params, KNOWN_PARAMS),
    frameExtra:
      app.family === "painel" ? rest(app.params.frames, KNOWN_FRAME_PARAMS) : {},
  };
  if (app.family === "corrida") {
    return { ...base, rapportCm: String(app.params.rapportCm), layout: app.params.layout };
  }
  if (app.family === "barrado") {
    return {
      ...base,
      bands: String(app.params.bands),
      bandHeightCm: String(app.params.bandHeightCm),
      borderPosition: app.params.borderPosition,
    };
  }
  const f = app.params.frames;
  return {
    ...base,
    frameCount: String(f.count),
    frameWidthCm: String(f.widthCm),
    frameHeightCm: String(f.heightCm),
    frameShape: f.shape,
    marginCm: String(f.marginCm),
    quiet: !!f.quietArea,
    quietWidthCm: String(f.quietArea?.widthCm ?? 26),
    quietHeightCm: String(f.quietArea?.heightCm ?? 26),
    backgroundStyle: f.backgroundStyle,
  };
}

function num(v: string, fallback = 0): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toApplication(f: FormState): Application {
  const slug = f.id || slugify(f.name) || `aplicacao-${Date.now()}`;
  const base = {
    id: slug,
    slug,
    name: f.name.trim() || "Nova aplicação",
    description: f.description.trim(),
    fabricWidthCm: num(f.fabricWidthCm, 150),
    cutLengthCm: 50,
    suggestedRole: f.suggestedRole,
    directorRules: f.directorRules.trim(),
  };
  if (f.family === "corrida") {
    return {
      ...base,
      family: "corrida",
      params: { ...f.extra, rapportCm: num(f.rapportCm, 25), layout: f.layout },
    };
  }
  if (f.family === "barrado") {
    return {
      ...base,
      family: "barrado",
      params: {
        ...f.extra,
        bands: num(f.bands, 1),
        bandHeightCm: num(f.bandHeightCm, 50),
        borderPosition: f.borderPosition,
      },
    };
  }
  return {
    ...base,
    family: "painel",
    params: {
      ...f.extra,
      frames: {
        ...f.frameExtra,
        count: num(f.frameCount, 1),
        widthCm: num(f.frameWidthCm, 50),
        heightCm: num(f.frameHeightCm, 50),
        shape: f.frameShape,
        marginCm: num(f.marginCm, 1.5),
        backgroundStyle: f.backgroundStyle,
        ...(f.quiet
          ? {
              quietArea: {
                shape: f.frameShape,
                widthCm: num(f.quietWidthCm, 26),
                heightCm: num(f.quietHeightCm, 26),
              },
            }
          : {}),
      },
    },
  };
}

function CatalogPage() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const fetchCatalog = useServerFn(listCatalog);
  const persistApp = useServerFn(saveApplication);
  const removeApp = useServerFn(deleteApplication);

  const { data } = useQuery({
    queryKey: ["catalog"],
    queryFn: () => fetchCatalog(),
  });

  const apps: Application[] = data?.applications ?? APPLICATIONS;
  const [form, setForm] = useState<FormState | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    const app = toApplication(form);
    try {
      await persistApp({ data: { application: app, sortOrder: apps.length } });
      await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      setForm(null);
      toast.success("Aplicação salva no catálogo.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  async function remove(id: string) {
    try {
      await removeApp({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Aplicação removida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover.");
    }
  }

  if (!loading && !isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl">Área restrita</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta tela é da administração do catálogo.
        </p>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8 sm:py-12">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Administração</p>
          <h1 className="mt-3">Catálogo de aplicações</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            As aplicações que a artesã pode adicionar a uma coleção. Por enquanto os dados ficam
            apenas nesta tela.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="size-4" strokeWidth={1.5} />
          Nova aplicação
        </Button>
      </div>

      <div className="mt-8 space-y-8">
        {FAMILY_ORDER.map((family) => (
          <section key={family} className="surface-card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <p className="eyebrow">{FAMILY_LABEL[family]}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Largura</TableHead>
                  <TableHead>Parâmetros</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps
                  .filter((a) => a.family === family)
                  .map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <span className="block">{app.name}</span>
                        <span className="text-xs text-muted-foreground">{measureLabel(app)}</span>
                      </TableCell>
                      <TableCell className="text-xs">{ROLE_LABEL[app.suggestedRole]}</TableCell>
                      <TableCell className="text-sm">{fmt(app.fabricWidthCm)} cm</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {app.family === "corrida" &&
                          `Rapport ${fmt(app.params.rapportCm)} cm · ${LAYOUT_LABEL[app.params.layout]}`}
                        {app.family === "barrado" &&
                          `${app.params.bands} × ${fmt(app.params.bandHeightCm)} cm · ${
                            app.params.borderPosition === "both" ? "duas bordas" : "borda inferior"
                          }`}
                        {app.family === "painel" &&
                          `${app.params.frames.count} quadros ${fmt(app.params.frames.widthCm)} × ${fmt(
                            app.params.frames.heightCm,
                          )} cm${app.params.frames.quietArea ? " · área calma" : ""}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setForm(toForm(app))}
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                            aria-label={`Editar ${app.name}`}
                          >
                            <Pencil className="size-4" strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(app.id)}
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                            aria-label={`Remover ${app.name}`}
                          >
                            <Trash2 className="size-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </section>
        ))}

        <AdminUsers />
      </div>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {form?.id ? "Editar aplicação" : "Nova aplicação"}
            </DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cat-nome">Nome</Label>
                  <Input
                    id="cat-nome"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Família</Label>
                  <Select
                    value={form.family}
                    onValueChange={(v) => set("family", v as Family)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{FAMILY_LABEL[form.family]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {FAMILY_ORDER.map((f) => (
                        <SelectItem key={f} value={f}>
                          {FAMILY_LABEL[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-largura">Largura do tecido em cm</Label>
                  <Input
                    id="cat-largura"
                    value={form.fabricWidthCm}
                    onChange={(e) => set("fabricWidthCm", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Papel sugerido</Label>
                  <Select
                    value={form.suggestedRole}
                    onValueChange={(v) => set("suggestedRole", v as SuggestedRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>{ROLE_LABEL[form.suggestedRole]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(["principal", "coordenado", "apoio"] as SuggestedRole[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat-desc">Descrição para a artesã</Label>
                <Textarea
                  id="cat-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              {form.family === "corrida" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cat-rapport">Rapport em cm</Label>
                    <Input
                      id="cat-rapport"
                      value={form.rapportCm}
                      onChange={(e) => set("rapportCm", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Layout</Label>
                    <Select
                      value={form.layout}
                      onValueChange={(v) => set("layout", v as CorridaLayout)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{LAYOUT_LABEL[form.layout]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LAYOUT_LABEL) as CorridaLayout[]).map((l) => (
                          <SelectItem key={l} value={l}>
                            {LAYOUT_LABEL[l]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {form.family === "barrado" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="cat-faixas">Faixas</Label>
                    <Input
                      id="cat-faixas"
                      value={form.bands}
                      onChange={(e) => set("bands", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-altura">Altura da faixa em cm</Label>
                    <Input
                      id="cat-altura"
                      value={form.bandHeightCm}
                      onChange={(e) => set("bandHeightCm", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posição da borda</Label>
                    <Select
                      value={form.borderPosition}
                      onValueChange={(v) => set("borderPosition", v as "bottom" | "both")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {form.borderPosition === "both" ? "Duas bordas" : "Borda inferior"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">Borda inferior</SelectItem>
                        <SelectItem value="both">Duas bordas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {form.family === "painel" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="cat-quadros">Quadros</Label>
                    <Input
                      id="cat-quadros"
                      value={form.frameCount}
                      onChange={(e) => set("frameCount", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-larg-q">Largura do quadro</Label>
                    <Input
                      id="cat-larg-q"
                      value={form.frameWidthCm}
                      onChange={(e) => set("frameWidthCm", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-alt-q">Altura do quadro</Label>
                    <Input
                      id="cat-alt-q"
                      value={form.frameHeightCm}
                      onChange={(e) => set("frameHeightCm", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Formato</Label>
                    <Select
                      value={form.frameShape}
                      onValueChange={(v) => set("frameShape", v as "rect" | "circle")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {form.frameShape === "circle" ? "Redondo" : "Retangular"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rect">Retangular</SelectItem>
                        <SelectItem value="circle">Redondo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-margem">Margem em cm</Label>
                    <Input
                      id="cat-margem"
                      value={form.marginCm}
                      onChange={(e) => set("marginCm", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fundo</Label>
                    <Select
                      value={form.backgroundStyle}
                      onValueChange={(v) => set("backgroundStyle", v as "plain" | "coordinate")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {form.backgroundStyle === "plain" ? "Liso" : "Coordenado"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plain">Liso</SelectItem>
                        <SelectItem value="coordinate">Coordenado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-3">
                    <Label>Área calma</Label>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant={form.quiet ? "default" : "outline"}
                        size="sm"
                        onClick={() => set("quiet", !form.quiet)}
                      >
                        {form.quiet ? "Com área calma" : "Sem área calma"}
                      </Button>
                      {form.quiet && (
                        <>
                          <Input
                            className="w-24"
                            aria-label="Largura da área calma"
                            value={form.quietWidthCm}
                            onChange={(e) => set("quietWidthCm", e.target.value)}
                          />
                          <span className="text-sm text-muted-foreground">×</span>
                          <Input
                            className="w-24"
                            aria-label="Altura da área calma"
                            value={form.quietHeightCm}
                            onChange={(e) => set("quietHeightCm", e.target.value)}
                          />
                          <span className="text-sm text-muted-foreground">cm</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cat-regras">Regras para o diretor criativo</Label>
                <Textarea
                  id="cat-regras"
                  rows={3}
                  value={form.directorRules}
                  onChange={(e) => set("directorRules", e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={save}>Salvar aplicação</Button>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
