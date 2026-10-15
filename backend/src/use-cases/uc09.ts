import { CadastrarLeitor } from "../modules/leitores/domain/CadastrarLeitor";
import { corpoJson } from "../adapters/circulacaoHttp";
import { sql } from "../infrastructure/postgres";
import { emTransacao } from "../infrastructure/transaction";
import { LeitoresPostgres } from "../modules/leitores/infrastructure/LeitoresPostgres";
import { prepararLeitores } from "../modules/leitores/infrastructure/schema";
import type { CasoDeUso } from "./types";

export default {
  id: "uc09",
  preparar: () => prepararLeitores(sql),
  registrar(api) {
    api.post("/leitores", async c => {
      const dados = await corpoJson(c);
      const leitor = await emTransacao(tx => new CadastrarLeitor(new LeitoresPostgres(tx)).executar(dados));
      return c.json(leitor, 201);
    });
  },
} satisfies CasoDeUso;
