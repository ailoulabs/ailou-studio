import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Application, Kit } from "@/lib/catalog";

export interface ApplicationRow {
  id: string;
  slug: string;
  name: string;
  family: string;
  description: string;
  fabric_width_cm: number;
  cut_length_cm: number;
  suggested_role: string;
  director_rules: string;
  params: unknown;
  sort_order: number;
}

export function rowToApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    fabricWidthCm: Number(row.fabric_width_cm),
    cutLengthCm: Number(row.cut_length_cm),
    suggestedRole: row.suggested_role as Application["suggestedRole"],
    directorRules: row.director_rules,
    family: row.family,
    params: row.params,
  } as Application;
}

export function applicationToRow(app: Application, sortOrder = 0) {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    family: app.family,
    description: app.description,
    fabric_width_cm: app.fabricWidthCm,
    cut_length_cm: app.cutLengthCm,
    suggested_role: app.suggestedRole,
    director_rules: app.directorRules,
    params: app.params as never,
    sort_order: sortOrder,
  };
}

export const listCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [apps, kits] = await Promise.all([
      context.supabase.from("applications").select("*").order("sort_order"),
      context.supabase.from("kits").select("*").order("sort_order"),
    ]);
    if (apps.error) throw new Error(apps.error.message);
    if (kits.error) throw new Error(kits.error.message);

    return {
      applications: (apps.data as unknown as ApplicationRow[]).map(rowToApplication),
      kits: (kits.data ?? []).map(
        (k): Kit => ({ usage: k.usage, name: k.name, applicationIds: k.application_ids }),
      ),
    };
  });

async function assertAdmin(context: { supabase: never; userId: string }) {
  const supabase = context.supabase as never as {
    rpc: (fn: string) => Promise<{ data: unknown }>;
  };
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Somente administradores podem alterar o catálogo.");
}

export const saveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { application: Application; sortOrder?: number }) => {
    z.object({
      application: z.object({
        id: z.string().min(1).max(80),
        slug: z.string().min(1).max(80),
        name: z.string().min(1).max(120),
        family: z.enum(["corrida", "barrado", "painel"]),
        description: z.string().max(2000),
        fabricWidthCm: z.number().positive().max(400),
        cutLengthCm: z.number().positive().max(400),
        suggestedRole: z.enum(["principal", "coordenado", "apoio"]),
        directorRules: z.string().max(4000),
        params: z.record(z.string(), z.unknown()),
      }),
      sortOrder: z.number().int().min(0).max(999).optional(),
    }).parse(data);
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("applications")
      .upsert(applicationToRow(data.application, data.sortOrder ?? 0));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().min(1).max(80) }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("applications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
