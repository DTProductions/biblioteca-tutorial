import { sql } from "../../../infrastructure/postgres";
import { LivroId, AutorId } from "../../../shared/identifiers";
import { Isbn } from "../domain/Isbn";
import { Livro } from "../domain/Livro";
import type { LivroRepository } from "../domain/LivroRepository";
import { NumeroRegistro } from "../domain/NumeroRegistro";

type LivroRow = {
  id: number;
  numero_registro: string;
  isbn: string;
  titulo: string;
  autor_id: number;
  data_catalogacao: string;
};

function toLivro(row: LivroRow): Livro {
  return new Livro(
    new LivroId(row.id),
    new NumeroRegistro(row.numero_registro),
    new Isbn(row.isbn),
    row.titulo,
    new AutorId(row.autor_id),
    row.data_catalogacao,
  );
}

/**
 * Mesmo contrato do SqliteLivroRepository, outro banco. Os valores entram
 * pelo template `sql`...`` e viram parâmetros: nunca há concatenação de SQL.
 */
export class PostgresLivroRepository implements LivroRepository {
  async contarNoAcervoDoAutor(autorId: AutorId): Promise<number> {
    // COUNT devolve bigint, que chega como string; ::int faz chegar number
    const [row] = (await sql`
      SELECT COUNT(*)::int AS total FROM livros WHERE autor_id = ${autorId.value}
    `) as { total: number }[];

    return row!.total;
  }

  async contarCatalogadosNoAno(ano: string): Promise<number> {
    const [row] = (await sql`
      SELECT COUNT(*)::int AS total FROM livros
       WHERE data_catalogacao LIKE ${`${ano}%`}
    `) as { total: number }[];

    return row!.total;
  }

  async insert(livro: Livro): Promise<Livro> {
    const [row] = (await sql`
      INSERT INTO livros (numero_registro, isbn, titulo, autor_id, data_catalogacao)
      VALUES (${livro.numeroRegistro.value}, ${livro.isbn.value}, ${livro.titulo},
              ${livro.autorId.value}, ${livro.dataCatalogacao})
      RETURNING id
    `) as { id: number }[];

    return livro.withId(new LivroId(row!.id));
  }

  async findByIsbn(isbn: Isbn): Promise<Livro | null> {
    const [row] = (await sql`
      SELECT * FROM livros WHERE isbn = ${isbn.value}
    `) as LivroRow[];

    return row ? toLivro(row) : null;
  }

  async findByAutorId(autorId: AutorId): Promise<Livro[]> {
    const rows = (await sql`
      SELECT * FROM livros WHERE autor_id = ${autorId.value}
    `) as LivroRow[];

    return rows.map(toLivro);
  }

  async searchByTitulo(termo: string): Promise<Livro[]> {
    // no SQLite, LIKE ignora maiúsculas; no Postgres, não. ILIKE mantém o contrato
    const rows = (await sql`
      SELECT * FROM livros WHERE titulo ILIKE ${`%${termo}%`}
    `) as LivroRow[];

    return rows.map(toLivro);
  }

  async findByAutorIds(autorIds: AutorId[]): Promise<Livro[]> {
    if (autorIds.length === 0) return [];

    const ids = autorIds.map((autorId) => autorId.value);
    const rows = (await sql`
      SELECT * FROM livros WHERE autor_id IN ${sql(ids)}
    `) as LivroRow[];

    return rows.map(toLivro);
  }
}
