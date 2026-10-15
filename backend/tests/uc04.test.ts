import { expect, test } from "bun:test";
import { api, livroDeTeste } from "./suporte-api";

test("UC04: exclusão física aceita livro sem exemplares e recusa livro vinculado", async () => {
  const livre = await livroDeTeste();
  expect((await api("DELETE", `/livros/${livre.id}`)).status).toBe(204);
  expect((await api("DELETE", `/livros/${livre.id}`)).status).toBe(404);
  const vinculado = await livroDeTeste();
  expect((await api("POST", "/exemplares", { livroId: vinculado.id, localizacao: "A1", estadoConservacao: "bom" })).status).toBe(201);
  expect((await api("DELETE", `/livros/${vinculado.id}`)).status).toBe(409);
});
