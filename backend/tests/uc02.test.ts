import { expect, test } from "bun:test";
import { api, autorDeTeste, isbnDeTeste, nomeDeTeste } from "./suporte-api";

test("UC02: pesquisa por ISBN, título e autor e mantém endereço legado", async () => {
  const autor = await autorDeTeste();
  const dados = { isbn: isbnDeTeste(), titulo: nomeDeTeste("Pesquisa"), autorId: autor.id };
  const livro = await (await api("POST", "/livros", dados)).json();
  for (const termo of [dados.isbn, dados.titulo, autor.nome]) {
    const response = await api("GET", `/livros?q=${encodeURIComponent(termo)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).some((l: { id: number }) => l.id === livro.id)).toBe(true);
  }
  expect((await (await api("GET", `/livros/${dados.isbn}`)).json())[0].id).toBe(livro.id);
  expect((await (await api("GET", `/livros/id/${livro.id}`)).json()).id).toBe(livro.id);
  expect((await api("GET", "/livros/id/2147483647")).status).toBe(404);
});
