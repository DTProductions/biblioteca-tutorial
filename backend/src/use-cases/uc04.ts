import type { CasoDeUso } from "./types";
import { excluirLivro } from "../modules/acervo/excluirLivro";
import { identificador } from "../modules/acervo/domain/dadosDoLivro";
import { integracaoDoCatalogo } from "../adapters/acervoIntegracao";

export default {
  id: "uc04",
  registrar(api) {
    api.delete("/livros/:id", async (c) => {
      await excluirLivro(identificador(c.req.param("id")), integracaoDoCatalogo);
      return c.body(null, 204);
    });
  },
} satisfies CasoDeUso;
