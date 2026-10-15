import { ReservarExemplar } from "../src/modules/circulacao/domain/ReservarExemplar";
import { RegistrarEmprestimo } from "../src/modules/circulacao/domain/RegistrarEmprestimo";
import { RegistrarDevolucao } from "../src/modules/circulacao/domain/RegistrarDevolucao";
import { expect, test } from "bun:test";
import { cenario } from "./circulacaoDouble";
import { api, exemplarDeTeste } from "./suporte-api";
import { leitorDeTeste } from "./leitoresApiFixture";
import { hoje } from "../src/modules/circulacao/domain/modelo";

test("UC20 devolução libera exemplar e vaga e só pode ocorrer uma vez", async () => {
  const { criar, tempo } = cenario();
  const reservar = criar(ReservarExemplar);
  const emprestar = criar(RegistrarEmprestimo);
  const devolver = criar(RegistrarDevolucao);
  const primeiro = await emprestar.executar(1, 1);
  await emprestar.executar(1, 2); await emprestar.executar(1, 3);
  tempo.agora = "2026-11-01T12:00:00Z";
  const devolvido = await devolver.executar(primeiro.id);
  expect(devolvido).toMatchObject({ dataDevolucao: "2026-11-01", situacao: "devolvido", diasDeAtraso: 3 });
  await expect(devolver.executar(primeiro.id)).rejects.toThrow("já foi devolvido");
  await emprestar.executar(1, 4); await reservar.executar(2, 1);
});

test("UC20 API: devolução única libera a cópia para novo empréstimo", async () => {
  const leitor = await leitorDeTeste(); const exemplar = await exemplarDeTeste();
  const emprestimo = await (await api("POST", "/emprestimos", { leitorId: leitor.id, exemplarId: exemplar.id })).json();
  const resposta = await api("POST", `/emprestimos/${emprestimo.id}/devolucao`);
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toMatchObject({ id: emprestimo.id, dataDevolucao: hoje(), situacao: "devolvido" });
  expect((await api("POST", `/emprestimos/${emprestimo.id}/devolucao`)).status).toBe(409);
  expect((await api("POST", "/emprestimos", { leitorId: leitor.id, exemplarId: exemplar.id })).status).toBe(201);
  expect((await api("POST", "/emprestimos/2147483647/devolucao")).status).toBe(404);
});
