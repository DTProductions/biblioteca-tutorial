import { sql } from "../../../infrastructure/postgres";

/**
 * A mesma tabela `livros` do SQLite, na sintaxe do Postgres. `autor_id`
 * continua sendo só um inteiro: nada de chave estrangeira entre módulos.
 */
export async function createAcervoTablesPostgres(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS livros (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      numero_registro TEXT NOT NULL UNIQUE,
      isbn TEXT NOT NULL UNIQUE,
      titulo TEXT NOT NULL,
      autor_id INTEGER NOT NULL,
      data_catalogacao TEXT NOT NULL
    )
  `;
}
