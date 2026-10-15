/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Autor } from "../api.ts";
import { ExclusaoRegistro, Pagina } from "../components/biblioteca.tsx";

function ExcluirAutor() {
  return <Pagina titulo="Excluir autor" descricao="Remova um autor que não tenha livros vinculados.">
    <ExclusaoRegistro<Autor> endpoint="/api/autores" rotulo={(autor) => autor.nome} retorno="/autores" aviso="A exclusão é definitiva. Autores com livros no acervo não podem ser excluídos." />
  </Pagina>;
}

export default { id: "uc08", titulo: "Excluir autor", caminho: "/autores/excluir", Componente: ExcluirAutor };
