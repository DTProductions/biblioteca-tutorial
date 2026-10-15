import { RegistrarDevolucao } from "../modules/circulacao/domain/RegistrarDevolucao";
import { idPositivo } from "../adapters/circulacaoHttp";
import { dependenciasCirculacao } from "../adapters/criarCirculacao";
import { emTransacao } from "../infrastructure/transaction";
import type { CasoDeUso } from "./types";

export default {
  id: "uc20",
  registrar(api) {
    api.post("/emprestimos/:id/devolucao", async c => {
      const id = idPositivo(c.req.param("id"));
      return c.json(await emTransacao(tx => new RegistrarDevolucao(...dependenciasCirculacao(tx)).executar(id)));
    });
  },
} satisfies CasoDeUso;
