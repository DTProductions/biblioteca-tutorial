import { RegistrarEmprestimo } from "../src/modules/circulacao/domain/RegistrarEmprestimo";
import { ConsultarEmprestimos } from "../src/modules/circulacao/domain/ConsultarEmprestimos";
import { expect, test } from "bun:test";
import { cenario } from "./circulacaoDouble";
import { api, exemplarDeTeste } from "./suporte-api";
import { leitorDeTeste } from "./leitoresApiFixture";
import { hoje, somarDias } from "../src/modules/circulacao/domain/modelo";
import { emTransacao } from "../src/infrastructure/transaction";

test("UC21 consulta filtra leitor, exemplar e situação e calcula atraso", async () => {
  const { criar, tempo, memoria } = cenario();
  const emprestar = criar(RegistrarEmprestimo);
  const emprestimos = criar(ConsultarEmprestimos);
  const primeiro = await emprestar.executar(1, 1);
  const segundo = await emprestar.executar(2, 2);
  tempo.agora = "2026-10-29T12:00:00Z";
  expect((await emprestimos.obter(primeiro.id)).situacao).toBe("em_aberto");
  tempo.agora = "2026-10-30T12:00:00Z";
  expect((await emprestimos.obter(primeiro.id)).diasDeAtraso).toBe(1);
  expect(await emprestimos.executar({ situacao: "em_aberto" })).toHaveLength(2);
  memoria.emprestimosSalvos.find(e => e.id === segundo.id)!.dataDevolucao = "2026-10-30";
  expect(await emprestimos.executar({ situacao: "em_aberto" })).toHaveLength(1);
  expect(await emprestimos.executar({ leitorId: 1, exemplarId: 1, situacao: "atrasado" })).toHaveLength(1);
  expect(await emprestimos.executar({ situacao: "devolvido" })).toHaveLength(1);
  await expect(emprestimos.executar({ situacao: "erro" })).rejects.toThrow("inválida");
  await expect(emprestimos.obter(99)).rejects.toThrow("não encontrado");
});

test("UC21 API: identifica histórico e calcula atraso com filtros", async () => {
  const leitor = await leitorDeTeste(); const exemplar = await exemplarDeTeste();
  const emprestimo = await (await api("POST", "/emprestimos", { leitorId: leitor.id, exemplarId: exemplar.id })).json();
  const consulta = await api("GET", `/emprestimos/${emprestimo.id}`);
  expect(consulta.status).toBe(200);
  expect(await consulta.json()).toMatchObject({ id: emprestimo.id, leitorNome: leitor.nome, leitorCpf: leitor.cpf, numeroRegistro: exemplar.numeroRegistro, situacao: "em_aberto", diasDeAtraso: 0 });
  await emTransacao(async tx => { await tx`UPDATE emprestimos SET data_prevista_devolucao = ${somarDias(hoje(), -1)} WHERE id = ${emprestimo.id}`; });
  const atrasados = await api("GET", `/emprestimos?leitorId=${leitor.id}&exemplarId=${exemplar.id}&situacao=atrasado`);
  expect(await atrasados.json<unknown[]>()).toEqual([expect.objectContaining({ id: emprestimo.id, diasDeAtraso: 1, situacao: "atrasado" })]);
  const abertos = await api("GET", `/emprestimos?leitorId=${leitor.id}&situacao=em_aberto`);
  expect(await abertos.json<unknown[]>()).toEqual([expect.objectContaining({ id: emprestimo.id, situacao: "atrasado" })]);
  expect((await api("GET", "/emprestimos?situacao=invalida")).status).toBe(400);
  expect((await api("GET", "/emprestimos/2147483647")).status).toBe(404);
});
