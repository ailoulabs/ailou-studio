/** Marca do build em execução. Serve para saber qual versão atendeu cada unidade. */
declare const __BUILD_STAMP__: string | undefined;

export const BUILD_STAMP: string =
  typeof __BUILD_STAMP__ === "string" && __BUILD_STAMP__ ? __BUILD_STAMP__ : "dev";
