import { sql } from "../../infrastructure/postgres";
import { Isbn } from "./domain/Isbn";
import { diaDoCatalogo } from "./domain/dadosDoLivro";
import { livroDoCatalogo, type IntegracaoDoCatalogo, type LinhaDoLivro, type LivroDoCatalogo } from "./catalogo";

/** Mantém a prioridade existente: ISBN exato, depois título, depois autor. */
export async function buscarLivros(termo: string, integracao: IntegracaoDoCatalogo, agora = new Date()): Promise<LivroDoCatalogo[]> {
  const q = termo.trim();
  let rows: LinhaDoLivro[] = [];
  if (q === "") rows = await sql`SELECT * FROM livros ORDER BY titulo, id` as LinhaDoLivro[];
  else {
    if (Isbn.isValid(q)) rows = await sql`SELECT * FROM livros WHERE isbn = ${new Isbn(q).value}` as LinhaDoLivro[];
    if (rows.length === 0) rows = await sql`SELECT * FROM livros WHERE titulo ILIKE ${'%' + q + '%'} ORDER BY titulo, id` as LinhaDoLivro[];
    if (rows.length === 0) {
      const ids = await integracao.autoresPorNome(sql, q);
      if (ids.length > 0) rows = await sql`SELECT * FROM livros WHERE autor_id IN ${sql(ids)} ORDER BY titulo, id` as LinhaDoLivro[];
    }
  }
  return Promise.all(rows.map((row) => livroDoCatalogo(sql, row, integracao, diaDoCatalogo(agora))));
}

