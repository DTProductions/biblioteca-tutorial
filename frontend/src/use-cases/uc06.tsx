/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { useSearchParams } from "react-router-dom";
import { type Autor } from "../api.ts";
import { Acoes, Busca, Carregamento, Pagina, Tabela, useDados } from "../components/biblioteca.tsx";

function BuscarAutores() {
  const [params] = useSearchParams();
  const consulta = useDados<Autor[]>(`/api/autores?q=${encodeURIComponent(params.get("q") ?? "")}`);
  return <Pagina titulo="Buscar autores" descricao="Encontre um autor pelo nome ou identificador e consulte sua quantidade de livros no acervo.">
    <Busca dica="Nome ou identificador do autor" />
    <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
    {consulta.dados && (consulta.dados.length ? <Tabela titulo="Autores encontrados"><thead><tr><th>Nome</th><th>Categoria</th><th>Livros no acervo</th><th>Ações</th></tr></thead><tbody>
      {consulta.dados.map((autor) => <tr key={autor.id}><td><strong>{autor.nome}</strong></td><td>{autor.tipo === "literatura" ? "Literatura" : "Didático"}</td><td>{autor.livrosNoAcervo}</td><td><Acoes editar={`/autores/editar?id=${autor.id}`} excluir={`/autores/excluir?id=${autor.id}`} /></td></tr>)}
    </tbody></Tabela> : <p className="vazio">Nenhum autor encontrado. Ajuste a busca ou cadastre um autor.</p>)}
  </Pagina>;
}

export default { id: "uc06", titulo: "Buscar autores", caminho: "/autores", Componente: BuscarAutores };
