/**
 * Endereço base que o processador usa para se auto-acionar.
 *
 * Regras:
 * 1. Se WORKER_BASE_URL estiver definida no ambiente do servidor, ela vence.
 *    Isso permite fixar o endereço público em produção mesmo que a requisição
 *    entre por um alias interno da plataforma.
 * 2. Caso contrário, usa a origem da requisição (protocolo + host).
 */
export function workerBaseUrl(requestUrl: string | URL): string {
  if (typeof process !== "undefined") {
    const configured = process.env["WORKER_BASE_URL"];
    if (configured && configured.trim() !== "") {
      return configured.replace(/\/+$/, "");
    }
  }
  const url = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
  return `${url.protocol}//${url.host}`;
}
