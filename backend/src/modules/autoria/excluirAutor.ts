import { emTransacao } from "../../infrastructure/transaction";
import { RuleConflict } from "../../shared/errors";
import { obterAutor, type IntegracaoDaAutoria } from "./cadastro";

export async function excluirAutor(id: number, integracao: IntegracaoDaAutoria): Promise<void> {
  await emTransacao(async (tx) => {
    await obterAutor(tx, id);
    if (await integracao.contarLivros(tx, id) > 0) throw new RuleConflict("Autor possui livros e não pode ser excluído");
    await tx`DELETE FROM autores WHERE id = ${id}`;
  });
}
