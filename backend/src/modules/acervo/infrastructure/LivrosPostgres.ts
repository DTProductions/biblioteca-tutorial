import type { SQL } from "bun";
import { NotFound } from "../../../shared/errors";
import type { ExemplaresDoLivro } from "../domain/ExemplaresDoLivro";
import type { LivroParaExclusao, RepositorioLivros } from "../domain/RepositorioLivros";

/** Apenas persistência: as regras pertencem às classes de cada caso de uso. */
export class LivrosPostgres implements RepositorioLivros, ExemplaresDoLivro {
  constructor(private readonly db: SQL) {}

  async obter(id: number): Promise<LivroParaExclusao> {
    const [livro] = await this.db`SELECT id, autor_id AS "autorId" FROM livros WHERE id = ${id}` as LivroParaExclusao[];
    if (!livro) throw new NotFound("Livro não encontrado");
    return livro;
  }

  async remover(id: number): Promise<void> { await this.db`DELETE FROM livros WHERE id = ${id}`; }

  async existemPara(livroId: number): Promise<boolean> {
    const [tabela] = await this.db`SELECT to_regclass('public.exemplares') IS NOT NULL AS existe` as { existe: boolean }[];
    if (tabela!.existe) {
      const rows = await this.db`SELECT id FROM exemplares WHERE livro_id = ${livroId} LIMIT 1`;
      return rows.length > 0;
    }
    // Antes da migração UC13, o campo legado ainda representa uma cópia física.
    const rows = await this.db`SELECT id FROM livros WHERE id = ${livroId} AND numero_registro IS NOT NULL`;
    return rows.length > 0;
  }
}
