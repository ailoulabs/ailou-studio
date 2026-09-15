// Script de pós-build.
// TanStack Start 1.168 não usa o preset Nitro do Vercel: gera dist/client e dist/server.
// Este script reorganiza esse output no formato Vercel Build Output API v3
// (.vercel/output/), que o Vercel serve nativamente sem framework detection.
//
// Layout resultante:
//   .vercel/output/
//     config.json               → rotas (filesystem → SSR fallback)
//     static/                   → assets do cliente (dist/client/*)
//     functions/index.func/     → função SSR (dist/server/* + wrapper Node)
//       .vc-config.json         → runtime nodejs22.x
//       index.mjs               → wrapper que faz a ponte fetch ↔ Node req/res
//       server.js               → entry point original do TanStack Start
//       assets/*.js             → server bundle chunks

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const distClient = path.join(root, "dist", "client");
const distServer = path.join(root, "dist", "server");
const outRoot = path.join(root, ".vercel", "output");
const outStatic = path.join(outRoot, "static");
const outFn = path.join(outRoot, "functions", "index.func");

if (!existsSync(distClient) || !existsSync(distServer)) {
  console.error("[build.mjs] dist/client ou dist/server não existem. Rode `vite build` antes.");
  process.exit(1);
}

console.log("[build.mjs] Limpando .vercel/output/ …");
await rm(outRoot, { recursive: true, force: true });
await mkdir(outStatic, { recursive: true });
await mkdir(outFn, { recursive: true });

console.log("[build.mjs] Copiando dist/client/ → .vercel/output/static/ …");
await cp(distClient, outStatic, { recursive: true });

console.log("[build.mjs] Copiando dist/server/ → .vercel/output/functions/index.func/ …");
await cp(distServer, outFn, { recursive: true });

console.log("[build.mjs] Escrevendo .vc-config.json …");
await writeFile(
  path.join(outFn, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      supportsResponseStreaming: true,
    },
    null,
    2,
  ) + "\n",
);

console.log("[build.mjs] Escrevendo wrapper index.mjs (fetch ↔ Node req/res) …");
const wrapper = `// Ponte entre o Vercel Node runtime (req/res clássico) e o entry Web Fetch
// do TanStack Start ({ fetch(request, env, ctx) => Response }).
import serverEntry from "./server.js";

/** @param {import("node:http").IncomingMessage} req */
/** @param {import("node:http").ServerResponse} res */
export default async function handler(req, res) {
  try {
    const protocol = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/", \`\${protocol}://\${host}\`).toString();

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) for (const v of value) headers.append(key, v);
      else headers.set(key, String(value));
    }

    let body;
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
    }

    const webRequest = new Request(url, {
      method: req.method ?? "GET",
      headers,
      body,
      // Only relevant when body is a stream, but harmless to include always.
      duplex: "half",
    });

    const response = await (serverEntry.default ?? serverEntry).fetch(
      webRequest,
      process.env,
      {},
    );

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (error) {
    console.error("[vercel-wrapper] erro SSR:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
}
`;
await writeFile(path.join(outFn, "index.mjs"), wrapper);

console.log("[build.mjs] Escrevendo config.json …");
await writeFile(
  path.join(outRoot, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index" },
      ],
    },
    null,
    2,
  ) + "\n",
);

console.log("[build.mjs] Pronto. Vercel Build Output API v3 gerado em .vercel/output/.");
