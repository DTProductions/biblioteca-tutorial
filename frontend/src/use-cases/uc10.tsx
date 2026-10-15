/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { useSearchParams } from "react-router-dom";
import { formatarCpf, type Leitor } from "../api.ts";
import { Acoes, Busca, Carregamento, Pagina, Tabela, useDados } from "../components/biblioteca.tsx";

function BuscarLeitores() {
  const [params] = useSearchParams();
  const consulta = useDados<Leitor[]>(`/api/leitores?q=${encodeURIComponent(params.get("q") ?? "")}`);
  return <Pagina titulo="Buscar leitores" descricao="Encontre leitores e acesse seus dados de contato.">
    <Busca dica="Nome, CPF ou e-mail" />
    <Carregamento carregando={consulta.carregando} erro={consulta.erro} />
    {consulta.dados && (consulta.dados.length ? <Tabela titulo="Leitores encontrados"><thead><tr><th>Nome / CPF</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead><tbody>
      {consulta.dados.map((leitor) => <tr key={leitor.id}><td><strong>{leitor.nome}</strong><small className="segunda-linha">{formatarCpf(leitor.cpf)}</small></td><td>{leitor.email}</td><td>{leitor.telefone}</td><td><Acoes editar={`/leitores/editar?id=${leitor.id}`} excluir={`/leitores/excluir?id=${leitor.id}`} /></td></tr>)}
    </tbody></Tabela> : <p className="vazio">Nenhum leitor encontrado. Ajuste a busca ou cadastre um leitor.</p>)}
  </Pagina>;
}

export default { id: "uc10", titulo: "Buscar leitores", caminho: "/leitores", Componente: BuscarLeitores };
