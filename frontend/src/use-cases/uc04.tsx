/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Livro } from "../api.ts";
import { ExclusaoRegistro, Pagina } from "../components/biblioteca.tsx";

function ExcluirLivro() {
  return <Pagina titulo="Excluir livro" descricao="Remova um registro bibliográfico que não tenha exemplares vinculados.">
    <ExclusaoRegistro<Livro> endpoint="/api/livros" rotulo={(livro) => `${livro.titulo} · ${livro.isbn}`} retorno="/livros" aviso="A exclusão é definitiva. Livros com exemplares vinculados não podem ser excluídos." />
  </Pagina>;
}

export default { id: "uc04", titulo: "Excluir livro", caminho: "/livros/excluir", Componente: ExcluirLivro };
