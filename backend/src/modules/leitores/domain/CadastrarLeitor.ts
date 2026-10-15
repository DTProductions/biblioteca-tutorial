import { RuleConflict } from "../../../shared/errors";
import { validarDadosLeitor } from "./Leitor";
import type { RepositorioLeitores } from "./RepositorioLeitores";

export class CadastrarLeitor {
  constructor(private readonly repositorio: RepositorioLeitores) {}
  async executar(entrada: unknown) {
    const dados = validarDadosLeitor(entrada);
    if (await this.repositorio.existeCpf(dados.cpf)) throw new RuleConflict("Já existe um leitor com este CPF.");
    return this.repositorio.inserir(dados);
  }
}
