
export interface HistoricoDoLeitor {
  existePara(leitorId: number): Promise<boolean>;
}
