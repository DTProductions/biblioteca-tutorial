import { sql } from "../../infrastructure/postgres";
import { InvalidInput } from "../../shared/errors";
import { identificador, diaDoCatalogo } from "./domain/dadosDoLivro";
import type { IntegracaoDoCatalogo } from "./catalogo";
import { exemplarDoCatalogo, type ExemplarDoCatalogo } from "./exemplares";

export type FiltrosDeExemplares = { q?: string; livroId?: string; situacao?: string };
export async function buscarExemplares(filtros: FiltrosDeExemplares, integracao: IntegracaoDoCatalogo, agora = new Date()): Promise<ExemplarDoCatalogo[]> {
  const q = filtros.q?.trim() ?? "";
  const livroId = filtros.livroId ? identificador(filtros.livroId) : 0;
  const situacao = filtros.situacao?.trim() ?? "";
  if (situacao && !["disponivel", "reservado", "emprestado"].includes(situacao)) throw new InvalidInput("Situação de exemplar inválida");
  const rows = await sql`
    SELECT e.id FROM exemplares e JOIN livros l ON l.id = e.livro_id
    WHERE (${livroId} = 0 OR e.livro_id = ${livroId}) AND (
      ${q} = '' OR e.numero_registro ILIKE ${'%' + q + '%'} OR l.titulo ILIKE ${'%' + q + '%'}
      OR l.isbn ILIKE ${'%' + q.replace(/[^0-9]/g, '') + '%'} AND ${/\d/.test(q)}
    ) ORDER BY e.numero_registro, e.id
  ` as { id: number }[];
  const exemplares = await Promise.all(rows.map((row) => exemplarDoCatalogo(sql, row.id, integracao, diaDoCatalogo(agora))));
  return situacao ? exemplares.filter((exemplar) => exemplar.situacao === situacao) : exemplares;
}

export async function consultarExemplar(id: number, integracao: IntegracaoDoCatalogo, agora = new Date()): Promise<ExemplarDoCatalogo> {
  return exemplarDoCatalogo(sql, id, integracao, diaDoCatalogo(agora));
}
