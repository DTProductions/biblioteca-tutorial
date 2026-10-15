import type { CasoDeUso } from "./types";
import { cadastrarLivro, prepararCatalogo } from "../modules/acervo/catalogo";
import { buscarLivros } from "../modules/acervo/buscarLivros";
import { integracaoDoCatalogo } from "../adapters/acervoIntegracao";

export default {
  id: "uc01", preparar: prepararCatalogo,
  registrar(api) {
    api.post("/livros", async (c) => {
      const livro = await cadastrarLivro(await c.req.json(), integracaoDoCatalogo);
      c.header("Location", `/api/livros/${livro.isbn}`);
      return c.json(livro, 201);
    });
    // Mantém o endereço da busca original durante a integração gradual dos PRs.
    api.get("/livros/:q", async (c) => c.json(await buscarLivros(c.req.param("q"), integracaoDoCatalogo)));
  },
} satisfies CasoDeUso;
