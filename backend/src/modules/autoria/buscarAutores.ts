import { sql } from "../../infrastructure/postgres";
import { autorCadastrado, obterAutor, type AutorCadastrado, type IntegracaoDaAutoria, type LinhaDoAutor } from "./cadastro";

export async function buscarAutores(termo: string, integracao: IntegracaoDaAutoria): Promise<AutorCadastrado[]> {
  const q = termo.trim();
  const id = /^\d+$/.test(q) ? Number(q) : 0;
  const rows = await sql`SELECT id, nome, tipo, livros_no_acervo FROM autores WHERE ${q} = '' OR id = ${id} OR nome ILIKE ${'%' + q + '%'} ORDER BY nome, id` as LinhaDoAutor[];
  return Promise.all(rows.map((row) => autorCadastrado(sql, row, integracao)));
}

export async function consultarAutor(id: number, integracao: IntegracaoDaAutoria): Promise<AutorCadastrado> {
  return autorCadastrado(sql, await obterAutor(sql, id), integracao);
}
