import { NotFound, RuleConflict } from "../../../shared/errors";
import { hoje, situacaoReserva } from "./modelo";
import { BaseCirculacao } from "./BaseCirculacao";

export class CancelarReserva extends BaseCirculacao {
  async executar(id: number) {
    const reserva = (await this.repositorio.reservas()).find(r => r.id === id);
    if (!reserva) throw new NotFound("Reserva não encontrada.");
    if (situacaoReserva(reserva, hoje(this.clock)) !== "ativa") throw new RuleConflict("Somente reservas ativas podem ser canceladas.");
    await this.repositorio.situacaoReserva(id, "cancelada");
    return this.apresentarReserva({ ...reserva, situacao: "cancelada" });
  }

}
