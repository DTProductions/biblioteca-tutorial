/* oxlint-disable react/only-export-components -- O registro de cada UC exporta metadados e componente para o carregamento automático. */
import { formatarData, type Reserva } from "../api.ts";
import { Pagina } from "../components/biblioteca.tsx";
import { AcaoCirculacao } from "../components/circulacao.tsx";

function CancelarReserva() {
  return <Pagina titulo="Cancelar reserva" descricao="Cancele uma reserva ativa para liberar o exemplar e uma das vagas do leitor.">
    <AcaoCirculacao<Reserva> endpoint="/api/reservas" sufixo="cancelamento" rotulo={(reserva) => `${reserva.numeroRegistro} · ${reserva.livroTitulo} · ${reserva.leitorNome}`} detalhes={(reserva) => <><p><strong>{reserva.livroTitulo}</strong> · {reserva.numeroRegistro}</p><p>Leitor: {reserva.leitorNome}</p><p>Retirada até {formatarData(reserva.dataLimiteRetirada)}</p></>} acao="Cancelar reserva" sucesso={(reserva) => `Reserva de ${reserva.leitorNome} cancelada. O exemplar ${reserva.numeroRegistro} foi liberado.`} retorno="/reservas" vazio="Não há reservas ativas para cancelar." />
  </Pagina>;
}

export default { id: "uc18", titulo: "Cancelar reserva", caminho: "/reservas/cancelar", Componente: CancelarReserva };
