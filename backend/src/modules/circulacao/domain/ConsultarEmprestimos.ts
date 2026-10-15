import { InvalidInput, NotFound } from "../../../shared/errors";
import { type Filtros } from "./modelo";
import { BaseCirculacao } from "./BaseCirculacao";

export class ConsultarEmprestimos extends BaseCirculacao {
  async executar(filtros: Filtros = {}) {
    if (filtros.situacao && !["em_aberto", "atrasado", "devolvido"].includes(filtros.situacao)) {
      throw new InvalidInput("Situação de empréstimo inválida.");
    }
    const resultados = await Promise.all((await this.repositorio.emprestimos(filtros)).map(e => this.apresentarEmprestimo(e)));
    return resultados.filter(e => {
      if (!filtros.situacao) return true;
      // "Em aberto" é o conjunto de empréstimos ainda não devolvidos, inclusive vencidos.
      if (filtros.situacao === "em_aberto") return e.dataDevolucao === null;
      return e.situacao === filtros.situacao;
    });
  }

  async obter(id: number) {
    const emprestimo = (await this.repositorio.emprestimos()).find(e => e.id === id);
    if (!emprestimo) throw new NotFound("Empréstimo não encontrado.");
    return this.apresentarEmprestimo(emprestimo);
  }
}
