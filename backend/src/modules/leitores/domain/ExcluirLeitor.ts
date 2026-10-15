import { RuleConflict } from "../../../shared/errors";
import type { HistoricoDoLeitor } from "./HistoricoDoLeitor";
import type { RepositorioLeitores } from "./RepositorioLeitores";

export class ExcluirLeitor {
  constructor(private readonly repositorio: RepositorioLeitores, private readonly historico: HistoricoDoLeitor) {}
  async executar(id: number) {
    await this.repositorio.obter(id);
    if (await this.historico.existePara(id)) throw new RuleConflict("Leitor possui histórico de reservas ou empréstimos e não pode ser excluído.");
    await this.repositorio.remover(id);
  }
}
