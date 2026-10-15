import { emTransacao } from "../../infrastructure/transaction";
import { NotFound } from "../../shared/errors";
import { getBodyAsObject, getFieldAsPositiveInt } from "../../shared/validation";
import { diaDoCatalogo } from "./domain/dadosDoLivro";
import { dadosFisicos } from "./domain/dadosDoExemplar";
import { NumeroRegistro } from "./domain/NumeroRegistro";
import { obterLivro, type BancoDoCatalogo, type IntegracaoDoCatalogo } from "./catalogo";

export type ExemplarDoCatalogo = {
  id: number; livroId: number; numeroRegistro: string; localizacao: string;
  estadoConservacao: string; dataCatalogacao: string;
  situacao: "disponivel" | "reservado" | "emprestado"; titulo: string; isbn: string;
};
type LinhaDoExemplar = {
  id: number; livro_id: number; numero_registro: string; localizacao: string;
  estado_conservacao: string; data_catalogacao: string; titulo: string; isbn: string;
};

/** Migração idempotente: só limpa o campo antigo depois de comprovar a cópia. */
export async function prepararExemplares(): Promise<void> {
  await emTransacao(async (tx) => {
    await tx`CREATE TABLE IF NOT EXISTS exemplares (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      livro_id INTEGER NOT NULL REFERENCES livros(id),
      numero_registro TEXT NOT NULL UNIQUE,
      localizacao TEXT NOT NULL,
      estado_conservacao TEXT NOT NULL,
      data_catalogacao TEXT NOT NULL
    )`;
    await tx`CREATE INDEX IF NOT EXISTS exemplares_livro_idx ON exemplares(livro_id)`;
    await tx`CREATE TABLE IF NOT EXISTS acervo_sequencias (
      ano TEXT PRIMARY KEY, ultimo INTEGER NOT NULL CHECK (ultimo >= 0)
    )`;
    await tx`
      INSERT INTO exemplares (livro_id, numero_registro, localizacao, estado_conservacao, data_catalogacao)
      SELECT id, numero_registro, 'Acervo', 'bom', data_catalogacao
      FROM livros WHERE numero_registro IS NOT NULL
      ON CONFLICT (numero_registro) DO NOTHING
    `;
    await tx`
      UPDATE livros l SET numero_registro = NULL
      WHERE numero_registro IS NOT NULL AND EXISTS (
        SELECT 1 FROM exemplares e WHERE e.livro_id = l.id AND e.numero_registro = l.numero_registro
      )
    `;
    await tx`
      INSERT INTO acervo_sequencias (ano, ultimo)
      SELECT substring(numero_registro, 1, 4), MAX(substring(numero_registro, 6)::int)
      FROM exemplares GROUP BY substring(numero_registro, 1, 4)
      ON CONFLICT (ano) DO UPDATE SET ultimo = GREATEST(acervo_sequencias.ultimo, EXCLUDED.ultimo)
    `;
  });
}

export async function exemplarDoCatalogo(db: BancoDoCatalogo, id: number, integracao: IntegracaoDoCatalogo, hoje: string): Promise<ExemplarDoCatalogo> {
  const [row] = await db`
    SELECT e.*, l.titulo, l.isbn FROM exemplares e JOIN livros l ON l.id = e.livro_id WHERE e.id = ${id}
  ` as LinhaDoExemplar[];
  if (!row) throw new NotFound("Exemplar não encontrado");
  return {
    id: row.id, livroId: row.livro_id, numeroRegistro: row.numero_registro,
    localizacao: row.localizacao, estadoConservacao: row.estado_conservacao,
    dataCatalogacao: row.data_catalogacao, titulo: row.titulo, isbn: row.isbn,
    situacao: await integracao.disponibilidade(db, row.id, hoje),
  };
}

export async function cadastrarExemplar(body: unknown, integracao: IntegracaoDoCatalogo, agora = new Date()): Promise<ExemplarDoCatalogo> {
  const data = getBodyAsObject(body);
  const livroId = getFieldAsPositiveInt(data, "livroId");
  const dados = dadosFisicos(body);
  const hoje = diaDoCatalogo(agora);
  const ano = hoje.slice(0, 4);
  return emTransacao(async (tx) => {
    await obterLivro(tx, livroId);
    const [contador] = await tx`
      INSERT INTO acervo_sequencias (ano, ultimo) VALUES (${ano}, 1)
      ON CONFLICT (ano) DO UPDATE SET ultimo = acervo_sequencias.ultimo + 1 RETURNING ultimo
    ` as { ultimo: number }[];
    const registro = NumeroRegistro.proximo(ano, contador!.ultimo - 1).value;
    const [row] = await tx`
      INSERT INTO exemplares (livro_id, numero_registro, localizacao, estado_conservacao, data_catalogacao)
      VALUES (${livroId}, ${registro}, ${dados.localizacao}, ${dados.estadoConservacao}, ${hoje}) RETURNING id
    ` as { id: number }[];
    return exemplarDoCatalogo(tx, row!.id, integracao, hoje);
  });
}

