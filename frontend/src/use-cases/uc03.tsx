/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Livro } from "../api.ts";
import { FormularioRegistro, Pagina } from "../components/biblioteca.tsx";
import { CamposLivro } from "./uc01.tsx";

function AtualizarLivro() {
  return <Pagina titulo="Atualizar livro" descricao="Escolha o livro e corrija seus dados bibliográficos.">
    <FormularioRegistro<Livro> endpoint="/api/livros" editar rotulo={(livro) => `${livro.titulo} · ${livro.isbn}`} campos={(livro) => <CamposLivro livro={livro} />} montar={(dados) => ({ isbn: String(dados.get("isbn")), titulo: String(dados.get("titulo")), autorId: Number(dados.get("autorId")) })} sucesso={(livro) => `Livro “${livro.titulo}” atualizado.`} retorno="/livros" acao="Salvar alterações" />
  </Pagina>;
}

export default { id: "uc03", titulo: "Atualizar livro", caminho: "/livros/editar", Componente: AtualizarLivro };
