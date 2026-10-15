import { RuleConflict } from "../../../shared/errors";
import { validarDadosLeitor } from "./Leitor";
import type { RepositorioLeitores } from "./RepositorioLeitores";

export class AtualizarLeitor {
  constructor(private readonly repositorio: RepositorioLeitores) {}
  async executar(id: number, entrada: unknown) {
    await this.repositorio.obter(id);
    const dados = validarDadosLeitor(entrada);
    if (await this.repositorio.existeCpf(dados.cpf, id)) throw new RuleConflict("Já existe um leitor com este CPF.");
    return this.repositorio.alterar(id, dados);
  }
}
