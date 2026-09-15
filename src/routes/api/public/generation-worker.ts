import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function sameSecret(received: string, expected: string): boolean {
  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

/**
 * Processador de geração. Só o próprio servidor chama, com a chave interna.
 * Cada chamada processa um pedaço do trabalho e continua enquanto sobrar fila.
 */
export const Route = createFileRoute("/api/public/generation-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const environmentSecret = process.env["GENERATION_WORKER_SECRET"] ?? "";
        if (!environmentSecret) {
          console.error(
            "[generation-worker] GENERATION_WORKER_SECRET está vazio. O processador depende da chave sincronizada no banco.",
          );
        }

        let configuredSecret = "";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("get_generation_worker_secret");
          if (error) console.error("[generation-worker] Falha ao ler a chave sincronizada.", error);
          configuredSecret = typeof data === "string" ? data : "";
        } catch (error) {
          console.error("[generation-worker] Falha ao abrir a configuração do processador.", error);
        }

        const { BUILD_STAMP } = await import("@/lib/build-stamp");
        const badRequest = () =>
          Response.json({ error: "Bad request", build: BUILD_STAMP }, { status: 400 });

        let jobId = "";
        let bodySecret = "";
        try {
          const body = (await request.json()) as { jobId?: string; workerSecret?: string };
          jobId = String(body.jobId ?? "");
          bodySecret = String(body.workerSecret ?? "");
        } catch {
          return badRequest();
        }
        if (!jobId) return badRequest();

        const headerSecret = request.headers.get("x-worker-secret") ?? "";
        const authorization = request.headers.get("authorization") ?? "";
        const bearerSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        const candidates = [headerSecret, bearerSecret, bodySecret];
        const environmentMatches = candidates.map(
          (candidate) =>
            Boolean(candidate) && Boolean(environmentSecret) && sameSecret(candidate, environmentSecret),
        );
        const configuredMatches = candidates.map(
          (candidate) =>
            Boolean(candidate) && Boolean(configuredSecret) && sameSecret(candidate, configuredSecret),
        );
        const authorized = environmentMatches.some(Boolean) || configuredMatches.some(Boolean);
        if (!authorized) {
          console.error("[generation-worker] Chave do processador não confere.");
          return new Response("Unauthorized", { status: 401 });
        }

        const { processJobSlice } = await import("@/lib/jobs/engine.server");
        const result = await processJobSlice(jobId);

        // Só continua quando este processador é que ficou sem tempo.
        // Se outro está trabalhando, encerra e deixa o verificador acordar depois.
        if (result.pending && result.resume) {
          const { workerBaseUrl } = await import("@/lib/api/worker-base-url");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: job } = await supabaseAdmin
            .from("generation_jobs")
            .select("base_url")
            .eq("id", jobId)
            .maybeSingle();
          const base = job?.base_url
            ? workerBaseUrl(job.base_url)
            : workerBaseUrl(new URL(request.url));
          void fetch(`${base}/api/public/generation-worker`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-worker-secret": environmentSecret || configuredSecret,
              Authorization: `Bearer ${environmentSecret || configuredSecret}`,
            },
            body: JSON.stringify({ jobId, workerSecret: environmentSecret || configuredSecret }),
          }).catch(() => undefined);
        }

        return Response.json({ ok: true, pending: result.pending, build: BUILD_STAMP });
      },
    },
  },
});
