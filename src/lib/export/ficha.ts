/**
 * Ficha técnica da coleção em PDF, gerada no navegador.
 * Traz os dados que a estamparia precisa: medidas, dpi, emenda e paleta.
 */

import { jsPDF } from "jspdf";
import { getApplication, measureLabel, FAMILY_LABEL } from "@/lib/catalog";
import type { Brief, Piece } from "@/lib/collection";
import { modelLabel, styleLabel, usageLabel, versionSuffix, versionTitle } from "@/lib/collection";
import { safeFileName } from "@/lib/export/download";

const VINHO = [111, 27, 44] as const;
const MARROM = [45, 29, 20] as const;
const APOIO = [117, 104, 117] as const;

async function thumbDataUrl(url: string, max = 220): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

export async function buildFichaTecnica(input: {
  name: string;
  brief: Brief;
  pieces: Piece[];
  dpiByPiece: Record<string, number>;
  sheetUrl?: string | null;
}): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 16;
  let y = margin;

  doc.setTextColor(...VINHO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("AiLou Studio", margin, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...APOIO);
  doc.text("FICHA TECNICA DA COLECAO", margin, y + 12);
  y += 22;

  doc.setTextColor(...MARROM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.name, margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...APOIO);
  const data = new Date().toLocaleDateString("pt-BR");
  doc.text(
    `${data} · ${styleLabel(input.brief.style)} · ${usageLabel(input.brief.usage)} · ${input.pieces.length} peças`,
    margin,
    y,
  );
  y += 8;

  input.brief.palette.slice(0, 5).forEach((hex, i) => {
    doc.setFillColor(hex);
    doc.rect(margin + i * 16, y, 12, 8, "F");
    doc.setFontSize(7);
    doc.setTextColor(...APOIO);
    doc.text(hex.toUpperCase(), margin + i * 16, y + 12);
  });
  y += 20;

  if (input.sheetUrl) {
    const sheet = await thumbDataUrl(input.sheetUrl, 420);
    if (sheet) {
      doc.setTextColor(...MARROM);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Prancha de motivos", margin, y);
      y += 4;
      try {
        doc.addImage(sheet, "JPEG", margin, y, 80, 53);
      } catch {
        // segue sem a prancha
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...APOIO);
      doc.text(
        doc.splitTextToSize(
          "Todas as peças desta coleção nascem desta mesma pintura, com os mesmos motivos e as mesmas cores.",
          pageWidth - margin * 2 - 86,
        ),
        margin + 86,
        y + 6,
      );
      y += 62;
    }
  }

  for (const piece of input.pieces) {
    const app = getApplication(piece.applicationId);
    if (!app) continue;
    if (y > 245) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(231, 224, 228);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    const source = piece.printUrl ?? piece.imageUrl;
    const thumb = source ? await thumbDataUrl(source) : null;
    if (thumb) {
      try {
        doc.addImage(thumb, "JPEG", margin, y, 32, 32);
      } catch {
        // segue sem a miniatura
      }
    }

    const textX = margin + 38;
    doc.setTextColor(...MARROM);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(app.name, textX, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...APOIO);
    const dpi = input.dpiByPiece[piece.id] ?? piece.dpi ?? 0;
    const linhas = [
      `${FAMILY_LABEL[app.family]} · ${measureLabel(app)}`,
      `Corte ${app.cutLengthCm} cm × largura do tecido ${app.fabricWidthCm} cm`,
      dpi ? `Resolução do arquivo: ${dpi} dpi` : "Resolução do arquivo: não informada",
      piece.seam
        ? `Emenda: ${piece.seam.ok ? "verificada" : "precisa de ajuste"} (razão ${piece.seam.score})`
        : app.family === "painel"
          ? "Arte posicionada no corte, sem emenda"
          : "Emenda não conferida",
      `Desenho criado pela IA${modelLabel(piece.timings) ? ` · ${modelLabel(piece.timings)}` : ""}`,
      ...(piece.versions && piece.versions.length > 0
        ? [
            `Versões no pacote: ${piece.versions
              .map((v) => `${versionTitle(v)} (${safeFileName(app.name)}-${versionSuffix(v)}.png)`)
              .join(", ")}`,
          ]
        : []),
    ];
    linhas.forEach((linha, i) => doc.text(linha, textX, y + 11 + i * 5));
    y += 40 + (piece.versions && piece.versions.length > 0 ? 5 : 0);
  }

  if (y > 250) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(9);
  doc.setTextColor(...APOIO);
  doc.text(
    doc.splitTextToSize(
      "Observações para a estamparia: imprimir no tamanho físico indicado em cada peça, sem redimensionar. Conferir escala e cores em prova de tecido antes da produção. As peças de repetição encaixam nas quatro bordas. Peças de painel e barrado já vêm no corte de 50 cm pela largura do tecido.",
      pageWidth - margin * 2,
    ),
    margin,
    y,
  );

  return doc.output("blob");
}
