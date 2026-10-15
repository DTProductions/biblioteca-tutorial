/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { Link, useSearchParams } from "react-router-dom";
import { formatarData, type Livro } from "../api.ts";
import { Acoes, Busca, Carregamento, Pagina, Tabela, useDados } from "../components/biblioteca.tsx";

function BuscarLivros() {
  const [params] = useSearchParams();
  const termo = params.get("q") ?? "";
  const consulta = useDados<Livro[]>(`/api/livros?q=${encodeURIComponent(termo)}`);
  return <Pagina titulo="Buscar livros" descricao="Consulte ISBN, título ou autor e veja as cópias disponíveis de cada edição.">
    <Busca dica="ISBN, título ou nome do autor" />
    <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
    {consulta.dados && (consulta.dados.length ? <>
      <p className="contagem">{consulta.dados.length} livro(s) encontrado(s)</p>
      <Tabela titulo="Livros encontrados"><thead><tr><th>Título / ISBN</th><th>Autor</th><th>Exemplares</th><th>Catalogação</th><th>Ações</th></tr></thead><tbody>
        {consulta.dados.map((livro) => <tr key={livro.id}>
          <td><strong>{livro.titulo}</strong><small className="segunda-linha">{livro.isbn}</small></td>
          <td>{livro.autor}</td>
          <td><Link to={`/exemplares?livroId=${livro.id}`}>{livro.exemplaresDisponiveis} disponível(is) / {livro.totalExemplares} total</Link></td>
          <td>{formatarData(livro.dataCatalogacao)}</td>
          <td><Acoes editar={`/livros/editar?id=${livro.id}`} excluir={`/livros/excluir?id=${livro.id}`} /></td>
        </tr>)}
      </tbody></Tabela>
    </> : <p className="vazio">Nenhum livro encontrado. Ajuste a busca ou cadastre um livro.</p>)}
  </Pagina>;
}

export default { id: "uc02", titulo: "Buscar livros", caminho: "/livros", Componente: BuscarLivros };
