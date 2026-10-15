import { emTransacao } from "../../infrastructure/transaction";
import { RuleConflict } from "../../shared/errors";
import { dadosDoAutor } from "./domain/dadosDoAutor";
import { obterAutor, autorCadastrado, type AutorCadastrado, type IntegracaoDaAutoria, type LinhaDoAutor } from "./cadastro";

export async function atualizarAutor(id: number, body: unknown, integracao: IntegracaoDaAutoria): Promise<AutorCadastrado> {
  const dados = dadosDoAutor(body);
  return emTransacao(async (tx) => {
    await obterAutor(tx, id);
    const quantidade = await integracao.contarLivros(tx, id);
    const limite = dados.tipo === "literatura" ? 5 : 10;
    if (quantidade > limite) throw new RuleConflict(`O autor possui ${quantidade} livros; o tipo escolhido permite ${limite}`);
    const [row] = await tx`UPDATE autores SET nome = ${dados.nome}, tipo = ${dados.tipo}, livros_no_acervo = ${quantidade} WHERE id = ${id} RETURNING id, nome, tipo, livros_no_acervo` as LinhaDoAutor[];
    return autorCadastrado(tx, row!, integracao);
  });
}
