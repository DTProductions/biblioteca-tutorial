import type { SQL } from "bun";
import { VERSAO_SEED, type RelatorioSeed, type ResumoSeed } from "./modelo";

/** Fotografia da execução: consultar ou repetir não restaura dados que o professor alterou. */
export async function relatorioSeed(db: SQL): Promise<RelatorioSeed> {
  const [registro] = await db`SELECT data_referencia, resumo FROM seed_execucoes WHERE versao = ${VERSAO_SEED}`;
  return registro ? { executado: true, dataReferencia: registro.data_referencia, resumo: (typeof registro.resumo === "string" ? JSON.parse(registro.resumo) : registro.resumo) as ResumoSeed } : { executado: false };
}
