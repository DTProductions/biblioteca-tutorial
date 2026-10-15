/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Autor } from "../api.ts";
import { Campo, FormularioRegistro, Pagina } from "../components/biblioteca.tsx";

export function CamposAutor({ autor }: { autor: Autor | null }) {
  return <>
    <Campo nome="nome" titulo="Nome"><input id="nome" name="nome" required defaultValue={autor?.nome} /></Campo>
    <Campo nome="tipo" titulo="Categoria"><select id="tipo" name="tipo" required defaultValue={autor?.tipo ?? "literatura"}><option value="literatura">Literatura</option><option value="didatico">Didático</option></select></Campo>
  </>;
}

function CadastrarAutor() {
  return <Pagina titulo="Cadastrar autor" descricao="Registre os autores que poderão ser associados aos livros do acervo.">
    <FormularioRegistro<Autor> endpoint="/api/autores" rotulo={(autor) => autor.nome} campos={(autor) => <CamposAutor autor={autor} />} montar={(dados) => ({ nome: String(dados.get("nome")), tipo: String(dados.get("tipo")) })} sucesso={(autor) => `Autor “${autor.nome}” cadastrado.`} retorno="/autores" acao="Cadastrar autor" />
  </Pagina>;
}

export default { id: "uc05", titulo: "Cadastrar autor", caminho: "/autores/cadastrar", Componente: CadastrarAutor };
