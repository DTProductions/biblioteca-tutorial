import { RuleConflict } from "../../../shared/errors";
import { hoje, situacaoReserva, somarDias } from "./modelo";
import { BaseCirculacao } from "./BaseCirculacao";

export class RegistrarEmprestimo extends BaseCirculacao {
  async executar(leitorId: number, exemplarId: number) {
    await this.verificarVinculos(leitorId, exemplarId);
    const data = hoje(this.clock);
    const emprestimosLeitor = await this.repositorio.emprestimos({ leitorId });
    if (emprestimosLeitor.filter(e => !e.dataDevolucao).length >= 3) {
      throw new RuleConflict("O leitor já possui três empréstimos em aberto.");
    }
    if ((await this.repositorio.emprestimos({ exemplarId })).some(e => !e.dataDevolucao)) {
      throw new RuleConflict("Exemplar já está emprestado.");
    }
    const reserva = (await this.repositorio.reservas({ exemplarId })).find(r => situacaoReserva(r, data) === "ativa");
    if (reserva && reserva.leitorId !== leitorId) throw new RuleConflict("Exemplar reservado para outro leitor.");
    if (reserva) await this.repositorio.situacaoReserva(reserva.id, "atendida");
    const emprestimo = await this.repositorio.inserirEmprestimo({ leitorId, exemplarId,
      dataEmprestimo: data, dataPrevistaDevolucao: somarDias(data, 14), dataDevolucao: null });
    return this.apresentarEmprestimo(emprestimo);
  }

}
