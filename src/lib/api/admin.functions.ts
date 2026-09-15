import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminUser {
  userId: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
}

async function assertAdmin(supabase: {
  rpc: (fn: "is_admin") => Promise<{ data: unknown }>;
}): Promise<void> {
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("Somente administradores podem fazer isso.");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error("Não foi possível carregar a lista de pessoas.");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    const admins = new Set((roles ?? []).map((r) => r.user_id));

    return list.users.map((u) => ({
      userId: u.id,
      email: u.email ?? u.phone ?? "sem e-mail",
      createdAt: u.created_at,
      isAdmin: admins.has(u.id),
    }));
  });

export const grantAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error("Não foi possível promover essa pessoa.");
    return { ok: true };
  });
