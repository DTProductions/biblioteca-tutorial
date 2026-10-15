import { expect, test } from "bun:test";
import { AtualizarLeitor } from "../src/modules/leitores/domain/AtualizarLeitor";
import { ana, bruno, LeitoresMemoria } from "./leitoresDouble";
import { api } from "./suporte-api";
import { leitorDeTeste } from "./leitoresApiFixture";

test("UC11 permite manter CPF próprio mas recusa CPF de outro leitor sem alterar dados", async () => {
  const repo = new LeitoresMemoria();
  await repo.inserir(ana); await repo.inserir(bruno);
  const atualizar = new AtualizarLeitor(repo);
  expect(await atualizar.executar(1, { ...ana, nome: "Ana Atualizada" })).toMatchObject({ id: 1, nome: "Ana Atualizada" });
  await expect(atualizar.executar(1, { ...ana, cpf: bruno.cpf })).rejects.toThrow("Já existe");
  expect((await repo.obter(1)).cpf).toBe(ana.cpf);
  await expect(atualizar.executar(99, ana)).rejects.toThrow("não encontrado");
});

test("UC11 API: edita mantendo CPF próprio e recusa CPF de outro leitor", async () => {
  const primeiro = await leitorDeTeste(); const segundo = await leitorDeTeste();
  const resposta = await api("PUT", `/leitores/${primeiro.id}`, { ...primeiro, nome: `${primeiro.nome} atualizado` });
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toMatchObject({ id: primeiro.id, cpf: primeiro.cpf, nome: `${primeiro.nome} atualizado` });
  expect((await api("PUT", `/leitores/${primeiro.id}`, { ...primeiro, cpf: segundo.cpf })).status).toBe(409);
  expect((await api("PUT", `/leitores/${primeiro.id}`, { ...primeiro, email: "inválido" })).status).toBe(400);
  expect((await api("PUT", "/leitores/2147483647", primeiro)).status).toBe(404);
});
