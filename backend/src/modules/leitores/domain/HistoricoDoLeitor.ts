/** Porta: leitores não conhece tabelas internas de circulação. */
export interface HistoricoDoLeitor {
  existePara(leitorId: number): Promise<boolean>;
}
