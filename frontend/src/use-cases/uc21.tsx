/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { Link, useSearchParams } from "react-router-dom";
import { formatarData, parametros, type Emprestimo } from "../api.ts";
import { Carregamento, Pagina, Situacao, Tabela, useDados } from "../components/biblioteca.tsx";
import { FiltrosCirculacao } from "../components/circulacao.tsx";

function ConsultarEmprestimos() {
  const [params] = useSearchParams();
  const consulta = useDados<Emprestimo[]>(`/api/emprestimos${parametros({ leitorId: params.get("leitorId") ?? "", exemplarId: params.get("exemplarId") ?? "", situacao: params.get("situacao") ?? "" })}`);
  return <Pagina titulo="Consultar empréstimos" descricao="Acompanhe retiradas, devoluções e atrasos, mantendo o histórico de circulação.">
    <FiltrosCirculacao situacoes={[{ valor: "em_aberto", nome: "Em aberto (inclui atrasados)" }, { valor: "atrasado", nome: "Atrasados" }, { valor: "devolvido", nome: "Devolvidos" }]} />
    <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
    {consulta.dados && (consulta.dados.length ? <Tabela titulo="Empréstimos encontrados"><thead><tr><th>Exemplar / Livro</th><th>Leitor</th><th>Retirada</th><th>Prazo</th><th>Devolução</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
      {consulta.dados.map((emprestimo) => <tr key={emprestimo.id}><td><strong>{emprestimo.numeroRegistro}</strong><small className="segunda-linha">{emprestimo.livroTitulo}</small></td><td>{emprestimo.leitorNome}</td><td>{formatarData(emprestimo.dataEmprestimo)}</td><td>{formatarData(emprestimo.dataPrevistaDevolucao)}</td><td>{formatarData(emprestimo.dataDevolucao)}</td><td><Situacao valor={emprestimo.situacao} />{emprestimo.diasDeAtraso > 0 && <small className="segunda-linha">{emprestimo.diasDeAtraso} dia(s) de atraso</small>}</td><td>{!emprestimo.dataDevolucao && <Link to={`/emprestimos/devolver?id=${emprestimo.id}`}>Devolver</Link>}</td></tr>)}
    </tbody></Tabela> : <p className="vazio">Nenhum empréstimo encontrado para esses filtros.</p>)}
  </Pagina>;
}

export default { id: "uc21", titulo: "Consultar empréstimos", caminho: "/emprestimos", Componente: ConsultarEmprestimos };
