import type { CasoDeUso } from "./types";
import { cadastrarAutor, prepararAutores } from "../modules/autoria/cadastro";

export default {
  id: "uc05", preparar: prepararAutores,
  registrar(api) {
    api.post("/autores", async (c) => c.json(await cadastrarAutor(await c.req.json()), 201));
  },
} satisfies CasoDeUso;
