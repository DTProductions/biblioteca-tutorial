import { expect, test } from "bun:test";
import { api, autorDeTeste, isbnDeTeste, nomeDeTeste } from "./suporte-api";

test("UC01: cadastro bibliográfico normaliza ISBN e começa sem cópia física", async () => {
  const autor = await autorDeTeste();
  const isbn = isbnDeTeste();
  const dados = { isbn: `${isbn.slice(0, 3)}-${isbn.slice(3)}`, titulo: nomeDeTeste("Título"), autorId: autor.id };
  const response = await api("POST", "/livros", dados);
  expect(response.status).toBe(201);
  const livro = await response.json();
  expect(livro.isbn).toBe(isbn);
  expect(livro.autorId).toBe(autor.id);
  expect(livro.totalExemplares).toBe(0);
  expect(livro.exemplaresDisponiveis).toBe(0);
  expect(livro.numeroRegistro).toBeUndefined();
  const localizacao = response.headers.get("Location");
  expect(localizacao).toBe(`/api/livros/${isbn}`);
  const consulta = await api("GET", localizacao!.replace(/^\/api/, ""));
  expect(consulta.status).toBe(200);
  expect((await consulta.json()).map((item: { isbn: string }) => item.isbn)).toContain(isbn);
  expect((await api("POST", "/livros", dados)).status).toBe(409);
  expect((await api("POST", "/livros", { ...dados, isbn: isbnDeTeste(), titulo: ` ${dados.titulo.toUpperCase()} ` })).status).toBe(409);
});

test("UC01: valida entrada e limite de 5 livros bibliográficos do autor literário", async () => {
  const autor = await autorDeTeste();
  const criar = (titulo: string, isbn = isbnDeTeste()) => api("POST", "/livros", { titulo, isbn, autorId: autor.id });
  expect((await criar(" ")).status).toBe(400);
  expect((await criar("Inválido", "123")).status).toBe(400);
  expect((await api("POST", "/livros", { titulo: "Sem autor", isbn: isbnDeTeste(), autorId: 2147483647 })).status).toBe(404);
  for (let i = 0; i < 5; i++) expect((await criar(`Livro ${i}`)).status).toBe(201);
  expect((await criar("Sexto livro")).status).toBe(409);
});

test("UC01: tentativas concorrentes não ultrapassam limite do autor", async () => {
  const autor = await autorDeTeste();
  const respostas = await Promise.all(Array.from({ length: 6 }, (_, i) => api("POST", "/livros", { titulo: `Concorrente ${i}`, isbn: isbnDeTeste(), autorId: autor.id })));
  expect(respostas.filter((r) => r.status === 201)).toHaveLength(5);
  expect(respostas.filter((r) => r.status === 409)).toHaveLength(1);
});

test("UC01: identificador do autor rejeita coerções de booleanos, arrays e formatos não inteiros", async () => {
  const autor = await autorDeTeste();
  for (const autorId of [true, [autor.id], null, {}, `${autor.id}.0`, ` ${autor.id}`, "1e0"]) {
    expect((await api("POST", "/livros", { isbn: isbnDeTeste(), titulo: "Entrada inválida", autorId })).status).toBe(400);
  }
});
