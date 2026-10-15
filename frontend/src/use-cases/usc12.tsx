/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { type Leitor } from "../api.ts";
import { ExclusaoRegistro, Pagina } from "../components/biblioteca.tsx";

function ExcluirLeitor() {
  return <Pagina titulo="Excluir leitor" descricao="Remova um leitor que ainda não tenha histórico de circulação.">
    <ExclusaoRegistro<Leitor> endpoint="/api/leitores" rotulo={(leitor) => `${leitor.nome} · ${leitor.cpf}`} retorno="/leitores" aviso="A exclusão é definitiva. Leitores com qualquer empréstimo ou reserva, mesmo encerrados, não podem ser excluídos." />
  </Pagina>;
}

export default { id: "uc12", titulo: "Excluir leitor", caminho: "/leitores/excluir", Componente: ExcluirLeitor };
