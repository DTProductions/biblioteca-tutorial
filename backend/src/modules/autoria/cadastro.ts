import type { SQL, TransactionSQL } from "bun";
import { emTransacao } from "../../infrastructure/transaction";
import { NotFound } from "../../shared/errors";
import { getFieldAsPositiveInt } from "../../shared/validation";
import { dadosDoAutor } from "./domain/dadosDoAutor";
import type { TipoDeAutor } from "./domain/Autor";
import { createAutoriaTablesPostgres } from "./infrastructure/postgresSchema";

export type BancoDaAutoria = SQL | TransactionSQL;
export type IntegracaoDaAutoria = { contarLivros: (db: BancoDaAutoria, autorId: number) => Promise<number> };
export type AutorCadastrado = { id: number; nome: string; tipo: TipoDeAutor; livrosNoAcervo: number };
export type LinhaDoAutor = { id: number; nome: string; tipo: TipoDeAutor; livros_no_acervo: number };

export const prepararAutores = createAutoriaTablesPostgres;

export function idDoAutor(raw: unknown): number {
  return getFieldAsPositiveInt({ id: raw }, "id");
}

export async function obterAutor(db: BancoDaAutoria, id: number): Promise<LinhaDoAutor> {
  const [row] = await db`SELECT id, nome, tipo, livros_no_acervo FROM autores WHERE id = ${id}` as LinhaDoAutor[];
  if (!row) throw new NotFound("Autor não encontrado");
  return row;
}

export async function autorCadastrado(db: BancoDaAutoria, row: LinhaDoAutor, integracao: IntegracaoDaAutoria): Promise<AutorCadastrado> {
  return { id: row.id, nome: row.nome, tipo: row.tipo, livrosNoAcervo: await integracao.contarLivros(db, row.id) };
}

export async function cadastrarAutor(body: unknown): Promise<AutorCadastrado> {
  const dados = dadosDoAutor(body);
  return emTransacao(async (tx) => {
    const [row] = await tx`INSERT INTO autores (nome, tipo) VALUES (${dados.nome}, ${dados.tipo}) RETURNING id, nome, tipo` as { id: number; nome: string; tipo: TipoDeAutor }[];
    return { ...row!, livrosNoAcervo: 0 };
  });
}

