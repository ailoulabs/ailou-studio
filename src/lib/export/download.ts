import { blobWithDpi, dpiFor } from "@/lib/export/png-dpi";
import type { Application } from "@/lib/catalog";

/** Largura física, em cm, do módulo gerado para cada família. */
export function moduleWidthCm(app: Application): number {
  if (app.family === "corrida") return app.params.rapportCm;
  if (app.family === "barrado") return app.cutLengthCm;
  return app.params.frames.widthCm;
}

export async function downloadPieceImage(
  imageUrl: string,
  app: Application,
  fileName: string,
): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Não foi possível baixar a imagem.");
  const blob = await res.blob();

  const bitmap = await createImageBitmap(blob);
  const dpi = dpiFor(bitmap.width, moduleWidthCm(app));
  bitmap.close();

  const withDpi = await blobWithDpi(blob, dpi);
  triggerDownload(withDpi, fileName);
}

/**
 * Dispara o download de um blob.
 *
 * Dois detalhes que faziam o botao nao fazer nada:
 * 1. revokeObjectURL logo depois do click() derruba a URL antes de o navegador
 *    comecar a ler o arquivo. A liberacao tem que esperar.
 * 2. o link precisa estar dentro da pagina para o clique programatico valer;
 *    fora do documento, parte dos navegadores ignora.
 */
export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Tempo folgado: o navegador ainda esta lendo o blob quando o clique retorna.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function safeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
