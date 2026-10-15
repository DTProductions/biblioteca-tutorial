import type { CasoDeUso } from "./types";
import { buscarAutores, consultarAutor } from "../modules/autoria/buscarAutores";
import { idDoAutor } from "../modules/autoria/cadastro";
import { integracaoDaAutoria } from "../adapters/autoriaIntegracao";

export default {
  id: "uc06",
  registrar(api) {
    api.get("/autores", async (c) => c.json(await buscarAutores(c.req.query("q") ?? "", integracaoDaAutoria)));
    api.get("/autores/:id", async (c) => c.json(await consultarAutor(idDoAutor(c.req.param("id")), integracaoDaAutoria)));
  },
} satisfies CasoDeUso;
