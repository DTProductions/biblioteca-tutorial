/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Autor } from "../api.ts";
import { FormularioRegistro, Pagina } from "../components/biblioteca.tsx";
import { CamposAutor } from "./uc05.tsx";

function AtualizarAutor() {
  return <Pagina titulo="Atualizar autor" descricao="Altere o nome ou a categoria de um autor cadastrado.">
    <FormularioRegistro<Autor> endpoint="/api/autores" editar rotulo={(autor) => autor.nome} campos={(autor) => <CamposAutor autor={autor} />} montar={(dados) => ({ nome: String(dados.get("nome")), tipo: String(dados.get("tipo")) })} sucesso={(autor) => `Autor “${autor.nome}” atualizado.`} retorno="/autores" acao="Salvar alterações" aviso="A categoria deve comportar os livros já cadastrados: até 5 de literatura ou 10 didáticos." />
  </Pagina>;
}

export default { id: "uc07", titulo: "Atualizar autor", caminho: "/autores/editar", Componente: AtualizarAutor };
