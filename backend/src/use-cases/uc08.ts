import type { CasoDeUso } from "./types";
import { excluirAutor } from "../modules/autoria/excluirAutor";
import { idDoAutor } from "../modules/autoria/cadastro";
import { integracaoDaAutoria } from "../adapters/autoriaIntegracao";

export default {
  id: "uc08",
  registrar(api) {
    api.delete("/autores/:id", async (c) => {
      await excluirAutor(idDoAutor(c.req.param("id")), integracaoDaAutoria);
      return c.body(null, 204);
    });
  },
} satisfies CasoDeUso;
