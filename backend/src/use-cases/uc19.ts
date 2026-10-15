import { RegistrarEmprestimo } from "../modules/circulacao/domain/RegistrarEmprestimo";
import { corpoJson, idPositivo } from "../adapters/circulacaoHttp";
import { dependenciasCirculacao } from "../adapters/criarCirculacao";
import { emTransacao } from "../infrastructure/transaction";
import type { CasoDeUso } from "./types";

export default {
  id: "uc19",
  registrar(api) {
    api.post("/emprestimos", async c => {
      const dados = await corpoJson(c);
      const leitorId = idPositivo(dados.leitorId, "Leitor");
      const exemplarId = idPositivo(dados.exemplarId, "Exemplar");
      const emprestimo = await emTransacao(tx => new RegistrarEmprestimo(...dependenciasCirculacao(tx)).executar(leitorId, exemplarId));
      return c.json(emprestimo, 201);
    });
  },
} satisfies CasoDeUso;
