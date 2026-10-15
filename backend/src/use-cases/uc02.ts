import type { CasoDeUso } from "./types";
import { buscarLivros } from "../modules/acervo/buscarLivros";
import { consultarLivro } from "../modules/acervo/consultarLivro";
import { identificador } from "../modules/acervo/domain/dadosDoLivro";
import { integracaoDoCatalogo } from "../adapters/acervoIntegracao";

export default {
  id: "uc02",
  registrar(api) {
    api.get("/livros", async (c) => c.json(await buscarLivros(c.req.query("q") ?? "", integracaoDoCatalogo)));
    api.get("/livros/id/:id", async (c) => c.json(await consultarLivro(identificador(c.req.param("id")), integracaoDoCatalogo)));
  },
} satisfies CasoDeUso;
