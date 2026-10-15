import { emTransacao } from "../../infrastructure/transaction";
import { dadosDoLivro, diaDoCatalogo } from "./domain/dadosDoLivro";
import { obterLivro, verificarLivro, livroDoCatalogo, type IntegracaoDoCatalogo, type LivroDoCatalogo, type LinhaDoLivro } from "./catalogo";

export async function atualizarLivro(id: number, body: unknown, integracao: IntegracaoDoCatalogo, agora = new Date()): Promise<LivroDoCatalogo> {
  const dados = dadosDoLivro(body);
  return emTransacao(async (tx) => {
    const anterior = await obterLivro(tx, id);
    await verificarLivro(tx, dados, integracao, id);
    const [row] = await tx`UPDATE livros SET isbn = ${dados.isbn}, titulo = ${dados.titulo}, autor_id = ${dados.autorId} WHERE id = ${id} RETURNING id, isbn, titulo, autor_id, data_catalogacao` as LinhaDoLivro[];
    await integracao.sincronizarAutores(tx, [anterior.autor_id, dados.autorId]);
    return livroDoCatalogo(tx, row!, integracao, diaDoCatalogo(agora));
  });
}
