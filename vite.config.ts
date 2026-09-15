import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { execSync } from "node:child_process";

/**
 * Carimbo de versão gravado no build: commit curto quando existir, mais a hora do build.
 * Usa VERCEL_GIT_COMMIT_SHA em produção Vercel; cai no git local no dev; "sem-git" senão.
 */
function buildStamp(): string {
  let commit = process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7) ?? "";
  if (!commit) {
    try {
      commit = execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      commit = "sem-git";
    }
  }
  const now = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  return `${commit}-${now}`;
}

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
  ],
  define: { __BUILD_STAMP__: JSON.stringify(buildStamp()) },
  server: { host: true, port: 8080 },
  // A função serverless montada em build.mjs não carrega node_modules ao lado,
  // então o bundle SSR precisa ser autossuficiente: embute todas as dependências.
  // Os módulos nativos do Node (node:crypto, node:fs, …) continuam externos.
  ssr: {
    noExternal: true,
  },
});
