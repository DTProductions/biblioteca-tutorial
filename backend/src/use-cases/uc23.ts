import { sql } from "../infrastructure/postgres";
import { executarSeed } from "../seed/executar";
import { prepararSeed } from "../seed/preparar";
import { relatorioSeed } from "../seed/relatorio";
import type { CasoDeUso } from "./types";

export default {
  id: "uc23",
  preparar: () => prepararSeed(sql),
  registrar(api) {
    api.get("/seed", async c => c.json(await relatorioSeed(sql)));
    api.post("/seed", async c => c.json(await executarSeed(), 200));
  },
} satisfies CasoDeUso;
