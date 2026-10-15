import { AtualizarLeitor } from "../modules/leitores/domain/AtualizarLeitor";
import { corpoJson, idPositivo } from "../adapters/circulacaoHttp";
import { emTransacao } from "../infrastructure/transaction";
import { LeitoresPostgres } from "../modules/leitores/infrastructure/LeitoresPostgres";
import type { CasoDeUso } from "./types";

export default {
  id: "uc11",
  registrar(api) {
    api.put("/leitores/:id", async c => {
      const id = idPositivo(c.req.param("id"));
      const dados = await corpoJson(c);
      return c.json(await emTransacao(tx => new AtualizarLeitor(new LeitoresPostgres(tx)).executar(id, dados)));
    });
  },
} satisfies CasoDeUso;
