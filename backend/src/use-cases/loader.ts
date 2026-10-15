import { Glob } from "bun";
import type { CasoDeUso } from "./types";

/** Os arquivos de cada aluno são descobertos sem um registro central concorrente. */
export async function carregarCasosDeUso(): Promise<CasoDeUso[]> {
  const arquivos = Array.from(
    new Glob("uc[0-9][0-9].ts").scanSync({ cwd: import.meta.dir }),
  ).sort();
  const casos: CasoDeUso[] = [];
  for (const arquivo of arquivos) {
    const modulo = await import(new URL(arquivo, import.meta.url).href);
    const caso = modulo.default as CasoDeUso;
    if (!caso || caso.id !== arquivo.slice(0, 4) || typeof caso.registrar !== "function") {
      throw new Error(`Caso de uso inválido: ${arquivo}`);
    }
    casos.push(caso);
  }
  return casos;
}
