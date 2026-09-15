import { describe, expect, it } from "vitest";
import { checkSeam } from "@/lib/assembly/seam";

const SIZE = 256;

/** Cria uma imagem sintética a partir de uma função de cor por pixel. */
function make(fn: (x: number, y: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const i = (y * SIZE + x) * 4;
      const [r, g, b] = fn(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width: SIZE, height: SIZE, data, colorSpace: "srgb" } as ImageData;
}

/** Ruído estável, sem depender de Math.random. */
function noise(x: number, y: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function dots(periodX: number, periodY: number) {
  return (x: number, y: number): [number, number, number] => {
    const cx = ((x % periodX) + periodX) % periodX;
    const cy = ((y % periodY) + periodY) % periodY;
    const d = Math.hypot(cx - periodX / 2, cy - periodY / 2);
    return d < periodX * 0.25 ? [111, 27, 44] : [247, 237, 230];
  };
}

describe("checkSeam", () => {
  const scores: Record<string, number> = {};

  it("senoide contínua encaixa nas quatro bordas", () => {
    const r = checkSeam(
      make((x, y) => {
        const v = 128 + 100 * Math.sin((2 * Math.PI * 4 * x) / SIZE) * Math.cos((2 * Math.PI * 4 * y) / SIZE);
        return [v, v * 0.7, v * 0.5];
      }),
    );
    scores["senoide"] = r.score;
    expect(r.ok).toBe(true);
  });

  it("grade de bolinhas com número inteiro de períodos passa", () => {
    const r = checkSeam(make(dots(32, 32)));
    scores["bolinhas inteiras"] = r.score;
    expect(r.ok).toBe(true);
  });

  it("a mesma grade com meio período reprova", () => {
    // 256 / 34 não é inteiro: a última fileira fica cortada na borda.
    const r = checkSeam(make(dots(SIZE / 7.5, 32)));
    scores["bolinhas meio período"] = r.score;
    expect(r.ok).toBe(false);
  });

  it("emenda dura de foto reprova", () => {
    const r = checkSeam(
      make((x, y) => {
        const base = 60 + 160 * noise(Math.floor(x / 3), Math.floor(y / 3));
        const half = x > SIZE / 2 ? 60 : 0;
        return [base + half, base * 0.8, base * 0.6 + half];
      }),
    );
    scores["foto com emenda dura"] = r.score;
    expect(r.ok).toBe(false);
  });

  it("degradê suave emendável passa", () => {
    const r = checkSeam(
      make((x, y) => {
        const a = 128 + 60 * Math.cos((2 * Math.PI * x) / SIZE);
        const b = 128 + 60 * Math.cos((2 * Math.PI * y) / SIZE);
        return [a, b, (a + b) / 2];
      }),
    );
    scores["degradê suave"] = r.score;
    expect(r.ok).toBe(true);
  });

  it("registra os scores", () => {
    console.log("scores de emenda:", scores);
    expect(Object.keys(scores).length).toBeGreaterThan(0);
  });
});
