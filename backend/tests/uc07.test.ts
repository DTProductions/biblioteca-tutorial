import { expect, test } from "bun:test";
import { sql } from "../src/infrastructure/postgres";
import { api, autorDeTeste, isbnDeTeste } from "./suporte-api";

test("UC07: atualiza autor e recusa reduzir categoria abaixo da quantidade existente", async () => {
  const autor = await autorDeTeste("didatico");
  for (let i = 0; i < 6; i++) {
    // Fixture de dados bibliográficos: a tabela já existe na aplicação original.
    await sql`INSERT INTO livros (isbn, titulo, autor_id, data_catalogacao, numero_registro) VALUES (${isbnDeTeste()}, ${`Fixture ${i}`}, ${autor.id}, '2026-10-15', ${`1888-${String(autor.id * 10 + i).padStart(6, '0')}`})`;
  }
  expect((await api("PUT", `/autores/${autor.id}`, { nome: "Nome editado", tipo: "literatura" })).status).toBe(409);
  const response = await api("PUT", `/autores/${autor.id}`, { nome: "Nome editado", tipo: "didatico" });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ nome: "Nome editado", livrosNoAcervo: 6 });
  expect((await api("PUT", "/autores/2147483647", { nome: "Ausente", tipo: "didatico" })).status).toBe(404);
});
