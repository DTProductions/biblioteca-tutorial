import type { Leitor } from "../src/modules/leitores/domain/Leitor";
import { expect, test } from "bun:test";
import { BuscarLeitores } from "../src/modules/leitores/domain/BuscarLeitores";
import { ana, bruno, LeitoresMemoria } from "./leitoresDouble";
import { api } from "./suporte-api";
import { leitorDeTeste } from "./leitoresApiFixture";

test("UC10 consulta retorna lista vazia, nome, CPF e identificador", async () => {
  const repo = new LeitoresMemoria();
  await repo.inserir(ana); await repo.inserir(bruno);
  const buscar = new BuscarLeitores(repo);
  expect(await buscar.executar("ANA")).toHaveLength(1);
  expect((await buscar.executar("52998224725"))[0]!.nome).toBe("Ana Silva");
  expect(await buscar.executar("inexistente")).toEqual([]);
  expect(await buscar.obter(2)).toMatchObject(bruno);
  await expect(buscar.obter(99)).rejects.toThrow("não encontrado");
});

test("UC10 API: busca por nome, CPF pontuado e consulta individual", async () => {
  const leitor = await leitorDeTeste();
  const lista = await api("GET", `/leitores?q=${encodeURIComponent(leitor.nome)}`);
  expect(lista.status).toBe(200);
  expect(await lista.json<Leitor[]>()).toContainEqual(leitor);
  const cpf = leitor.cpf;
  const comMascara = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  expect(await (await api("GET", `/leitores?q=${comMascara}`)).json<Leitor[]>()).toContainEqual(leitor);
  expect(await (await api("GET", `/leitores/${leitor.id}`)).json<Leitor>()).toEqual(leitor);
  expect((await api("GET", "/leitores/2147483647")).status).toBe(404);
  expect((await api("GET", "/leitores/invalido")).status).toBe(400);
});
