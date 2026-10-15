import { ConsultarEmprestimos } from "../modules/circulacao/domain/ConsultarEmprestimos";
import { filtroId, idPositivo } from "../adapters/circulacaoHttp";
import { dependenciasCirculacao } from "../adapters/criarCirculacao";
import { sql } from "../infrastructure/postgres";
import type { CasoDeUso } from "./types";

export default {
  id: "uc21",
  registrar(api) {
    api.get("/emprestimos", async c => c.json(await new ConsultarEmprestimos(...dependenciasCirculacao(sql)).executar({
      leitorId: filtroId(c.req.query("leitorId")), exemplarId: filtroId(c.req.query("exemplarId")),
      situacao: c.req.query("situacao"),
    })));
    api.get("/emprestimos/:id", async c => c.json(await new ConsultarEmprestimos(...dependenciasCirculacao(sql)).obter(idPositivo(c.req.param("id")))));
  },
} satisfies CasoDeUso;
