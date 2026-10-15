import { identificador } from "../modules/acervo/domain/dadosDoLivro";
import { ExcluirLivro } from "../modules/acervo/domain/ExcluirLivro";
import { ContagemDosAutoresPostgres } from "../adapters/ContagemDosAutoresPostgres";
import { emTransacao } from "../infrastructure/transaction";
import { LivrosPostgres } from "../modules/acervo/infrastructure/LivrosPostgres";
import type { CasoDeUso } from "./types";

export default {
  id: "uc04",
  registrar(api) {
    api.delete("/livros/:id", async c => {
      const id = identificador(c.req.param("id"));
      await emTransacao(tx => {
        const livros = new LivrosPostgres(tx);
        return new ExcluirLivro(livros, livros, new ContagemDosAutoresPostgres(tx)).executar(id);
      });
      return c.body(null, 204);
    });
  },
} satisfies CasoDeUso;
