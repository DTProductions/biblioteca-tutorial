import type { CasoDeUso } from "./types";
import { atualizarAutor } from "../modules/autoria/atualizarAutor";
import { idDoAutor } from "../modules/autoria/cadastro";
import { integracaoDaAutoria } from "../adapters/autoriaIntegracao";

export default {
  id: "uc07",
  registrar(api) {
    api.put("/autores/:id", async (c) => c.json(await atualizarAutor(idDoAutor(c.req.param("id")), await c.req.json(), integracaoDaAutoria)));
  },
} satisfies CasoDeUso;
