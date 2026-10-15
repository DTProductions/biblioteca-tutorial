import type { IntegracaoDaAutoria } from "../modules/autoria/cadastro";

export const integracaoDaAutoria: IntegracaoDaAutoria = {
  async contarLivros(db, autorId) {
    const [row] = await db`SELECT COUNT(*)::int AS total FROM livros WHERE autor_id = ${autorId}` as { total: number }[];
    return row!.total;
  },
};
