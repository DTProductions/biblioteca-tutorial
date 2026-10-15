import { expect, test } from "bun:test";
import { sql } from "../src/infrastructure/postgres";
import { createAutoriaTablesPostgres } from "../src/modules/autoria";
import { api, autorDeTeste, isbnDeTeste } from "./suporte-api";

test("UC08: exclui autor sem livros, preserva vinculados e não ressuscita a carga inicial", async () => {
  const livre = await autorDeTeste();
  expect((await api("DELETE", `/autores/${livre.id}`)).status).toBe(204);
  expect((await api("DELETE", `/autores/${livre.id}`)).status).toBe(404);
  await createAutoriaTablesPostgres();
  const [apagado] = await sql`SELECT id FROM autores WHERE id = ${livre.id}`;
  expect(apagado).toBeUndefined();
  const vinculado = await autorDeTeste();
  await sql`INSERT INTO livros (isbn, titulo, autor_id, data_catalogacao, numero_registro) VALUES (${isbnDeTeste()}, 'Livro vinculado', ${vinculado.id}, '2026-10-15', ${`1889-${String(vinculado.id).padStart(6, '0')}`})`;
  expect((await api("DELETE", `/autores/${vinculado.id}`)).status).toBe(409);
});

test("UC08: reinicializar não ressuscita autor excluído que pertencia à carga inicial", async () => {
  // Harper Lee é o ID 3 da carga original; o banco de testes não tem obras dessa autora.
  const [original] = await sql`SELECT id, nome, orcid, tipo, livros_no_acervo FROM autores WHERE id = 3`;
  const [vinculo] = await sql`SELECT id FROM livros WHERE autor_id = 3 LIMIT 1`;
  expect(vinculo).toBeUndefined();
  expect(original).toBeDefined();
  try {
    expect((await api("DELETE", "/autores/3")).status).toBe(204);
    await createAutoriaTablesPostgres();
    const [restaurado] = await sql`SELECT id FROM autores WHERE id = 3`;
    expect(restaurado).toBeUndefined();
  } finally {
    // Restaura o fixture original para que os demais testes continuem independentes.
    await sql`INSERT INTO autores (id, nome, orcid, tipo, livros_no_acervo)
      VALUES (3, ${original.nome}, ${original.orcid}, ${original.tipo}, ${original.livros_no_acervo})
      ON CONFLICT (id) DO NOTHING`;
  }
});
