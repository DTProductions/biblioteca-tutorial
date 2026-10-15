import type { SQL } from "bun";
import { NotFound } from "../../../shared/errors";
import type { RepositorioLeitores } from "../domain/RepositorioLeitores";
import type { DadosLeitor, Leitor } from "../domain/Leitor";

/** Apenas persistência: as regras pertencem às classes de cada caso de uso. */
export class LeitoresPostgres implements RepositorioLeitores {
  constructor(private readonly db: SQL) {}

  async buscar(q = ""): Promise<Leitor[]> {
    const termo = `%${q.trim()}%`;
    const numeros = q.replace(/\D/g, "");
    return await this.db<Leitor[]>`SELECT id, nome, cpf, email, telefone FROM leitores
      WHERE nome ILIKE ${termo} OR email ILIKE ${termo}
         OR cpf ILIKE ${termo} OR (${numeros !== ""} AND cpf LIKE ${`%${numeros}%`})
      ORDER BY nome, id`;
  }

  async obter(id: number): Promise<Leitor> {
    const [leitor] = await this.db<Leitor[]>`SELECT id, nome, cpf, email, telefone FROM leitores WHERE id = ${id}`;
    if (!leitor) throw new NotFound("Leitor não encontrado.");
    return leitor;
  }

  async existeCpf(cpf: string, excetoId: number | null = null): Promise<boolean> {
    const rows = await this.db`SELECT id FROM leitores WHERE cpf = ${cpf}
      AND (${excetoId}::INTEGER IS NULL OR id <> ${excetoId}) LIMIT 1`;
    return rows.length > 0;
  }

  async inserir(dados: DadosLeitor): Promise<Leitor> {
    const [leitor] = await this.db<Leitor[]>`INSERT INTO leitores (nome, cpf, email, telefone)
      VALUES (${dados.nome}, ${dados.cpf}, ${dados.email}, ${dados.telefone})
      RETURNING id, nome, cpf, email, telefone`;
    return leitor!;
  }

  async alterar(id: number, dados: DadosLeitor): Promise<Leitor> {
    const [leitor] = await this.db<Leitor[]>`UPDATE leitores
      SET nome = ${dados.nome}, cpf = ${dados.cpf}, email = ${dados.email}, telefone = ${dados.telefone}
      WHERE id = ${id} RETURNING id, nome, cpf, email, telefone`;
    return leitor!;
  }

  async remover(id: number): Promise<void> { await this.db`DELETE FROM leitores WHERE id = ${id}`; }
}
