/** Porta para a contagem mantida pelo módulo de autoria; o acervo não conhece essa tabela. */
export interface ContagemDosAutores {
  sincronizar(autorIds: number[]): Promise<void>;
}
