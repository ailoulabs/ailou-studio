import JSZip from "jszip";
import { getApplication, measureLabel } from "@/lib/catalog";
import { modelLabel, versionSuffix, versionTitle } from "@/lib/collection";
import type { Brief, Direction, Piece } from "@/lib/collection";
import type { FlowPiece } from "@/lib/flow-types";
import { moduleWidthCm, safeFileName, triggerDownload } from "@/lib/export/download";
import { dpiFor, writePngDpi } from "@/lib/export/png-dpi";
import { buildFichaTecnica } from "@/lib/export/ficha";

export async function downloadCollectionZip(input: {
  name: string;
  brief: Brief;
  direction: Direction | null;
  pieces: Piece[];
  sheetUrl?: string | null;
}): Promise<void> {
  const zip = new JSZip();
  const manifest: Record<string, unknown>[] = [];
  const dpiByPiece: Record<string, number> = {};

  for (const piece of input.pieces) {
    const app = getApplication(piece.applicationId);
    if (!app) continue;
    let dpi = 0;
    // Usa a versão preparada para impressão quando ela existir.
    const source = piece.printUrl ?? piece.imageUrl;
    if (source) {
      const res = await fetch(source);
      if (res.ok) {
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        dpi = dpiFor(bitmap.width, moduleWidthCm(app));
        bitmap.close();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        zip.file(`${safeFileName(app.name)}.png`, writePngDpi(bytes, dpi));
      }
    }
    dpiByPiece[piece.id] = dpi;

    // Cada versão entra no pacote com sufixo no nome do arquivo.
    const versionEntries: Record<string, unknown>[] = [];
    for (const version of piece.versions ?? []) {
      const fileName = `${safeFileName(app.name)}-${versionSuffix(version)}.png`;
      try {
        const res = await fetch(version.url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        const vDpi = dpiFor(bitmap.width, moduleWidthCm(app));
        bitmap.close();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        zip.file(fileName, writePngDpi(bytes, vDpi));
        versionEntries.push({
          versao: versionTitle(version),
          arquivo: fileName,
          dpi: vDpi,
          emenda: version.seam ?? null,
        });
      } catch {
        // uma versão indisponível não invalida o pacote
      }
    }

    manifest.push({
      peca: app.name,
      familia: app.family,
      papel: piece.role,
      medida: measureLabel(app),
      larguraDoTecidoCm: app.fabricWidthCm,
      corteCm: app.cutLengthCm,
      arquivo: `${safeFileName(app.name)}.png`,
      dpi,
      feitaPor: piece.madeBy ?? "ia",
      modelo: modelLabel(piece.timings),
      provedor: piece.timings?.provider ?? null,

      tempoTotalMs: piece.timings?.totalMs ?? null,
      emenda: piece.seam ?? null,
      composicao: piece.composition ?? null,
      versoes: versionEntries,
    });
  }

  zip.file(
    "colecao.json",
    JSON.stringify(
      {
        nome: input.name,
        brief: { ...input.brief, referenceImage: undefined },
        direcao: input.direction,
        pecas: manifest,
      },
      null,
      2,
    ),
  );

  try {
    const ficha = await buildFichaTecnica({
      name: input.name,
      brief: input.brief,
      pieces: input.pieces,
      dpiByPiece,
      sheetUrl: input.sheetUrl ?? null,
    });
    zip.file("ficha-tecnica.pdf", ficha);
  } catch {
    // sem a ficha, o restante do pacote continua válido
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${safeFileName(input.name) || "colecao"}.zip`);
}

/** Pacote do fluxo v0.7: as estampas prontas, com dpi no PNG, e o prompt usado. */
export async function downloadFlowZip(input: {
  name: string;
  pieces: FlowPiece[];
  prompt: string;
}): Promise<void> {
  const zip = new JSZip();
  const lines: string[] = [`Coleção: ${input.name}`, ""];
  let count = 0;
  for (const piece of input.pieces) {
    const app = getApplication(piece.applicationId);
    if (!app || !piece.imageUrl) continue;
    const res = await fetch(piece.imageUrl);
    if (!res.ok) continue;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const dpi = dpiFor(bitmap.width, moduleWidthCm(app));
    bitmap.close();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const prefix =
      piece.role === "principal"
        ? "01-principal"
        : `${String(piece.position + 1).padStart(2, "0")}`;
    const fileName = `${prefix}-${safeFileName(app.name)}.png`;
    zip.file(fileName, writePngDpi(bytes, dpi));
    lines.push(`${fileName}: ${app.name}, ${measureLabel(app)}, ${dpi} dpi`);
    count += 1;
  }
  if (count === 0) throw new Error("Nenhuma estampa pronta para baixar.");
  lines.push("", "Prompt da peça principal:", "", input.prompt);
  zip.file("leia-me.txt", lines.join("\n"));
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${safeFileName(input.name || "colecao")}.zip`);
}
