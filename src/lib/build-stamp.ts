/** Marca do build em execução. Serve para saber qual versão atendeu cada unidade. */
declare const __BUILD_STAMP__: string | undefined;

export const BUILD_STAMP: string =
  typeof __BUILD_STAMP__ === "string" && __BUILD_STAMP__ ? __BUILD_STAMP__ : "dev";

export interface BuildVersion {
  /** Commit curto, o que casa com o git log. */
  commit: string;
  /** Data e hora do build no horário de Brasília, vazio quando não dá para ler. */
  when: string;
}

const PAD = (n: number) => String(n).padStart(2, "0");

/**
 * Quebra a marca do build em commit e momento.
 * O carimbo vem como "<commit>-AAAAMMDDHHMM" em UTC, e o commit pode conter hífen
 * ("sem-git"), então a leitura é feita a partir do fim.
 *
 * A conversão para Brasília é feita na mão, sem API de fuso e sem locale, porque
 * o cabeçalho é renderizado no servidor e no navegador: qualquer diferença entre
 * os dois quebraria a hidratação do React.
 */
export function formatBuildStamp(stamp: string = BUILD_STAMP): BuildVersion {
  const match = /^(.*)-(\d{12})$/.exec(stamp);
  if (!match) return { commit: stamp, when: "" };

  const commit = match[1] ?? stamp;
  const ts = match[2] ?? "";
  const utc = Date.UTC(
    Number(ts.slice(0, 4)),
    Number(ts.slice(4, 6)) - 1,
    Number(ts.slice(6, 8)),
    Number(ts.slice(8, 10)),
    Number(ts.slice(10, 12)),
  );
  if (Number.isNaN(utc)) return { commit, when: "" };

  // Brasília é UTC-3 o ano inteiro desde que o horário de verão acabou, em 2019.
  const d = new Date(utc - 3 * 60 * 60 * 1000);
  const when = `${PAD(d.getUTCDate())}/${PAD(d.getUTCMonth() + 1)} ${PAD(d.getUTCHours())}:${PAD(d.getUTCMinutes())}`;
  return { commit, when };
}
