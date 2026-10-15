import type { SQL } from "bun";
import type { ContagemDosAutores } from "../modules/acervo/domain/ContagemDosAutores";
import { integracaoDoCatalogo } from "./acervoIntegracao";

/** Integra os módulos sem fazer o acervo conhecer a tabela de autores. */
export class ContagemDosAutoresPostgres implements ContagemDosAutores {
  constructor(private readonly db: SQL) {}

  async sincronizar(autorIds: number[]): Promise<void> {
    await integracaoDoCatalogo.sincronizarAutores(this.db, autorIds);
  }
}
