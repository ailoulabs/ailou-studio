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
  const url = URL.createObjectURL(withDpi);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function safeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
