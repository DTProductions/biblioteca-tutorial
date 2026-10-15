import type { CasoDeUso } from "./types";
import { atualizarLivro } from "../modules/acervo/atualizarLivro";
import { identificador } from "../modules/acervo/domain/dadosDoLivro";
import { integracaoDoCatalogo } from "../adapters/acervoIntegracao";

export default {
  id: "uc03",
  registrar(api) {
    api.put("/livros/:id", async (c) => c.json(await atualizarLivro(identificador(c.req.param("id")), await c.req.json(), integracaoDoCatalogo)));
  },
} satisfies CasoDeUso;
