import type { CasoDeUso } from "./types";
import { buscarExemplares, consultarExemplar } from "../modules/acervo/buscarExemplares";
import { identificador } from "../modules/acervo/domain/dadosDoLivro";
import { integracaoDoCatalogo } from "../adapters/acervoIntegracao";

export default {
  id: "uc14",
  registrar(api) {
    api.get("/exemplares", async (c) => c.json(await buscarExemplares(c.req.query(), integracaoDoCatalogo)));
    api.get("/exemplares/:id", async (c) => c.json(await consultarExemplar(identificador(c.req.param("id")), integracaoDoCatalogo)));
  },
} satisfies CasoDeUso;
