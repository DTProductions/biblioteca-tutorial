import { expect, test } from "bun:test";
import { sql } from "../src/infrastructure/postgres";
import { prepararExemplares } from "../src/modules/acervo/exemplares";
import { api, autorDeTeste, isbnDeTeste, livroDeTeste } from "./suporte-api";

test("UC13: cria cópias distintas e o número não é reutilizado após exclusão", async () => {
  const livro = await livroDeTeste();
  const criar = () => api("POST", "/exemplares", { livroId: livro.id, localizacao: "Estante 2", estadoConservacao: "bom" });
  const respostas = await Promise.all([criar(), criar()]);
  expect(respostas.every((r) => r.status === 201)).toBe(true);
  const [primeiro, segundo] = await Promise.all(respostas.map((r) => r.json()));
  expect(primeiro.numeroRegistro).not.toBe(segundo.numeroRegistro);
  expect(primeiro.numeroRegistro).toMatch(/^\d{4}-\d{6}$/);
  expect(primeiro.situacao).toBe("disponivel");
  // Fixture: elimina só o registro criado por este teste para provar a sequência.
  await sql`DELETE FROM exemplares WHERE id = ${segundo.id}`;
  const terceiro = await (await criar()).json();
  expect(terceiro.numeroRegistro).not.toBe(segundo.numeroRegistro);
  expect((await api("POST", "/exemplares", { livroId: 2147483647, localizacao: "A", estadoConservacao: "bom" })).status).toBe(404);
  expect((await api("POST", "/exemplares", { livroId: livro.id, localizacao: " ", estadoConservacao: "bom" })).status).toBe(400);
});

test("UC13: migração preserva número e data de cada livro antigo, sem duplicar na reexecução", async () => {
  const autor = await autorDeTeste();
  const registro = `1998-${String(autor.id).padStart(6, "0")}`;
  const [legado] = await sql`
    INSERT INTO livros (isbn, titulo, autor_id, data_catalogacao, numero_registro)
    VALUES (${isbnDeTeste()}, 'Legado UC13', ${autor.id}, '1998-07-03', ${registro}) RETURNING id
  ` as { id: number }[];
  await prepararExemplares();
  await prepararExemplares();
  const copias = await sql`SELECT numero_registro, data_catalogacao FROM exemplares WHERE livro_id = ${legado!.id}` as { numero_registro: string; data_catalogacao: string }[];
  expect(copias).toHaveLength(1);
  expect(copias[0]).toEqual({ numero_registro: registro, data_catalogacao: "1998-07-03" });
  const [livro] = await sql`SELECT numero_registro FROM livros WHERE id = ${legado!.id}`;
  expect(livro.numero_registro).toBeNull();
});

test("UC13: identificador do livro exige inteiro positivo sem coerções de outros tipos", async () => {
  const livro = await livroDeTeste();
  for (const livroId of [true, [livro.id], null, {}, `${livro.id}.0`, "1e0", 0]) {
    expect((await api("POST", "/exemplares", { livroId, localizacao: "A", estadoConservacao: "bom" })).status).toBe(400);
  }
});
