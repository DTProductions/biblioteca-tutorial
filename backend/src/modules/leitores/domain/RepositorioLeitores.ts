import type { DadosLeitor, Leitor } from "./Leitor";

export interface RepositorioLeitores {
  buscar(q?: string): Promise<Leitor[]>;
  obter(id: number): Promise<Leitor>;
  existeCpf(cpf: string, excetoId?: number | null): Promise<boolean>;
  inserir(dados: DadosLeitor): Promise<Leitor>;
  alterar(id: number, dados: DadosLeitor): Promise<Leitor>;
  remover(id: number): Promise<void>;
}
