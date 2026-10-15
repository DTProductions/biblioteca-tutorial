import type { BancoDoCatalogo, IntegracaoDoCatalogo, AutorDoCatalogo } from "../modules/acervo/catalogo";

async function tabelaExiste(db: BancoDoCatalogo, nome: string): Promise<boolean> {
  const [row] = await db`SELECT to_regclass(${'public.' + nome}) IS NOT NULL AS existe` as { existe: boolean }[];
  return row!.existe;
}

/** SQL entre módulos fica no adapter, e nunca dentro dos módulos de domínio. */
export const integracaoDoCatalogo: IntegracaoDoCatalogo = {
  async autor(db, id) {
    const [row] = await db`SELECT id, nome, tipo FROM autores WHERE id = ${id}` as AutorDoCatalogo[];
    return row ?? null;
  },
  async autoresPorNome(db, termo) {
    const rows = await db`SELECT id FROM autores WHERE nome ILIKE ${'%' + termo + '%'}` as { id: number }[];
    return rows.map((row) => row.id);
  },
  async sincronizarAutores(db, ids) {
    for (const id of new Set(ids)) {
      await db`UPDATE autores SET livros_no_acervo = (SELECT COUNT(*)::int FROM livros WHERE autor_id = ${id}) WHERE id = ${id}`;
    }
  },
  async disponibilidade(db, exemplarId, hoje) {
    if (await tabelaExiste(db, "emprestimos")) {
      const [emprestimo] = await db`SELECT id FROM emprestimos WHERE exemplar_id = ${exemplarId} AND data_devolucao IS NULL LIMIT 1`;
      if (emprestimo) return "emprestado";
    }
    if (await tabelaExiste(db, "reservas")) {
      const [reserva] = await db`SELECT id FROM reservas WHERE exemplar_id = ${exemplarId} AND situacao = 'ativa' AND data_expiracao::text > ${hoje} LIMIT 1`;
      if (reserva) return "reservado";
    }
    return "disponivel";
  },
  async exemplarTemHistorico(db, id) {
    if (await tabelaExiste(db, "emprestimos")) {
      const [row] = await db`SELECT id FROM emprestimos WHERE exemplar_id = ${id} LIMIT 1`;
      if (row) return true;
    }
    if (await tabelaExiste(db, "reservas")) {
      const [row] = await db`SELECT id FROM reservas WHERE exemplar_id = ${id} LIMIT 1`;
      if (row) return true;
    }
    return false;
  },
};
