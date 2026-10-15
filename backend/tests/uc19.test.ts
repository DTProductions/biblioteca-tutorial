import { ReservarExemplar } from "../src/modules/circulacao/domain/ReservarExemplar";
import { RegistrarEmprestimo } from "../src/modules/circulacao/domain/RegistrarEmprestimo";
import { expect, test } from "bun:test";
import { cenario } from "./circulacaoDouble";
import { api, exemplarDeTeste } from "./suporte-api";
import { leitorDeTeste } from "./leitoresApiFixture";
import { hoje, somarDias } from "../src/modules/circulacao/domain/modelo";
import { sql } from "../src/infrastructure/postgres";

test("UC19 empréstimo dura14 dias e reserva própria é atendida", async () => {
  const { criar, memoria } = cenario();
  const reservar = criar(ReservarExemplar);
  const emprestar = criar(RegistrarEmprestimo);
  const reserva = await reservar.executar(1, 1);
  await expect(emprestar.executar(2, 1)).rejects.toThrow("outro leitor");
  const emprestimo = await emprestar.executar(1, 1);
  expect(emprestimo).toMatchObject({ dataEmprestimo: "2026-10-15", dataPrevistaDevolucao: "2026-10-29", dataDevolucao: null, situacao: "em_aberto", diasDeAtraso: 0 });
  expect(memoria.reservasSalvas.find(r => r.id === reserva.id)!.situacao).toBe("atendida");
  await expect(emprestar.executar(1, 1)).rejects.toThrow("já está emprestado");
  await expect(reservar.executar(2, 1)).rejects.toThrow("indisponível");
});

test("UC19 API: empréstimo atende reserva própria, impede reserva alheia e vence em14 dias", async () => {
  const leitor = await leitorDeTeste(); const outro = await leitorDeTeste(); const exemplar = await exemplarDeTeste();
  const reserva = await (await api("POST", "/reservas", { leitorId: leitor.id, exemplarId: exemplar.id })).json();
  expect((await api("POST", "/emprestimos", { leitorId: outro.id, exemplarId: exemplar.id })).status).toBe(409);
  const resposta = await api("POST", "/emprestimos", { leitorId: leitor.id, exemplarId: exemplar.id });
  expect(resposta.status).toBe(201);
  expect(await resposta.json()).toMatchObject({ leitorId: leitor.id, exemplarId: exemplar.id, dataEmprestimo: hoje(), dataPrevistaDevolucao: somarDias(hoje(), 14), dataDevolucao: null, situacao: "em_aberto" });
  const [row] = await sql`SELECT situacao FROM reservas WHERE id = ${reserva.id}`;
  expect(row!.situacao).toBe("atendida");
  expect((await api("POST", "/emprestimos", { leitorId: leitor.id, exemplarId: exemplar.id })).status).toBe(409);
});

test("UC19 API: quatro pedidos simultâneos resultam em três empréstimos", async () => {
  const leitor = await leitorDeTeste();
  const exemplares = await Promise.all(Array.from({ length: 4 }, () => exemplarDeTeste()));
  const respostas = await Promise.all(exemplares.map(e => api("POST", "/emprestimos", { leitorId: leitor.id, exemplarId: e.id })));
  expect(respostas.filter(r => r.status === 201)).toHaveLength(3);
  expect(respostas.filter(r => r.status === 409)).toHaveLength(1);
});

test("UC19 recusa quarto empréstimo incluindo os atrasados", async () => {
  const { criar, tempo, memoria } = cenario();
  const reservar = criar(ReservarExemplar);
  const emprestar = criar(RegistrarEmprestimo);
  for (const exemplarId of [1, 2, 3]) await emprestar.executar(1, exemplarId);
  tempo.agora = "2026-11-01T12:00:00Z";
  await expect(emprestar.executar(1, 4)).rejects.toThrow("três empréstimos");
  expect(memoria.emprestimosSalvos).toHaveLength(3);
});

test("UC19 reserva expirada não impede empréstimo por outro leitor", async () => {
  const { criar, tempo } = cenario();
  const reservar = criar(ReservarExemplar);
  const emprestar = criar(RegistrarEmprestimo);
  await reservar.executar(1, 1); tempo.agora = "2026-10-22T12:00:00Z";
  expect((await emprestar.executar(2, 1)).leitorId).toBe(2);
});
