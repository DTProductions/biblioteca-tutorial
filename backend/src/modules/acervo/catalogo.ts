import type { SQL, TransactionSQL } from "bun";
import { emTransacao } from "../../infrastructure/transaction";
import { NotFound, RuleConflict } from "../../shared/errors";
import { createAcervoTablesPostgres } from "./infrastructure/postgresSchema";
import { LimiteDeLivros } from "./domain/LimiteDeLivros";
import { dadosDoLivro, diaDoCatalogo, type DadosDoLivro } from "./domain/dadosDoLivro";

export type BancoDoCatalogo = SQL | TransactionSQL;
export type AutorDoCatalogo = { id: number; nome: string; tipo: "literatura" | "didatico" };
export type IntegracaoDoCatalogo = {
  autor: (db: BancoDoCatalogo, id: number) => Promise<AutorDoCatalogo | null>;
  autoresPorNome: (db: BancoDoCatalogo, termo: string) => Promise<number[]>;
  sincronizarAutores: (db: BancoDoCatalogo, ids: number[]) => Promise<void>;
  disponibilidade: (db: BancoDoCatalogo, exemplarId: number, hoje: string) => Promise<"disponivel" | "reservado" | "emprestado">;
  exemplarTemHistorico: (db: BancoDoCatalogo, id: number) => Promise<boolean>;
};
export type LivroDoCatalogo = {
  id: number; isbn: string; titulo: string; autorId: number; autor: string;
  dataCatalogacao: string; livrosDoAutor: number; totalExemplares: number; exemplaresDisponiveis: number;
};
export type LinhaDoLivro = { id: number; isbn: string; titulo: string; autor_id: number; data_catalogacao: string };

/** UC01: o registro bibliográfico deixa de exigir um número de cópia física. */
export async function prepararCatalogo(): Promise<void> {
  await createAcervoTablesPostgres();
  await emTransacao(async (tx) => {
    await tx`ALTER TABLE livros ALTER COLUMN numero_registro DROP NOT NULL`;
  });
}

export async function obterLivro(db: BancoDoCatalogo, id: number): Promise<LinhaDoLivro> {
  const [row] = await db`SELECT id, isbn, titulo, autor_id, data_catalogacao FROM livros WHERE id = ${id}` as LinhaDoLivro[];
  if (!row) throw new NotFound("Livro não encontrado");
  return row;
}

export async function livroDoCatalogo(db: BancoDoCatalogo, row: LinhaDoLivro, integracao: IntegracaoDoCatalogo, hoje: string): Promise<LivroDoCatalogo> {
  const autor = await integracao.autor(db, row.autor_id);
  const [contagem] = await db`SELECT COUNT(*)::int AS total FROM livros WHERE autor_id = ${row.autor_id}` as { total: number }[];
  const [tabela] = await db`SELECT to_regclass('public.exemplares') IS NOT NULL AS existe` as { existe: boolean }[];
  const exemplares = tabela?.existe
    ? await db`SELECT id FROM exemplares WHERE livro_id = ${row.id}` as { id: number }[]
    : [];
  const situacoes = await Promise.all(exemplares.map((e) => integracao.disponibilidade(db, e.id, hoje)));
  return {
    id: row.id, isbn: row.isbn, titulo: row.titulo, autorId: row.autor_id,
    autor: autor?.nome ?? "Autor não encontrado", dataCatalogacao: row.data_catalogacao,
    livrosDoAutor: contagem?.total ?? 0, totalExemplares: exemplares.length,
    exemplaresDisponiveis: situacoes.filter((situacao) => situacao === "disponivel").length,
  };
}

/** Verificações e escrita usam a mesma transação e o mesmo lock de toda a biblioteca. */
export async function verificarLivro(db: BancoDoCatalogo, dados: DadosDoLivro, integracao: IntegracaoDoCatalogo, ignorarId = 0): Promise<void> {
  const autor = await integracao.autor(db, dados.autorId);
  if (!autor) throw new NotFound("Autor não cadastrado");
  const [isbnRepetido] = await db`SELECT id FROM livros WHERE isbn = ${dados.isbn} AND id <> ${ignorarId}`;
  if (isbnRepetido) throw new RuleConflict("Livro já cadastrado");
  const [tituloRepetido] = await db`
    SELECT id FROM livros WHERE autor_id = ${dados.autorId}
      AND lower(btrim(titulo)) = lower(btrim(${dados.titulo})) AND id <> ${ignorarId}
  `;
  if (tituloRepetido) throw new RuleConflict("Este autor já tem um livro com este título");
  const [contagem] = await db`SELECT COUNT(*)::int AS total FROM livros WHERE autor_id = ${dados.autorId} AND id <> ${ignorarId}` as { total: number }[];
  LimiteDeLivros.verificar(autor.tipo === "literatura" ? "curta" : "ampla", contagem!.total);
}

export async function cadastrarLivro(body: unknown, integracao: IntegracaoDoCatalogo, agora = new Date()): Promise<LivroDoCatalogo> {
  const dados = dadosDoLivro(body);
  const hoje = diaDoCatalogo(agora);
  return emTransacao(async (tx) => {
    await verificarLivro(tx, dados, integracao);
    const [row] = await tx`
      INSERT INTO livros (isbn, titulo, autor_id, data_catalogacao)
      VALUES (${dados.isbn}, ${dados.titulo}, ${dados.autorId}, ${hoje})
      RETURNING id, isbn, titulo, autor_id, data_catalogacao
    ` as LinhaDoLivro[];
    await integracao.sincronizarAutores(tx, [dados.autorId]);
    return livroDoCatalogo(tx, row!, integracao, hoje);
  });
}

