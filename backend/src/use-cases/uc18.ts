import { CancelarReserva } from "../modules/circulacao/domain/CancelarReserva";
import { idPositivo } from "../adapters/circulacaoHttp";
import { dependenciasCirculacao } from "../adapters/criarCirculacao";
import { emTransacao } from "../infrastructure/transaction";
import type { CasoDeUso } from "./types";

export default {
  id: "uc18",
  registrar(api) {
    api.post("/reservas/:id/cancelamento", async c => {
      const id = idPositivo(c.req.param("id"));
      return c.json(await emTransacao(tx => new CancelarReserva(...dependenciasCirculacao(tx)).executar(id)));
    });
  },
} satisfies CasoDeUso;
