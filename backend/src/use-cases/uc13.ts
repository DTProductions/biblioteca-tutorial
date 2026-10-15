import type { CasoDeUso } from "./types";
import { cadastrarExemplar, prepararExemplares } from "../modules/acervo/exemplares";
import { integracaoDoCatalogo } from "../adapters/acervoIntegracao";

export default {
  id: "uc13", preparar: prepararExemplares,
  registrar(api) {
    api.post("/exemplares", async (c) => c.json(await cadastrarExemplar(await c.req.json(), integracaoDoCatalogo), 201));
  },
} satisfies CasoDeUso;
