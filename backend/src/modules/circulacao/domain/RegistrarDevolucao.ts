import { NotFound, RuleConflict } from "../../../shared/errors";
import { hoje } from "./modelo";
import { BaseCirculacao } from "./BaseCirculacao";

export class RegistrarDevolucao extends BaseCirculacao {
  async executar(id: number) {
    const emprestimo = (await this.repositorio.emprestimos()).find(e => e.id === id);
    if (!emprestimo) throw new NotFound("Empréstimo não encontrado.");
    if (emprestimo.dataDevolucao) throw new RuleConflict("Este empréstimo já foi devolvido.");
    const dataDevolucao = hoje(this.clock);
    await this.repositorio.devolverEmprestimo(id, dataDevolucao);
    return this.apresentarEmprestimo({ ...emprestimo, dataDevolucao });
  }

}
