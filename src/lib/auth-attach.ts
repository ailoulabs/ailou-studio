import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Anexa o token do usuário logado a toda chamada de server function.
 */
export const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return next();
  return next({ headers: { Authorization: `Bearer ${token}` } });
});
