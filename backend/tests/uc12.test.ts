import { expect, test } from "bun:test";
import { ExcluirLeitor } from "../src/modules/leitores/domain/ExcluirLeitor";
import { ana, LeitoresMemoria } from "./leitoresDouble";
import { api } from "./suporte-api";
import { leitorDeTeste } from "./leitoresApiFixture";

test("UC12 exclusão física só é permitida sem qualquer histórico", async () => {
  const repo = new LeitoresMemoria(); await repo.inserir(ana);
  const comHistorico = new ExcluirLeitor(repo, { existePara: async () => true });
  await expect(comHistorico.executar(1)).rejects.toThrow("histórico");
  expect(await repo.obter(1)).toMatchObject(ana);
  const semHistorico = new ExcluirLeitor(repo, { existePara: async () => false });
  await semHistorico.executar(1);
  await expect(semHistorico.executar(1)).rejects.toThrow("não encontrado");
});

test("UC12 API: exclusão sem histórico retorna204 e segunda tentativa404", async () => {
  const leitor = await leitorDeTeste();
  expect((await api("DELETE", `/leitores/${leitor.id}`)).status).toBe(204);
  expect((await api("DELETE", `/leitores/${leitor.id}`)).status).toBe(404);
});
