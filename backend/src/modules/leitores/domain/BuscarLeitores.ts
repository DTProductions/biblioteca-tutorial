import type { RepositorioLeitores } from "./RepositorioLeitores";

export class BuscarLeitores {
  constructor(private readonly repositorio: RepositorioLeitores) {}
  executar(termo?: string) { return this.repositorio.buscar(termo); }
  obter(id: number) { return this.repositorio.obter(id); }
}
