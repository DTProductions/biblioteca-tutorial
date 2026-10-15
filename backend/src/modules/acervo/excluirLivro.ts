import { emTransacao } from "../../infrastructure/transaction";
import { RuleConflict } from "../../shared/errors";
import { obterLivro, type IntegracaoDoCatalogo } from "./catalogo";

export async function excluirLivro(id: number, integracao: IntegracaoDoCatalogo): Promise<void> {
  await emTransacao(async (tx) => {
    const livro = await obterLivro(tx, id);
    const [tabela] = await tx`SELECT to_regclass('public.exemplares') IS NOT NULL AS existe` as { existe: boolean }[];
    if (tabela!.existe) {
      const [vinculo] = await tx`SELECT id FROM exemplares WHERE livro_id = ${id} LIMIT 1`;
      if (vinculo) throw new RuleConflict("Livro possui exemplares e não pode ser excluído");
    } else {
      // Antes da migração UC13, o campo legado ainda representa uma cópia física.
      const [legado] = await tx`SELECT id FROM livros WHERE id = ${id} AND numero_registro IS NOT NULL`;
      if (legado) throw new RuleConflict("Livro possui exemplar legado; integre UC13 antes de excluí-lo");
    }
    await tx`DELETE FROM livros WHERE id = ${id}`;
    await integracao.sincronizarAutores(tx, [livro.autor_id]);
  });
}
