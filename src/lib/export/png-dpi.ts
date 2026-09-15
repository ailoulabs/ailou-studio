/**
 * Grava o chunk pHYs em um PNG, para que a estamparia leia o DPI correto.
 * DPI = pixels / (cm / 2,54)
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function dpiFor(pixels: number, cm: number): number {
  if (cm <= 0) return 300;
  return Math.round(pixels / (cm / 2.54));
}

/** Retorna um novo PNG com pHYs correspondente ao DPI informado. */
export function writePngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const perMeter = Math.round(dpi / 0.0254);

  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, perMeter);
  view.setUint32(12, perMeter);
  chunk[16] = 1; // unidade: metro
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  // Insere logo após o IHDR (8 bytes de assinatura + 25 bytes do IHDR),
  // removendo um pHYs existente, se houver.
  const out: Uint8Array[] = [];
  out.push(png.subarray(0, 8));
  let offset = 8;
  let inserted = false;
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);

  while (offset < png.length) {
    const length = dv.getUint32(offset);
    const type = String.fromCharCode(
      png[offset + 4]!,
      png[offset + 5]!,
      png[offset + 6]!,
      png[offset + 7]!,
    );
    const total = length + 12;
    if (type !== "pHYs") out.push(png.subarray(offset, offset + total));
    offset += total;
    if (type === "IHDR" && !inserted) {
      out.push(chunk);
      inserted = true;
    }
    if (type === "IEND") break;
  }

  const size = out.reduce((n, part) => n + part.length, 0);
  const result = new Uint8Array(size);
  let cursor = 0;
  for (const part of out) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
}

export async function blobWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([writePngDpi(bytes, dpi) as unknown as BlobPart], { type: "image/png" });
}
