import { expect, test } from "bun:test";
import { api, exemplarDeTeste } from "./suporte-api";

test("UC14: consulta exemplar e combina filtros de registro, livro e disponibilidade", async () => {
  const exemplar = await exemplarDeTeste();
  const response = await api("GET", `/exemplares?q=${encodeURIComponent(exemplar.numeroRegistro)}&livroId=${exemplar.livroId}&situacao=disponivel`);
  expect(response.status).toBe(200);
  expect((await response.json()).map((e: { id: number }) => e.id)).toContain(exemplar.id);
  const detalhe = await api("GET", `/exemplares/${exemplar.id}`);
  expect(detalhe.status).toBe(200);
  expect(await detalhe.json()).toMatchObject({ id: exemplar.id, livroId: exemplar.livroId, situacao: "disponivel" });
  expect((await api("GET", "/exemplares/2147483647")).status).toBe(404);
  expect((await api("GET", "/exemplares?situacao=desconhecida")).status).toBe(400);
});
