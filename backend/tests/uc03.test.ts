import { expect, test } from "bun:test";
import { api, livroDeTeste, isbnDeTeste } from "./suporte-api";

test("UC03: edição preserva identidade e catalogação e rejeita ISBN duplicado", async () => {
  const livro = await livroDeTeste();
  const outro = await livroDeTeste();
  const dados = { isbn: isbnDeTeste(), titulo: "Título atualizado", autorId: livro.autorId };
  const response = await api("PUT", `/livros/${livro.id}`, dados);
  expect(response.status).toBe(200);
  const atualizado = await response.json();
  expect(atualizado.id).toBe(livro.id);
  expect(atualizado.dataCatalogacao).toBe(livro.dataCatalogacao);
  expect(atualizado.titulo).toBe(dados.titulo);
  expect((await api("PUT", `/livros/${livro.id}`, { ...dados, isbn: outro.isbn })).status).toBe(409);
  expect((await api("PUT", "/livros/2147483647", dados)).status).toBe(404);
});
