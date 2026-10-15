import { BuscarLeitores } from "../modules/leitores/domain/BuscarLeitores";
import { idPositivo } from "../adapters/circulacaoHttp";
import { sql } from "../infrastructure/postgres";
import { LeitoresPostgres } from "../modules/leitores/infrastructure/LeitoresPostgres";
import type { CasoDeUso } from "./types";

export default {
  id: "uc10",
  registrar(api) {
    api.get("/leitores", async c => c.json(await new BuscarLeitores(new LeitoresPostgres(sql)).executar(c.req.query("q"))));
    api.get("/leitores/:id", async c => c.json(await new BuscarLeitores(new LeitoresPostgres(sql)).obter(idPositivo(c.req.param("id")))));
  },
} satisfies CasoDeUso;
