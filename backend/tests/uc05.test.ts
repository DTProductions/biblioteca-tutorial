import { expect, test } from "bun:test";
import { api, nomeDeTeste } from "./suporte-api";

test("UC05: cadastra autor e valida nome e categoria", async () => {
  const nome = nomeDeTeste("Autor UC05");
  const response = await api("POST", "/autores", { nome: ` ${nome} `, tipo: "didatico" });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ nome, tipo: "didatico", livrosNoAcervo: 0 });
  expect((await api("POST", "/autores", { nome: " ", tipo: "literatura" })).status).toBe(400);
  expect((await api("POST", "/autores", { nome, tipo: "inexistente" })).status).toBe(400);
});
