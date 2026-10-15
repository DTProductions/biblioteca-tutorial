import { expect, test } from "bun:test";
import { api, autorDeTeste } from "./suporte-api";

test("UC06: busca por nome, por identificador e informa ausência", async () => {
  const autor = await autorDeTeste();
  for (const q of [autor.nome, String(autor.id)]) {
    const response = await api("GET", `/autores?q=${encodeURIComponent(q)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).some((a: { id: number }) => a.id === autor.id)).toBe(true);
  }
  expect((await (await api("GET", `/autores/${autor.id}`)).json()).nome).toBe(autor.nome);
  expect((await api("GET", "/autores/2147483647")).status).toBe(404);
});
