export type LivroParaExclusao = { id: number; autorId: number };

export interface RepositorioLivros {
  obter(id: number): Promise<LivroParaExclusao>;
  remover(id: number): Promise<void>;
}
