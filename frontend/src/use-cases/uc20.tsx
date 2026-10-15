/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { formatarData, type Emprestimo } from "../api.ts";
import { Pagina } from "../components/biblioteca.tsx";
import { AcaoCirculacao } from "../components/circulacao.tsx";

function RegistrarDevolucao() {
  return <Pagina titulo="Registrar devolução" descricao="Encerre um empréstimo em aberto e torne o exemplar disponível novamente.">
    <AcaoCirculacao<Emprestimo> endpoint="/api/emprestimos" sufixo="devolucao" rotulo={(emprestimo) => `${emprestimo.numeroRegistro} · ${emprestimo.livroTitulo} · ${emprestimo.leitorNome}`} detalhes={(emprestimo) => <><p><strong>{emprestimo.livroTitulo}</strong> · {emprestimo.numeroRegistro}</p><p>Leitor: {emprestimo.leitorNome}</p><p>Devolução prevista: {formatarData(emprestimo.dataPrevistaDevolucao)}</p>{emprestimo.diasDeAtraso > 0 && <p className="erro">{emprestimo.diasDeAtraso} dia(s) de atraso.</p>}</>} acao="Confirmar devolução" sucesso={(emprestimo) => `Devolução do exemplar ${emprestimo.numeroRegistro} registrada em ${formatarData(emprestimo.dataDevolucao)}.`} retorno="/emprestimos" vazio="Não há empréstimos em aberto para devolver." />
  </Pagina>;
}

export default { id: "uc20", titulo: "Registrar devolução", caminho: "/emprestimos/devolver", Componente: RegistrarDevolucao };
