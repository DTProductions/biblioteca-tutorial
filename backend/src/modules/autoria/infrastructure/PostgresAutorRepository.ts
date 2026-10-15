import { sql } from "../../../infrastructure/postgres";
import { Autor, type TipoDeAutor } from "../domain/Autor";
import type { AutorRepository } from "../domain/AutorRepository";
import type { ConsultaDeAutores, ResumoDoAutor } from "../ConsultaDeAutores";
import { AutorId } from "../../../shared/identifiers";

type AutorRow = {
  id: number;
  nome: string;
  orcid: string | null;
  tipo: string;
  livros_no_acervo: number;
};

function toAutor(row: AutorRow): Autor {
  return new Autor(
    new AutorId(row.id),
    row.nome,
    row.tipo as TipoDeAutor,
    row.livros_no_acervo,
  );
}

export class PostgresAutorRepository
  implements AutorRepository, ConsultaDeAutores
{
  async findById(autorId: AutorId): Promise<Autor | null> {
    const [row] = (await sql`
      SELECT * FROM autores WHERE id = ${autorId.value}
    `) as AutorRow[];

    return row ? toAutor(row) : null;
  }

  async resumo(autorId: AutorId): Promise<ResumoDoAutor | null> {
    const autor = await this.findById(autorId);

    if (autor === null) return null;

    return {
      nome: autor.nome,
      tipo: autor.tipo,
      livrosNoAcervo: autor.livrosNoAcervo,
    };
  }

  async ajustarLivrosNoAcervo(autorId: AutorId, delta: number): Promise<void> {
    await sql`
      UPDATE autores SET livros_no_acervo = livros_no_acervo + ${delta}
       WHERE id = ${autorId.value}
    `;
  }

  async idsPorNome(termo: string): Promise<AutorId[]> {
    const rows = (await sql`
      SELECT id FROM autores WHERE nome ILIKE ${`%${termo}%`}
    `) as { id: number }[];

    return rows.map((row) => new AutorId(row.id));
  }
}
