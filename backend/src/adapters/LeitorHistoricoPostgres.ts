import type { SQL } from "bun";
import type { HistoricoDoLeitor } from "../modules/leitores/domain/HistoricoDoLeitor";

/** Integra os módulos sem fazer leitores conhecer o esquema de circulação. */
export class LeitorHistoricoPostgres implements HistoricoDoLeitor {
  constructor(private readonly db: SQL) {}

  async existePara(leitorId: number): Promise<boolean> {
    for (const tabela of ["reservas", "emprestimos"] as const) {
      const [existente] = await this.db`SELECT to_regclass(${tabela}) AS tabela`;
      if (!existente?.tabela) continue;
      const rows = tabela === "reservas"
        ? await this.db`SELECT id FROM reservas WHERE leitor_id = ${leitorId} LIMIT 1`
        : await this.db`SELECT id FROM emprestimos WHERE leitor_id = ${leitorId} LIMIT 1`;
      if (rows.length) return true;
    }
    return false;
  }
}
