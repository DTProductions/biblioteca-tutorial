import { ExcluirLeitor } from "../modules/leitores/domain/ExcluirLeitor";
import { idPositivo } from "../adapters/circulacaoHttp";
import { LeitorHistoricoPostgres } from "../adapters/LeitorHistoricoPostgres";
import { emTransacao } from "../infrastructure/transaction";
import { LeitoresPostgres } from "../modules/leitores/infrastructure/LeitoresPostgres";
import type { CasoDeUso } from "./types";

export default {
  id: "uc12",
  registrar(api) {
    api.delete("/leitores/:id", async c => {
      const id = idPositivo(c.req.param("id"));
      await emTransacao(tx => new ExcluirLeitor(new LeitoresPostgres(tx), new LeitorHistoricoPostgres(tx)).executar(id));
      return c.body(null, 204);
    });
  },
} satisfies CasoDeUso;
