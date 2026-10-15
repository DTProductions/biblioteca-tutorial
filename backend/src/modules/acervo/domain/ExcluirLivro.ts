import { RuleConflict } from "../../../shared/errors";
import type { ContagemDosAutores } from "./ContagemDosAutores";
import type { ExemplaresDoLivro } from "./ExemplaresDoLivro";
import type { RepositorioLivros } from "./RepositorioLivros";

export class ExcluirLivro {
  constructor(
    private readonly repositorio: RepositorioLivros,
    private readonly exemplares: ExemplaresDoLivro,
    private readonly autores: ContagemDosAutores,
  ) {}

  async executar(id: number) {
    const livro = await this.repositorio.obter(id);
    if (await this.exemplares.existemPara(id)) throw new RuleConflict("Livro possui exemplares e não pode ser excluído");
    await this.repositorio.remover(id);
    await this.autores.sincronizar([livro.autorId]);
  }
}
